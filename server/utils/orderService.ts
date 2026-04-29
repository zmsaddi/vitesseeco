/**
 * Order persistence service — PG-primary path (P0-11, ADR-001).
 *
 * Wraps the entire commit-the-order step in a single PG transaction:
 *  1. Lock inventory rows (SELECT FOR UPDATE) for all items
 *  2. Validate every requested quantity against current stock
 *  3. Insert into `orders`
 *  4. Decrement inventory rows
 *  5. Enqueue outbox entries: one for the Sanity order doc, one per
 *     product for inventory sync
 *
 * If anything throws, the transaction rolls back — no partial state, locks
 * released, customer sees a deterministic error.
 *
 * After commit, the route may fire an opportunistic outbox flush so the
 * Sanity admin sees the order within seconds without depending on cron.
 */

import { useDB } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { lockAndDecrement, type StockItem } from '~/server/utils/stock'
import { enqueueOutbox } from '~/server/utils/outbox'

export interface PersistOrderInput {
  orderNumber: string
  customerSnapshot: { name: string; email: string; phone: string; customerId?: string }
  customerId?: string | null
  guestEmail?: string | null
  validatedItems: Array<{
    _key?: string
    productId: string
    productName: string
    color?: string
    sku: string
    quantity: number
    price: number
  }>
  subtotal: number
  shippingCost: number
  discount: number
  total: number
  shippingCode: string
  shippingMethodLabel?: string | null
  shippingAddress: Record<string, unknown>
  billingAddress?: Record<string, unknown>
  paymentCode: string
  promoCode?: string | null
  notes?: string | null
}

export interface PersistOrderResult {
  orderId: string
  orderNumber: string
}

export interface StockUnavailableError extends Error {
  code: 'STOCK_UNAVAILABLE'
  insufficient?: Array<{ productId: string; requested: number; available: number }>
  notFound?: string[]
}

function makeStockError(
  insufficient?: Array<{ productId: string; requested: number; available: number }>,
  notFound?: string[]
): StockUnavailableError {
  const err = new Error('Stock unavailable for one or more items') as StockUnavailableError
  err.code = 'STOCK_UNAVAILABLE'
  err.insufficient = insufficient
  err.notFound = notFound
  return err
}

/**
 * Persist an order with stock locking. Throws on stock failure or DB error.
 */
export async function persistOrderPGPrimary(input: PersistOrderInput): Promise<PersistOrderResult> {
  const db = useDB()

  return await db.transaction(async (tx) => {
    // 1 + 2 + 4: lock and decrement inventory atomically
    const stockItems: StockItem[] = input.validatedItems.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      quantity: i.quantity,
    }))
    const stockResult = await lockAndDecrement(tx, stockItems)
    if (!stockResult.ok) {
      throw makeStockError(stockResult.insufficient, stockResult.notFound)
    }

    // 3: insert order
    const [inserted] = await tx
      .insert(orders)
      .values({
        orderNumber: input.orderNumber,
        customerId: input.customerId || null,
        guestEmail: input.guestEmail || null,
        status: 'pending',
        paymentMethod: input.paymentCode,
        items: input.validatedItems as any,
        subtotal: String(input.subtotal),
        shippingCost: String(input.shippingCost),
        discount: String(input.discount),
        total: String(input.total),
        promoCode: input.promoCode || null,
        shippingMethod: input.shippingCode,
        shippingAddress: input.shippingAddress as any,
        billingAddress: (input.billingAddress || input.shippingAddress) as any,
        customerSnapshot: input.customerSnapshot as any,
        notes: input.notes || null,
      })
      .returning({ id: orders.id })

    if (!inserted?.id) {
      throw new Error('Failed to insert order row')
    }

    // 5: enqueue Sanity sync — one entry for the order doc, one per product
    // for inventory sync. Dispatcher reads PG fresh at dispatch time so the
    // value pushed to Sanity always reflects current PG state.
    await enqueueOutbox(tx, {
      kind: 'sanity.order.create',
      payload: {
        orderNumber: input.orderNumber,
        status: 'pending',
        paymentMethod: input.paymentCode,
        customer: input.customerSnapshot,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress || input.shippingAddress,
        shippingMethod: input.shippingMethodLabel || input.shippingCode,
        items: input.validatedItems,
        subtotal: input.subtotal,
        shippingCost: input.shippingCost,
        discount: input.discount,
        total: input.total,
        promoCode: input.promoCode || null,
        notes: input.notes || null,
        createdAt: new Date().toISOString(),
      },
    })

    const uniqueProductIds = [...new Set(input.validatedItems.map((i) => i.productId))]
    for (const productId of uniqueProductIds) {
      await enqueueOutbox(tx, {
        kind: 'sanity.inventory.patch',
        payload: { productId },
      })
    }

    return { orderId: inserted.id, orderNumber: input.orderNumber }
  })
}

/**
 * Best-effort opportunistic flush at the end of an order request, so admins
 * typically see the new order within seconds without depending on the
 * external cron. Time-budgeted; failures are swallowed (the cron will retry).
 */
export async function opportunisticOutboxFlush(opts: {
  process: (entry: { id: string; kind: string; payload: any }) => Promise<void>
  batchSize?: number
  budgetMs?: number
}): Promise<void> {
  const { drainOutbox } = await import('~/server/utils/outbox')
  const budget = opts.budgetMs ?? 4000

  await Promise.race([
    drainOutbox({ batchSize: opts.batchSize ?? 5, process: opts.process }).catch((err) => {
      console.warn('[OUTBOX] opportunistic flush errored', err)
    }),
    new Promise<void>((resolve) => setTimeout(resolve, budget)),
  ])
}
