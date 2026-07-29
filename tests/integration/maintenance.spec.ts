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
import { readAvailability, reserveStock } from '../../server/services/stock'
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
})
