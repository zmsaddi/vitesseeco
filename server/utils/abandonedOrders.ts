/**
 * Abandoned-order sweep.
 *
 * Stock is decremented when the order row is written, before the customer
 * reaches the payment provider. A customer who closes the PayPal popup leaves a
 * `pending` order behind and those units stay reserved forever, so the catalog
 * slowly understates what is actually on the shelf.
 *
 * This cancels online-payment orders that never got paid and hands their stock
 * back. Cash-on-delivery and in-store orders are deliberately excluded: they
 * legitimately sit at `pending` until an admin marks them paid.
 */

import { and, eq, lt, notInArray, sql } from 'drizzle-orm'
import { useDB, useDBHttp } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { increment, type StockItem } from '~/server/utils/stock'
import { enqueueOutbox } from '~/server/utils/outbox'
import { audit } from '~/server/utils/audit'

/** Payment methods whose orders may legitimately stay pending indefinitely. */
const OFFLINE_PAYMENT_CODES = ['cod', 'in_store']

/** How long an unpaid online order is given before it is considered abandoned. */
const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000

export interface SweepResult {
  cancelled: number
  restocked: number
}

export async function sweepAbandonedOrders(opts: { limit?: number; olderThanMs?: number } = {}): Promise<SweepResult> {
  const limit = opts.limit ?? 25
  const cutoff = new Date(Date.now() - (opts.olderThanMs ?? ABANDON_AFTER_MS))

  // Read over the HTTP driver so the usual empty round costs no pooled
  // connection; the Pool is only opened when there is something to cancel.
  const stale = await useDBHttp()
    .select({ id: orders.id, orderNumber: orders.orderNumber, items: orders.items })
    .from(orders)
    .where(and(
      eq(orders.status, 'pending'),
      lt(orders.createdAt, cutoff),
      notInArray(orders.paymentMethod, OFFLINE_PAYMENT_CODES),
    ))
    .limit(limit)

  if (stale.length === 0) return { cancelled: 0, restocked: 0 }

  let cancelled = 0
  let restocked = 0
  const db = useDB()

  for (const order of stale) {
    const items = (Array.isArray(order.items) ? order.items : []) as StockItem[]
    const stockItems = items
      .filter((i) => i?.productId && typeof i.quantity === 'number' && i.quantity > 0)
      .map((i) => ({ productId: i.productId, quantity: i.quantity }))

    // The status predicate is what makes this safe to run concurrently with a
    // late capture: whoever flips the row first wins, and a zero-row update
    // means the order was paid or cancelled in the meantime, so no restock.
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .update(orders)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')))
        .returning({ id: orders.id })
      if (rows.length === 0) return false

      if (stockItems.length) await increment(tx, stockItems)

      await enqueueOutbox(tx, { kind: 'sanity.order.patch', payload: { orderNumber: order.orderNumber } })
      for (const productId of [...new Set(stockItems.map((i) => i.productId))]) {
        await enqueueOutbox(tx, { kind: 'sanity.inventory.patch', payload: { productId } })
      }
      return true
    })

    if (!claimed) continue
    cancelled++
    restocked += stockItems.length

    await audit({
      action: 'order.abandoned',
      actorType: 'system',
      resourceType: 'order',
      resourceId: order.orderNumber ?? undefined,
      metadata: { restoredItems: stockItems.length },
    })
  }

  return { cancelled, restocked }
}

/**
 * Bounded retention sweep so append-only telemetry cannot grow without limit.
 *
 * Every delete is capped: the cron runs on a free tier with a hard wall, and an
 * unbounded delete over a year of rows would blow through it. A large backlog
 * drains over successive runs instead of one long statement.
 */
const PRUNE_BATCH = 500

export async function pruneTelemetry(): Promise<{ events: number; auditLog: number; sessions: number }> {
  const db = useDBHttp()

  const deleteOldest = async (table: string, column: string, interval: string) => {
    const res = await db.execute(sql`
      DELETE FROM ${sql.raw(table)}
      WHERE ctid IN (
        SELECT ctid FROM ${sql.raw(table)}
        WHERE ${sql.raw(column)} < NOW() - ${sql.raw(interval)}::interval
        LIMIT ${PRUNE_BATCH}
      )
    `)
    return (res as any)?.rowCount ?? 0
  }

  return {
    events: await deleteOldest('events', 'created_at', '90 days'),
    auditLog: await deleteOldest('audit_log', 'created_at', '365 days'),
    sessions: await deleteOldest('sessions', 'expires_at', '0 days'),
  }
}
