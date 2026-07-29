/**
 * Promotion redemption, verified against a real database.
 *
 * The interesting property is the last remaining use: two checkouts racing for
 * it must not both win. That is settled by the database or not at all, so it is
 * tested by racing rather than by reading the code.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  countPromoRedemptions,
  hasCustomerRedeemed,
  redeemPromo,
  releasePromo,
} from '../../server/services/promo'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { cents } from '../../shared/money'
import { closePool, hasDatabase, inTransaction, resetDatabase, seedOrder, testDb } from './setup'

const CODE = 'WELCOME10'

describe.skipIf(!hasDatabase)('promo redemption', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  it('counts nothing before anything is redeemed', async () => {
    expect(await countPromoRedemptions(CODE, testDb())).toBe(0)
  })

  it('records a redemption and counts it', async () => {
    const orderId = await seedOrder()
    await inTransaction((tx) =>
      redeemPromo(tx, { code: CODE, orderId, customerId: null, discount: cents(1000), maxUses: null })
    )
    expect(await countPromoRedemptions(CODE, testDb())).toBe(1)
  })

  it('is case-insensitive, so the same code is never counted twice over', async () => {
    const orderId = await seedOrder()
    await inTransaction((tx) =>
      redeemPromo(tx, { code: 'welcome10', orderId, customerId: null, discount: cents(1000), maxUses: null })
    )
    expect(await countPromoRedemptions('WELCOME10', testDb())).toBe(1)
    expect(await countPromoRedemptions('welcome10', testDb())).toBe(1)
  })

  it('refuses a redemption once the limit is reached', async () => {
    const first = await seedOrder()
    await inTransaction((tx) =>
      redeemPromo(tx, { code: CODE, orderId: first, customerId: null, discount: cents(1000), maxUses: 1 })
    )

    const second = await seedOrder()
    const error = await inTransaction((tx) =>
      redeemPromo(tx, { code: CODE, orderId: second, customerId: null, discount: cents(1000), maxUses: 1 })
    ).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe(ERROR_CODES.PROMO_EXHAUSTED)
    expect(await countPromoRedemptions(CODE, testDb())).toBe(1)
  })

  it('gives exactly one winner when two checkouts race for the last use', async () => {
    const [orderA, orderB] = await Promise.all([seedOrder(), seedOrder()])

    const results = await Promise.allSettled([
      inTransaction((tx) =>
        redeemPromo(tx, { code: CODE, orderId: orderA, customerId: null, discount: cents(1000), maxUses: 1 })
      ),
      inTransaction((tx) =>
        redeemPromo(tx, { code: CODE, orderId: orderB, customerId: null, discount: cents(1000), maxUses: 1 })
      ),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await countPromoRedemptions(CODE, testDb())).toBe(1)
  })

  it('never exceeds the limit under a burst of ten', async () => {
    const orderIds = await Promise.all(Array.from({ length: 10 }, () => seedOrder()))

    const results = await Promise.allSettled(
      orderIds.map((orderId) =>
        inTransaction((tx) =>
          redeemPromo(tx, { code: CODE, orderId, customerId: null, discount: cents(500), maxUses: 3 })
        )
      )
    )

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    expect(await countPromoRedemptions(CODE, testDb())).toBe(3)
  })

  it('allows unlimited use when no limit is set', async () => {
    const orderIds = await Promise.all(Array.from({ length: 5 }, () => seedOrder()))
    await Promise.all(
      orderIds.map((orderId) =>
        inTransaction((tx) =>
          redeemPromo(tx, { code: CODE, orderId, customerId: null, discount: cents(100), maxUses: null })
        )
      )
    )
    expect(await countPromoRedemptions(CODE, testDb())).toBe(5)
  })

  it('refuses a second redemption for the same order, so a retry cannot consume a use', async () => {
    const orderId = await seedOrder()
    await inTransaction((tx) =>
      redeemPromo(tx, { code: CODE, orderId, customerId: null, discount: cents(1000), maxUses: null })
    )

    await expect(
      inTransaction((tx) =>
        redeemPromo(tx, { code: 'OTHER', orderId, customerId: null, discount: cents(500), maxUses: null })
      )
    ).rejects.toThrow()
  })

  it('rolls the redemption back when the surrounding transaction fails', async () => {
    // The redemption is part of the order, not a separate step. If the order
    // does not commit, the use was never consumed.
    const orderId = await seedOrder()
    await inTransaction(async (tx) => {
      await redeemPromo(tx, { code: CODE, orderId, customerId: null, discount: cents(1000), maxUses: null })
      throw new Error('order failed after the promo was recorded')
    }).catch(() => {})

    expect(await countPromoRedemptions(CODE, testDb())).toBe(0)
  })

  it('gives a use back when an order is cancelled', async () => {
    const orderId = await seedOrder()
    await inTransaction((tx) =>
      redeemPromo(tx, { code: CODE, orderId, customerId: null, discount: cents(1000), maxUses: 1 })
    )
    expect(await countPromoRedemptions(CODE, testDb())).toBe(1)

    expect(await inTransaction((tx) => releasePromo(tx, orderId))).toBe(1)
    expect(await countPromoRedemptions(CODE, testDb())).toBe(0)

    // And the freed use is genuinely available again.
    const next = await seedOrder()
    await expect(
      inTransaction((tx) =>
        redeemPromo(tx, { code: CODE, orderId: next, customerId: null, discount: cents(1000), maxUses: 1 })
      )
    ).resolves.toBeUndefined()
  })

  it('is idempotent on release', async () => {
    const orderId = await seedOrder()
    await inTransaction((tx) =>
      redeemPromo(tx, { code: CODE, orderId, customerId: null, discount: cents(1000), maxUses: null })
    )
    expect(await inTransaction((tx) => releasePromo(tx, orderId))).toBe(1)
    expect(await inTransaction((tx) => releasePromo(tx, orderId))).toBe(0)
  })

  it('tracks per-customer use for once-per-customer codes', async () => {
    const [customerId] = await testDb()
      .execute<{ id: string }>(
        sql`INSERT INTO customers (email, first_name, last_name) VALUES ('a@b.com', 'A', 'B') RETURNING id`
      )
      .then((result) => result.rows.map((row) => row.id))

    const orderId = await seedOrder({ customerId })
    await inTransaction((tx) =>
      redeemPromo(tx, { code: CODE, orderId, customerId: customerId as string, discount: cents(1000), maxUses: null })
    )

    expect(await hasCustomerRedeemed(CODE, customerId as string, testDb())).toBe(true)
    expect(await hasCustomerRedeemed('OTHER', customerId as string, testDb())).toBe(false)
  })

  it('records the discount that was actually granted', async () => {
    const orderId = await seedOrder()
    await inTransaction((tx) =>
      redeemPromo(tx, { code: CODE, orderId, customerId: null, discount: cents(2499), maxUses: null })
    )

    const rows = await testDb().execute<{ discount_cents: number }>(
      sql`SELECT discount_cents FROM promo_redemptions WHERE code = ${CODE}`
    )
    expect(rows.rows[0]?.discount_cents).toBe(2499)
  })

  it('refuses a negative discount at the database level', async () => {
    const orderId = await seedOrder()
    await expect(
      testDb().execute(sql`
        INSERT INTO promo_redemptions (code, order_id, discount_cents)
        VALUES (${CODE}, ${orderId}, -100)
      `)
    ).rejects.toThrow()
  })
})
