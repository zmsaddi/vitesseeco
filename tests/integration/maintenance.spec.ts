/**
 * The sweep, verified against a real database.
 *
 * This suite exists because the previous state of this branch was the exact
 * failure it guards: `expireStaleReservations` was written, documented and
 * covered by unit tests — and called by nothing. Stock was held forever by any
 * abandoned checkout, and every test still passed.
 *
 * So these cases assert the OUTCOME the shop cares about: after the sweep, is
 * the bike sellable again.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { runMaintenance, MAINTENANCE_CONSTANTS } from '../../server/services/maintenance'
import { transitionOrder } from '../../server/services/orders'
import {
  CASH_RESERVATION_TTL_MS,
  consumeReservations,
  readAvailability,
  reserveStock,
  restockOrder,
} from '../../server/services/stock'
import {
  closePool,
  hasDatabase,
  inTransaction,
  resetDatabase,
  schema,
  seedOrder,
  seedProduct,
  testDb,
} from './setup'

const BIKE = 'product-v20-noir'

/** Push a row's timestamps into the past, so a TTL can be tested without waiting. */
async function ageOrder(orderId: string, minutes: number): Promise<void> {
  await testDb().execute(
    sql`UPDATE orders SET created_at = NOW() - (${minutes} || ' minutes')::interval WHERE id = ${orderId}`
  )
}

async function expireReservation(orderId: string): Promise<void> {
  await testDb().execute(
    sql`UPDATE stock_reservations SET expires_at = NOW() - interval '1 minute' WHERE order_id = ${orderId}`
  )
}

/** Restocking reads order_items, so a stock case needs one to have anything to give back. */
async function addItem(orderId: string, productId: string, quantity: number): Promise<void> {
  await testDb().insert(schema.orderItems).values({
    orderId,
    productId,
    sku: productId,
    nameSnapshot: 'V20 Pro — Noir',
    unitPriceCents: 95000,
    quantity,
    lineTotalCents: 95000 * quantity,
  })
}

/** The shelf itself. `available` nets off live holds and would mask an inflated one. */
async function onHandOf(productId: string): Promise<number | undefined> {
  const [row] = await testDb()
    .select({ onHand: schema.inventory.onHand })
    .from(schema.inventory)
    .where(sql`${schema.inventory.productId} = ${productId}`)
  return row?.onHand
}

async function orderNumberOf(orderId: string): Promise<string> {
  const [row] = await testDb()
    .select({ orderNumber: schema.orders.orderNumber })
    .from(schema.orders)
    .where(sql`${schema.orders.id} = ${orderId}`)
  if (!row) throw new Error('orderNumberOf: no such order')
  return row.orderNumber
}

describe.skipIf(!hasDatabase)('maintenance sweep', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  it('gives back stock held by a reservation that has expired', async () => {
    await seedProduct(BIKE, 3)
    const orderId = await seedOrder({ status: 'awaiting_payment' })
    await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

    expect((await readAvailability(testDb(), [BIKE])).get(BIKE)?.available).toBe(1)

    await expireReservation(orderId)
    const report = await runMaintenance(inTransaction, testDb())

    expect(report.reservationsExpired).toBe(1)
    // The outcome that matters: the bike can be sold again.
    expect((await readAvailability(testDb(), [BIKE])).get(BIKE)?.available).toBe(3)
  })

  it('leaves a live reservation alone', async () => {
    await seedProduct(BIKE, 3)
    const orderId = await seedOrder({ status: 'awaiting_payment' })
    await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

    const report = await runMaintenance(inTransaction, testDb())

    expect(report.reservationsExpired).toBe(0)
    expect((await readAvailability(testDb(), [BIKE])).get(BIKE)?.available).toBe(1)
  })

  it('cancels an online order abandoned at the payment form, and restocks it', async () => {
    await seedProduct(BIKE, 2)
    const orderId = await seedOrder({ status: 'awaiting_payment', paymentMethod: 'stripe' })
    await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))
    await ageOrder(orderId, MAINTENANCE_CONSTANTS.UNPAID_ORDER_TTL_MINUTES + 5)

    const report = await runMaintenance(inTransaction, testDb())

    expect(report.ordersCancelled).toHaveLength(1)
    expect((await readAvailability(testDb(), [BIKE])).get(BIKE)?.available).toBe(2)

    const [row] = await testDb()
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(sql`${schema.orders.id} = ${orderId}`)
    expect(row?.status).toBe('cancelled')
  })

  it('does not invent stock when the hold expired before the sweep reached the order', async () => {
    // The state every abandoned online checkout actually reaches, and the one
    // the test above cannot: the hold lives 30 minutes, the cancellation sweep
    // waits 60, so by the time an order is cancelled its reservation is ALWAYS
    // already gone. The test above ages only `orders.created_at` and leaves the
    // reservation live — a combination the clock cannot produce — which is why
    // it passed while the shop's stock climbed.
    //
    // The sweep settles the expired hold first, so the cancellation then finds
    // nothing to release, reads that zero as "this order was paid, its hold
    // already became a decrement", and adds the units back. They were never
    // taken away: a reservation holds, it does not decrement. Stock grows.
    await seedProduct(BIKE, 5)
    const orderId = await seedOrder({ status: 'awaiting_payment', paymentMethod: 'stripe' })
    await addItem(orderId, BIKE, 2)
    await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

    await ageOrder(orderId, MAINTENANCE_CONSTANTS.UNPAID_ORDER_TTL_MINUTES + 5)
    await expireReservation(orderId)

    const report = await runMaintenance(inTransaction, testDb())
    expect(report.ordersCancelled).toHaveLength(1)

    // on_hand, not `available`: availability nets off live holds and would hide
    // an inflated shelf behind a released one.
    expect(await onHandOf(BIKE)).toBe(5)
  })

  it('still restocks an order that really was paid', async () => {
    // The other half of the same decision. Paying consumes the hold and takes
    // the units off the shelf, so cancelling afterwards must put them back —
    // the fix must not turn restocking off wholesale.
    await seedProduct(BIKE, 5)
    const orderId = await seedOrder({ status: 'paid', paymentMethod: 'stripe', paidAt: new Date() })
    await addItem(orderId, BIKE, 2)
    await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))
    await inTransaction((tx) => consumeReservations(tx, orderId))
    expect(await onHandOf(BIKE)).toBe(3)

    await transitionOrder(await orderNumberOf(orderId), 'cancelled', { runTransaction: inTransaction })

    expect(await onHandOf(BIKE)).toBe(5)
  })

  it('leaves a recent unpaid order alone', async () => {
    // A customer wrestling with 3-D Secure must not lose their basket.
    await seedProduct(BIKE, 2)
    const orderId = await seedOrder({ status: 'awaiting_payment', paymentMethod: 'stripe' })
    await ageOrder(orderId, MAINTENANCE_CONSTANTS.UNPAID_ORDER_TTL_MINUTES - 5)

    const report = await runMaintenance(inTransaction, testDb())
    expect(report.ordersCancelled).toHaveLength(0)
  })

  it('never cancels a cash order, however old', async () => {
    // A cash order is an agreed sale awaiting a driver, not an abandoned
    // basket. Cancelling one because nobody clicked anything deletes real work.
    await seedProduct(BIKE, 2)
    const orderId = await seedOrder({ status: 'awaiting_payment', paymentMethod: 'cod' })
    await ageOrder(orderId, MAINTENANCE_CONSTANTS.UNPAID_ORDER_TTL_MINUTES * 100)

    const report = await runMaintenance(inTransaction, testDb())
    expect(report.ordersCancelled).toHaveLength(0)
  })

  it('never cancels an order that was paid', async () => {
    await seedProduct(BIKE, 2)
    const orderId = await seedOrder({ status: 'paid', paymentMethod: 'stripe', paidAt: new Date() })
    await ageOrder(orderId, MAINTENANCE_CONSTANTS.UNPAID_ORDER_TTL_MINUTES * 100)

    const report = await runMaintenance(inTransaction, testDb())
    expect(report.ordersCancelled).toHaveLength(0)
  })

  it('is safe to run twice', async () => {
    // Two schedulers, or a retry, must not double-release anything.
    await seedProduct(BIKE, 3)
    const orderId = await seedOrder({ status: 'awaiting_payment' })
    await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))
    await expireReservation(orderId)

    await runMaintenance(inTransaction, testDb())
    const second = await runMaintenance(inTransaction, testDb())

    expect(second.reservationsExpired).toBe(0)
    expect((await readAvailability(testDb(), [BIKE])).get(BIKE)?.available).toBe(3)
  })

  it('prunes rate-limit buckets whose window has closed', async () => {
    await testDb()
      .insert(schema.rateLimits)
      .values([
        {
          bucket: 'expired',
          count: 3,
          windowStartedAt: new Date(Date.now() - 120_000),
          expiresAt: new Date(Date.now() - 60_000),
        },
        {
          bucket: 'live',
          count: 1,
          windowStartedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      ])

    const report = await runMaintenance(inTransaction, testDb())

    expect(report.rateLimitsPruned).toBe(1)
    const remaining = await testDb().select({ bucket: schema.rateLimits.bucket }).from(schema.rateLimits)
    expect(remaining.map((row) => row.bucket)).toEqual(['live'])
  })

  it('prunes expired sessions and leaves live ones alone', async () => {
    // The sweep did not touch the sessions table at all. `pruneExpiredSessions`
    // existed, was exported, was named in the cron route's own description, and
    // had no caller — so expired rows accumulated for the lifetime of the shop.
    const [customer] = await testDb()
      .insert(schema.customers)
      .values({ email: 'sweeper@example.com', passwordHash: null, firstName: 'S', lastName: 'W' })
      .returning({ id: schema.customers.id })

    await testDb()
      .insert(schema.sessions)
      .values([
        {
          customerId: customer!.id,
          tokenHash: 'a'.repeat(64),
          expiresAt: new Date(Date.now() - 60_000),
        },
        {
          customerId: customer!.id,
          tokenHash: 'b'.repeat(64),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      ])

    const report = await runMaintenance(inTransaction, testDb())

    expect(report.sessionsPruned).toBe(1)
    const left = await testDb().select({ tokenHash: schema.sessions.tokenHash }).from(schema.sessions)
    expect(left.map((row) => row.tokenHash)).toEqual(['b'.repeat(64)])
  })
})

/**
 * The stock lifecycle for sales that are not paid online.
 *
 * Both cases below shipped green: a cash order's hold expired after thirty
 * minutes, the bike went back on sale while a customer waited for it, and when
 * the driver finally collected the money there was no hold left to consume — so
 * `on_hand` was never decremented and the shop counted a bike it had sold. And
 * cancelling a paid order refunded the customer without returning the units,
 * because releasing a hold that has already become a decrement does nothing.
 *
 * These assert the number on the shelf, not the mechanism, because the mechanism
 * was what looked correct.
 */
describe.skipIf(!hasDatabase)('stock for cash and cancelled orders', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  const onHand = async (): Promise<number> => {
    const [row] = await testDb()
      .select({ onHand: schema.inventory.onHand })
      .from(schema.inventory)
      .where(sql`${schema.inventory.productId} = ${BIKE}`)
    return row?.onHand ?? -1
  }

  it("keeps a cash order's hold alive far longer than an online one", async () => {
    await seedProduct(BIKE, 2)
    const orderId = await seedOrder({ status: 'awaiting_payment', paymentMethod: 'cod' })
    await inTransaction((tx) =>
      reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }], CASH_RESERVATION_TTL_MS)
    )

    // An hour on, an online hold would be gone and the bike back on sale.
    await testDb().execute(
      sql`UPDATE stock_reservations SET created_at = NOW() - interval '1 hour' WHERE order_id = ${orderId}`
    )
    const report = await runMaintenance(inTransaction, testDb())

    expect(report.reservationsExpired).toBe(0)
    expect((await readAvailability(testDb(), [BIKE])).get(BIKE)?.available).toBe(1)
  })

  it('decrements the shelf when the driver comes back with the cash', async () => {
    await seedProduct(BIKE, 2)
    const orderId = await seedOrder({ status: 'awaiting_payment', paymentMethod: 'cod' })
    await inTransaction((tx) =>
      reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }], CASH_RESERVATION_TTL_MS)
    )

    expect(await onHand()).toBe(2)
    const consumed = await inTransaction((tx) => consumeReservations(tx, orderId))

    expect(consumed).toBe(1)
    // The bike has left the building; the count must agree.
    expect(await onHand()).toBe(1)
  })

  it('puts the units back when a PAID order is cancelled', async () => {
    await seedProduct(BIKE, 3)
    const orderId = await seedOrder({ status: 'awaiting_payment' })
    await testDb()
      .insert(schema.orderItems)
      .values({
        orderId,
        productId: BIKE,
        nameSnapshot: 'V20 Noir',
        unitPriceCents: 95000,
        quantity: 2,
        lineTotalCents: 190000,
      })
    await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))
    await inTransaction((tx) => consumeReservations(tx, orderId))

    expect(await onHand()).toBe(1)

    // Refunded and cancelled. The bikes are back in the warehouse.
    const restocked = await inTransaction((tx) => restockOrder(tx, orderId))

    expect(restocked).toBe(1)
    expect(await onHand()).toBe(3)
  })
})
