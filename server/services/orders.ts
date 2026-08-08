/**
 * Orders.
 *
 * Placing an order writes the order, its lines, its stock hold and its
 * promotion redemption in ONE transaction. All of it commits or none of it
 * does — there is no window in which an order exists without its stock
 * reserved, and no compensating cleanup to write, because there is nothing to
 * compensate for.
 *
 * The previous build inserted into a document store first, then into Postgres
 * inside a try/catch that logged the failure and carried on, so an order could
 * exist in one and not the other.
 */
import { and, eq, sql } from 'drizzle-orm'
import { orderItems, orders } from '../db/schema'
import {
  db,
  queryRows,
  withTransaction,
  type SqlExecutor,
  type Transaction,
  type TransactionRunner,
} from '../db/client'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { generateOrderNumber } from '../security/crypto'
import type { OrderStatus } from '../../shared/schemas'
import type { AddressInput } from '../../shared/schemas'
import type { LocaleCode } from '../../shared/locales'
import type { MarketDefinition } from '../../shared/markets'
import { assertTransition, holdsStock, timestampFor } from './orderState'
import {
  CASH_RESERVATION_TTL_MS,
  consumeReservations,
  releaseReservations,
  reserveStock,
  restockOrder,
} from './stock'
import { redeemPromo, releasePromo } from './promo'
import { priceBasket, type PriceBreakdown, type RequestedLine } from './pricing'
import { getPromo } from '../catalog'

export interface PlaceOrderInput {
  lines: RequestedLine[]
  locale: LocaleCode
  /**
   * Whose price list this order is being placed against. Resolved from the
   * request by the route wrapper; omitted only by tests, where the locale's own
   * market is the sensible default.
   */
  market?: MarketDefinition
  paymentMethod: 'stripe' | 'cod' | 'in_store'
  shipping: { methodCode: string; country: string; postalCode?: string }
  shippingAddress?: AddressInput
  billingAddress?: AddressInput
  promoCode?: string
  notes?: string
  /** Supplied by the client and unique, so a retry resolves to one order. */
  idempotencyKey: string
  customer: { id: string; email: string; firstName: string; lastName: string } | null
  guestEmail?: string
  /**
   * Who placed this and how to reach them. Required, and frozen onto the order
   * like the money: the name that goes on the invoice and the number the shop
   * rings must be the ones given that day, not whatever the account holds two
   * years later.
   */
  firstName: string
  lastName: string
  phone: string
  /** Injectable so the whole path can be exercised against a test database. */
  runTransaction?: TransactionRunner
  read?: SqlExecutor
}

export interface PlacedOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  breakdown: PriceBreakdown
}

/**
 * Place an order.
 *
 * Returns the existing order when the idempotency key has been seen before, so
 * a double-clicked pay button, a retried request and a flaky connection all
 * resolve to the same order rather than three.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const run = input.runTransaction ?? withTransaction

  const existing = await findByIdempotencyKey(input.idempotencyKey, input.read)
  if (existing) return existing

  // Priced before the transaction opens: it reads the catalogue over the
  // network, and holding database locks across an external call is how a busy
  // shop deadlocks itself.
  const breakdown = await priceBasket({
    lines: input.lines,
    locale: input.locale,
    ...(input.market ? { market: input.market } : {}),
    ...(input.promoCode ? { promoCode: input.promoCode } : {}),
    shipping: {
      methodCode: input.shipping.methodCode,
      country: input.shipping.country,
      ...(input.shipping.postalCode ? { postalCode: input.shipping.postalCode } : {}),
    },
  })

  if (breakdown.promo && !breakdown.promo.applied) {
    // Never charge a total the customer has not seen. The old build dropped the
    // failed code and billed the higher amount.
    throw new AppError(ERROR_CODES.PROMO_EXHAUSTED, {
      details: { code: breakdown.promo.code, reason: breakdown.promo.reason },
      internal: `promo ${breakdown.promo.code} rejected: ${breakdown.promo.reason}`,
    })
  }

  const promoDefinition = breakdown.promo?.applied ? await getPromo(breakdown.promo.code) : null
  const orderNumber = generateOrderNumber()

  // Cash orders are not "awaiting payment" at a provider — they are agreed, and
  // the money arrives at the door or the counter.
  const initialStatus: OrderStatus = 'awaiting_payment'

  try {
    return await run(async (tx) => {
      const [row] = await tx
        .insert(orders)
        .values({
          orderNumber,
          idempotencyKey: input.idempotencyKey,
          customerId: input.customer?.id ?? null,
          guestEmail: input.customer ? null : (input.guestEmail ?? null),
          status: initialStatus,
          locale: input.locale,
          // Frozen here rather than derived later: rates change by law, and a
          // figure recomputed next year would not be the one that applied.
          //
          // This is the VAT contained in the PRICE LIST that was used. It is not
          // yet the VAT owed on the sale — that also depends on whether the
          // parcel crossed a border, whether it was collected in Poitiers, and
          // whether we are registered for OSS. The destination sits on this same
          // row, so the owed figure stays computable; whoever builds invoicing
          // has to decide that rule, and must not read this column as if it
          // already had.
          marketCountry: breakdown.market.country,
          vatRateBp: breakdown.market.vatRateBp,
          vatCents: breakdown.market.vatCents,
          subtotalCents: breakdown.subtotal,
          discountCents: breakdown.discount,
          shippingCents: breakdown.shipping,
          totalCents: breakdown.total,
          promoCode: breakdown.promo?.applied ? breakdown.promo.code : null,
          shippingMethodCode: input.shipping.methodCode,
          paymentMethod: input.paymentMethod,
          // The order's phone also fills the address, so a picking slip or a
          // carrier label carries a number without anyone copying it across.
          shippingAddress: input.shippingAddress
            ? { ...input.shippingAddress, phone: input.shippingAddress.phone ?? input.phone }
            : null,
          billingAddress: input.billingAddress ?? input.shippingAddress ?? null,
          // The name stated at checkout, not the one on the account: someone
          // buying for a partner or a company must be able to say so, and it is
          // this name that goes on the invoice.
          customerSnapshot: {
            name: `${input.firstName} ${input.lastName}`.trim(),
            email: input.customer?.email ?? input.guestEmail ?? null,
            phone: input.phone,
          },
          notes: input.notes ?? null,
        })
        .returning({ id: orders.id })

      if (!row) throw new Error('order insert returned no row')
      const orderId = row.id

      await tx.insert(orderItems).values(
        breakdown.lines.map((line) => ({
          orderId,
          productId: line.productId,
          sku: line.sku,
          nameSnapshot: line.name,
          colorSnapshot: line.color,
          imageSnapshot: line.image,
          unitPriceCents: line.unitPrice,
          quantity: line.quantity,
          lineTotalCents: line.lineTotal,
        }))
      )

      // Holds the units while payment is in flight. Throws OUT_OF_STOCK naming
      // every short line, which rolls the whole order back.
      // Cash and counter sales are agreed, not pending — their hold has to last
      // until a driver has been and gone, not thirty minutes.
      await reserveStock(
        tx,
        orderId,
        breakdown.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        input.paymentMethod === 'stripe' ? undefined : CASH_RESERVATION_TTL_MS
      )

      if (breakdown.promo?.applied && promoDefinition) {
        await redeemPromo(tx, {
          code: breakdown.promo.code,
          orderId,
          customerId: input.customer?.id ?? null,
          discount: breakdown.discount,
          maxUses: promoDefinition.maxUses,
        })
      }

      return { id: orderId, orderNumber, status: initialStatus, breakdown }
    })
  } catch (error) {
    // A racing request with the same key committed first. Its order is the
    // answer, not an error.
    if (isUniqueViolation(error, 'orders_idempotency_key')) {
      const raced = await findByIdempotencyKey(input.idempotencyKey, input.read)
      if (raced) return raced
    }
    throw error
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const candidates = [error, (error as { cause?: unknown })?.cause]
  return candidates.some((candidate) => {
    const record = candidate as { code?: string; constraint?: string; message?: string } | undefined
    if (!record) return false
    return record.code === '23505' && (record.constraint === constraint || record.message?.includes(constraint) === true)
  })
}

async function findByIdempotencyKey(key: string, read?: SqlExecutor): Promise<PlacedOrder | null> {
  const handle = (read ?? db()) as ReturnType<typeof db>
  const [row] = await handle
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      subtotalCents: orders.subtotalCents,
      discountCents: orders.discountCents,
      shippingCents: orders.shippingCents,
      totalCents: orders.totalCents,
      promoCode: orders.promoCode,
      shippingMethodCode: orders.shippingMethodCode,
      marketCountry: orders.marketCountry,
      vatRateBp: orders.vatRateBp,
      vatCents: orders.vatCents,
    })
    .from(orders)
    .where(eq(orders.idempotencyKey, key))
    .limit(1)

  if (!row) return null

  const items = await handle.select().from(orderItems).where(eq(orderItems.orderId, row.id))

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    breakdown: {
      lines: items.map((item) => ({
        productId: item.productId,
        slug: '',
        name: item.nameSnapshot,
        sku: item.sku,
        color: item.colorSnapshot,
        image: item.imageSnapshot,
        unitPrice: item.unitPriceCents as never,
        quantity: item.quantity,
        lineTotal: item.lineTotalCents as never,
        discount: 0 as never,
        available: 0,
      })),
      subtotal: row.subtotalCents as never,
      discount: row.discountCents as never,
      shipping: row.shippingCents as never,
      total: row.totalCents as never,
      promo: row.promoCode ? { code: row.promoCode, applied: true } : null,
      shippingMethod: { code: row.shippingMethodCode, name: row.shippingMethodCode },
      // Read back rather than recomputed: a replay of a week-old request must
      // return the order as it was agreed, not as it would be priced today.
      market: {
        country: row.marketCountry,
        vatRateBp: row.vatRateBp,
        vatCents: row.vatCents as never,
      },
    },
  }
}

/**
 * Move an order to a new status, settling stock as the transition requires.
 *
 * The status predicate on the UPDATE is what makes this safe to run
 * concurrently: whoever moves the row first wins, and a second attempt updates
 * nothing and therefore settles nothing. Stock can never be credited twice.
 */
export async function transitionOrder(
  orderNumber: string,
  to: OrderStatus,
  options: { expectFrom?: OrderStatus; runTransaction?: TransactionRunner } = {}
): Promise<{ changed: boolean; from: OrderStatus }> {
  const run = options.runTransaction ?? withTransaction
  return run(async (tx) => {
    const [current] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1)

    if (!current) {
      throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `no order ${orderNumber}` })
    }

    // Already there: a redelivered webhook, or two admins clicking at once.
    if (current.status === to) return { changed: false, from: current.status }

    if (options.expectFrom && current.status !== options.expectFrom) {
      return { changed: false, from: current.status }
    }

    assertTransition(current.status, to)

    const stamp = timestampFor(to)
    const changed = await tx
      .update(orders)
      .set({
        status: to,
        updatedAt: new Date(),
        ...(stamp ? { [stamp]: new Date() } : {}),
      })
      .where(and(eq(orders.id, current.id), eq(orders.status, current.status)))
      .returning({ id: orders.id })

    if (changed.length === 0) return { changed: false, from: current.status }

    if (to === 'paid') {
      // The hold becomes a real decrement.
      const consumed = await consumeReservations(tx, current.id)
      // Zero here is not a no-op. The status predicate on the UPDATE above means
      // this transition happened exactly once, so finding no live hold says the
      // reservation expired before the money arrived — the units are about to be
      // sold twice, and silence would be the last anyone heard of it.
      if (consumed === 0) {
        console.error(
          `[orders] ${orderNumber} moved to paid with no live reservation — stock was NOT decremented`
        )
      }
    } else if (to === 'cancelled' && holdsStock(current.status)) {
      // A live hold is released. An order that already paid has none — its hold
      // became a decrement — so those units are put back explicitly.
      const released = await releaseReservations(tx, current.id)
      if (released === 0) await restockOrder(tx, current.id)
      // An order that never took money gives its promotion use back too.
      if (current.status !== 'paid' && current.status !== 'processing') {
        await releasePromo(tx, current.id)
      }
    }

    return { changed: true, from: current.status }
  })
}

/** Attach the provider's session id, so a webhook can find the order it belongs to. */
export async function attachPaymentSession(
  orderId: string,
  sessionId: string,
  tx?: Transaction
): Promise<void> {
  const handle = tx ?? db()
  await handle.update(orders).set({ stripeSessionId: sessionId }).where(eq(orders.id, orderId))
}

export async function findOrderByStripeSession(sessionId: string): Promise<{ orderNumber: string; status: OrderStatus } | null> {
  const [row] = await db()
    .select({ orderNumber: orders.orderNumber, status: orders.status })
    .from(orders)
    .where(eq(orders.stripeSessionId, sessionId))
    .limit(1)
  return row ?? null
}

