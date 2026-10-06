/**
 * Stock behaviour, verified against a real database.
 *
 * The concurrency cases run genuinely in parallel and assert the invariant
 * held — they do not read the code and reason that it looks correct. That
 * distinction is the whole point: the previous build had a locking function
 * that was written, documented and unreachable, and no test noticed.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  CASH_RESERVATION_TTL_MS,
  consumeReservations,
  expireStaleReservations,
  findLowStock,
  holdForPayment,
  holdIsLive,
  readAvailability,
  releaseReservations,
  reserveStock,
  setOnHand,
  stretchLiveHold,
} from '../../server/services/stock'
import { AppError } from '../../shared/errors'
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
const HELMET = 'product-helmet-m'

describe.skipIf(!hasDatabase)('stock', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  describe('reserveStock', () => {
    it('holds units without touching on_hand', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()

      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)).toMatchObject({ onHand: 5, reserved: 2, available: 3 })
    })

    it('refuses more than is available and names every short line at once', async () => {
      await seedProduct(BIKE, 1)
      await seedProduct(HELMET, 0)
      const orderId = await seedOrder()

      const error = await inTransaction((tx) =>
        reserveStock(tx, orderId, [
          { productId: BIKE, quantity: 2 },
          { productId: HELMET, quantity: 1 },
        ])
      ).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AppError)
      const details = (error as AppError).details as { lines: Array<{ productId: string }> }
      expect(details.lines.map((l) => l.productId).sort()).toEqual([BIKE, HELMET].sort())
    })

    it('says "briefly reserved" when the last unit is held for a payment in progress', async () => {
      // Another checkout's thirty-minute hold: the unit comes back if that
      // payment fails, so trying again shortly is honest advice.
      await seedProduct(BIKE, 1)
      const paying = await seedOrder()
      const next = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, paying, [{ productId: BIKE, quantity: 1 }]))

      const error = await inTransaction((tx) =>
        reserveStock(tx, next, [{ productId: BIKE, quantity: 1 }])
      ).catch((e: unknown) => e)

      expect((error as AppError).code).toBe('OUT_OF_STOCK')
      expect((error as AppError).messageKey).toBe('errors.stock_reserved')
    })

    it('does not promise "a few minutes" for a unit held fourteen days for cash', async () => {
      // A cash-on-delivery or counter order holds its bike until the money
      // arrives, and the sweep never releases it. Telling the next customer to
      // retry in minutes sent them back, again and again, for a sold bike.
      await seedProduct(BIKE, 1)
      const cash = await seedOrder()
      const next = await seedOrder()
      await inTransaction((tx) =>
        reserveStock(tx, cash, [{ productId: BIKE, quantity: 1 }], CASH_RESERVATION_TTL_MS)
      )

      const error = await inTransaction((tx) =>
        reserveStock(tx, next, [{ productId: BIKE, quantity: 1 }])
      ).catch((e: unknown) => e)

      expect((error as AppError).code).toBe('OUT_OF_STOCK')
      expect((error as AppError).messageKey).toBe('errors.out_of_stock')
    })

    it('counts only what a brief hold could give back', async () => {
      // Two on the shelf: one held for cash, one for a card payment. Two can
      // never be had once the card hold lapses; one can.
      await seedProduct(BIKE, 2)
      const cash = await seedOrder()
      const card = await seedOrder()
      await inTransaction((tx) =>
        reserveStock(tx, cash, [{ productId: BIKE, quantity: 1 }], CASH_RESERVATION_TTL_MS)
      )
      await inTransaction((tx) => reserveStock(tx, card, [{ productId: BIKE, quantity: 1 }]))

      const askFor = async (quantity: number) => {
        const order = await seedOrder()
        const error = await inTransaction((tx) =>
          reserveStock(tx, order, [{ productId: BIKE, quantity }])
        ).catch((e: unknown) => e)
        return (error as AppError).messageKey
      }
      expect(await askFor(2)).toBe('errors.out_of_stock')
      expect(await askFor(1)).toBe('errors.stock_reserved')
    })

    it('leaves no partial hold behind when one line fails', async () => {
      await seedProduct(BIKE, 5)
      await seedProduct(HELMET, 0)
      const orderId = await seedOrder()

      await inTransaction((tx) =>
        reserveStock(tx, orderId, [
          { productId: BIKE, quantity: 1 },
          { productId: HELMET, quantity: 1 },
        ])
      ).catch(() => {})

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.reserved).toBe(0)
    })

    it('rejects a product with no inventory row rather than inventing one', async () => {
      const orderId = await seedOrder()
      const error = await inTransaction((tx) =>
        reserveStock(tx, orderId, [{ productId: 'ghost', quantity: 1 }])
      ).catch((e: unknown) => e)
      expect((error as AppError).details).toMatchObject({ unknown: ['ghost'] })
    })

    it('rejects quantities the type system cannot catch at runtime', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      for (const quantity of [0, -1, 1.5]) {
        await expect(
          inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity }]))
        ).rejects.toBeInstanceOf(AppError)
      }
    })

    it('rejects the same product twice in one call', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      await expect(
        inTransaction((tx) =>
          reserveStock(tx, orderId, [
            { productId: BIKE, quantity: 1 },
            { productId: BIKE, quantity: 1 },
          ])
        )
      ).rejects.toBeInstanceOf(AppError)
    })
  })

  describe('concurrency — the last bike must not be sold twice', () => {
    it('lets exactly one of two simultaneous buyers win', async () => {
      await seedProduct(BIKE, 1)
      const [orderA, orderB] = await Promise.all([seedOrder(), seedOrder()])

      const results = await Promise.allSettled([
        inTransaction((tx) => reserveStock(tx, orderA, [{ productId: BIKE, quantity: 1 }])),
        inTransaction((tx) => reserveStock(tx, orderB, [{ productId: BIKE, quantity: 1 }])),
      ])

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.available).toBe(0)
    })

    it('never oversells when ten buyers race for three units', async () => {
      await seedProduct(BIKE, 3)
      const orderIds = await Promise.all(Array.from({ length: 10 }, () => seedOrder()))

      const results = await Promise.allSettled(
        orderIds.map((orderId) =>
          inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }]))
        )
      )

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.available).toBe(0)
      expect(availability.get(BIKE)?.reserved).toBe(3)
    })

    it('does not deadlock when baskets overlap in opposite orders', async () => {
      // Locking in a stable order is what prevents this; without it the two
      // transactions each hold what the other needs.
      await seedProduct(BIKE, 10)
      await seedProduct(HELMET, 10)
      const [orderA, orderB] = await Promise.all([seedOrder(), seedOrder()])

      const results = await Promise.allSettled([
        inTransaction((tx) =>
          reserveStock(tx, orderA, [
            { productId: BIKE, quantity: 1 },
            { productId: HELMET, quantity: 1 },
          ])
        ),
        inTransaction((tx) =>
          reserveStock(tx, orderB, [
            { productId: HELMET, quantity: 1 },
            { productId: BIKE, quantity: 1 },
          ])
        ),
      ])

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    })
  })

  describe('consumeReservations', () => {
    it('turns a hold into a real decrement', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

      const settled = await inTransaction((tx) => consumeReservations(tx, orderId))
      expect(settled).toBe(1)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)).toMatchObject({ onHand: 3, reserved: 0, available: 3 })
    })

    it('is idempotent, so a redelivered webhook decrements nothing twice', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

      expect(await inTransaction((tx) => consumeReservations(tx, orderId))).toBe(1)
      expect(await inTransaction((tx) => consumeReservations(tx, orderId))).toBe(0)
      expect(await inTransaction((tx) => consumeReservations(tx, orderId))).toBe(0)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.onHand).toBe(3)
    })

    it('refuses to drive on_hand negative if stock was edited during payment', async () => {
      await seedProduct(BIKE, 2)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

      // An admin corrects the shelf count down while the customer is paying.
      await inTransaction((tx) => setOnHand(tx, BIKE, 1))

      await expect(inTransaction((tx) => consumeReservations(tx, orderId))).rejects.toBeInstanceOf(AppError)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.onHand).toBe(1)
    })

    it('settles two concurrent captures without double-decrementing', async () => {
      await seedProduct(BIKE, 10)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 3 }]))

      const results = await Promise.allSettled([
        inTransaction((tx) => consumeReservations(tx, orderId)),
        inTransaction((tx) => consumeReservations(tx, orderId)),
      ])
      const settledCounts = results
        .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
        .map((r) => r.value)
      expect(settledCounts.reduce((a, b) => a + b, 0)).toBe(1)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.onHand).toBe(7)
    })
  })

  describe('releaseReservations', () => {
    it('gives the units back', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

      expect(await inTransaction((tx) => releaseReservations(tx, orderId))).toBe(1)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)).toMatchObject({ onHand: 5, reserved: 0, available: 5 })
    })

    it('is idempotent, so a cancel cannot credit stock twice', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))

      expect(await inTransaction((tx) => releaseReservations(tx, orderId))).toBe(1)
      expect(await inTransaction((tx) => releaseReservations(tx, orderId))).toBe(0)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.onHand).toBe(5)
    })

    it('cannot release what has already been consumed', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 2 }]))
      await inTransaction((tx) => consumeReservations(tx, orderId))

      expect(await inTransaction((tx) => releaseReservations(tx, orderId))).toBe(0)

      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.onHand).toBe(3)
    })
  })

  describe('expiry', () => {
    it('stops counting against availability the moment it expires', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }], -1_000))

      // Correctness does not wait for the sweep: an expired hold is already
      // invisible to availability, so a missed webhook cannot strand stock.
      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.available).toBe(1)
    })

    it('lets a new buyer take units an abandoned checkout was holding', async () => {
      await seedProduct(BIKE, 1)
      const abandoned = await seedOrder()
      const fresh = await seedOrder()

      await inTransaction((tx) => reserveStock(tx, abandoned, [{ productId: BIKE, quantity: 1 }], -1_000))
      await expect(
        inTransaction((tx) => reserveStock(tx, fresh, [{ productId: BIKE, quantity: 1 }]))
      ).resolves.toBeUndefined()
    })

    it('sweeps expired holds and is safe to run repeatedly', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }], -1_000))

      expect(await inTransaction((tx) => expireStaleReservations(tx))).toBe(1)
      expect(await inTransaction((tx) => expireStaleReservations(tx))).toBe(0)
    })

    it('leaves live holds alone', async () => {
      await seedProduct(BIKE, 5)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }]))

      expect(await inTransaction((tx) => expireStaleReservations(tx))).toBe(0)
      const availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.reserved).toBe(1)
    })
  })

  /**
   * A payment window must never outlive the hold behind it. Stripe opens no
   * session for less than thirty minutes, so a session opened after its order
   * stayed payable once the hold had lapsed — over units another buyer could
   * hold by then. The hold is stretched to the window instead; a lapsed one is
   * never revived.
   */
  describe('stretching a hold over a payment window', () => {
    const expiryOf = async (orderId: string): Promise<number> => {
      const rows = await testDb().execute<{ ms: number }>(
        sql`SELECT (extract(epoch FROM expires_at) * 1000)::float8 AS ms FROM stock_reservations WHERE order_id = ${orderId}`
      )
      return Number(rows.rows[0]?.ms)
    }

    it('keeps a live hold until the window closes', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }]))
      const closes = new Date(Date.now() + 45 * 60_000)

      expect(await inTransaction((tx) => stretchLiveHold(tx, orderId, closes))).toBe(true)

      expect(await expiryOf(orderId)).toBe(closes.getTime())
      expect(await holdIsLive(testDb(), orderId)).toBe(true)
    })

    it('never revives a lapsed hold — the units may be another buyer\'s by now', async () => {
      await seedProduct(BIKE, 1)
      const lapsed = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, lapsed, [{ productId: BIKE, quantity: 1 }], -1_000))
      const before = await expiryOf(lapsed)

      expect(await holdIsLive(testDb(), lapsed)).toBe(false)
      expect(await inTransaction((tx) => stretchLiveHold(tx, lapsed, new Date(Date.now() + 30 * 60_000)))).toBe(false)

      expect(await expiryOf(lapsed)).toBe(before)
      // The last bike is still free for the next buyer.
      const next = await seedOrder()
      await expect(
        inTransaction((tx) => reserveStock(tx, next, [{ productId: BIKE, quantity: 1 }]))
      ).resolves.toBeUndefined()
    })

    it('never shortens a hold', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await seedOrder({ paymentMethod: 'cod' })
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }], CASH_RESERVATION_TTL_MS))
      const before = await expiryOf(orderId)

      expect(await inTransaction((tx) => stretchLiveHold(tx, orderId, new Date(Date.now() + 30 * 60_000)))).toBe(true)

      expect(await expiryOf(orderId)).toBe(before)
    })

    it('holds nothing for an order whose hold was settled', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }]))
      await inTransaction((tx) => releaseReservations(tx, orderId))

      expect(await holdIsLive(testDb(), orderId)).toBe(false)
      expect(await inTransaction((tx) => stretchLiveHold(tx, orderId, new Date(Date.now() + 30 * 60_000)))).toBe(false)
    })
  })

  /**
   * Just before money is taken over a window that outlives its hold — PayPal's
   * buttons stay payable for as long as the payer likes. The order must hold
   * its units when the money moves: stretched if live, taken up again if they
   * are still free, and otherwise not at all, so the caller takes no money.
   */
  describe('holding the units for a payment', () => {
    const expiryOf = async (orderId: string, productId = BIKE): Promise<number> => {
      const rows = await testDb().execute<{ ms: number }>(
        sql`SELECT (extract(epoch FROM expires_at) * 1000)::float8 AS ms FROM stock_reservations
             WHERE order_id = ${orderId} AND product_id = ${productId}`
      )
      return Number(rows.rows[0]?.ms)
    }

    /** An order for one of each product, holding them for `ttlMs` (negative: lapsed already). */
    async function orderHolding(ttlMs: number, productIds: string[] = [BIKE]): Promise<string> {
      const orderId = await seedOrder({ paymentMethod: 'paypal' })
      await testDb()
        .insert(schema.orderItems)
        .values(
          productIds.map((productId) => ({
            orderId,
            productId,
            sku: productId,
            nameSnapshot: productId,
            unitPriceCents: 95000,
            quantity: 1,
            lineTotalCents: 95000,
          }))
        )
      await inTransaction((tx) =>
        reserveStock(tx, orderId, productIds.map((productId) => ({ productId, quantity: 1 })), ttlMs)
      )
      return orderId
    }

    it('stretches a live hold over the payment, and never shortens it', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await orderHolding(30 * 60_000)
      const before = await expiryOf(orderId)

      expect(await inTransaction((tx) => holdForPayment(tx, orderId, new Date(Date.now() + 10 * 60_000)))).toBe('stretched')
      expect(await expiryOf(orderId)).toBe(before)

      const later = new Date(Date.now() + 45 * 60_000)
      expect(await inTransaction((tx) => holdForPayment(tx, orderId, later))).toBe('stretched')
      expect(await expiryOf(orderId)).toBe(later.getTime())
    })

    it('takes a lapsed hold up again while its units are still free — the same row, not a second', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await orderHolding(-1_000)
      const until = new Date(Date.now() + 10 * 60_000)

      expect(await inTransaction((tx) => holdForPayment(tx, orderId, until))).toBe('retaken')

      expect(await holdIsLive(testDb(), orderId)).toBe(true)
      expect(await expiryOf(orderId)).toBe(until.getTime())
      const rows = await testDb().execute(sql`SELECT id FROM stock_reservations WHERE order_id = ${orderId}`)
      expect(rows.rows).toHaveLength(1)
      // Nobody else can take it now.
      const next = await seedOrder()
      await expect(inTransaction((tx) => reserveStock(tx, next, [{ productId: BIKE, quantity: 1 }]))).rejects.toBeInstanceOf(AppError)
    })

    it('takes up a hold the sweep had already settled', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await orderHolding(-1_000)
      await inTransaction((tx) => expireStaleReservations(tx))
      expect(await holdIsLive(testDb(), orderId)).toBe(false)

      expect(await inTransaction((tx) => holdForPayment(tx, orderId, new Date(Date.now() + 10 * 60_000)))).toBe('retaken')

      expect(await holdIsLive(testDb(), orderId)).toBe(true)
    })

    it('takes up the lapsed line of an order without shortening the line still held', async () => {
      await seedProduct(BIKE, 1)
      await seedProduct(HELMET, 1)
      const orderId = await orderHolding(30 * 60_000, [BIKE, HELMET])
      await testDb().execute(
        sql`UPDATE stock_reservations SET expires_at = NOW() - interval '1 minute' WHERE order_id = ${orderId} AND product_id = ${HELMET}`
      )
      const bikeUntil = await expiryOf(orderId, BIKE)
      const until = new Date(Date.now() + 10 * 60_000)

      expect(await inTransaction((tx) => holdForPayment(tx, orderId, until))).toBe('retaken')

      expect(await expiryOf(orderId, HELMET)).toBe(until.getTime())
      expect(await expiryOf(orderId, BIKE)).toBe(bikeUntil)
      expect(await holdIsLive(testDb(), orderId)).toBe(true)
    })

    it('takes nothing another order holds now, and writes nothing', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await orderHolding(-1_000)
      const before = await expiryOf(orderId)
      const other = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, other, [{ productId: BIKE, quantity: 1 }]))

      expect(await inTransaction((tx) => holdForPayment(tx, orderId, new Date(Date.now() + 10 * 60_000)))).toBe('short')

      expect(await holdIsLive(testDb(), orderId)).toBe(false)
      expect(await expiryOf(orderId)).toBe(before)
      expect(await holdIsLive(testDb(), other)).toBe(true)
    })

    it('takes nothing that is no longer on the shelf', async () => {
      await seedProduct(BIKE, 1)
      const orderId = await orderHolding(-1_000)
      await testDb().execute(sql`UPDATE inventory SET on_hand = 0 WHERE product_id = ${BIKE}`)

      expect(await inTransaction((tx) => holdForPayment(tx, orderId, new Date(Date.now() + 10 * 60_000)))).toBe('short')
      expect(await holdIsLive(testDb(), orderId)).toBe(false)
    })
  })

  describe('setOnHand', () => {
    it('creates the row on first use and updates it after', async () => {
      await inTransaction((tx) => setOnHand(tx, BIKE, 7, 'v20-noir'))
      let availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.onHand).toBe(7)

      await inTransaction((tx) => setOnHand(tx, BIKE, 2))
      availability = await inTransaction((tx) => readAvailability(tx, [BIKE]))
      expect(availability.get(BIKE)?.onHand).toBe(2)
    })

    it('refuses a negative or fractional count', async () => {
      for (const value of [-1, 2.5]) {
        await expect(inTransaction((tx) => setOnHand(tx, BIKE, value))).rejects.toBeInstanceOf(AppError)
      }
    })

    it('bumps the version so a concurrent edit is detectable', async () => {
      await inTransaction((tx) => setOnHand(tx, BIKE, 5))
      await inTransaction((tx) => setOnHand(tx, BIKE, 6))
      const rows = await inTransaction((tx) =>
        tx.execute<{ version: number }>(sql`SELECT version FROM inventory WHERE product_id = ${BIKE}`)
      )
      expect(rows.rows[0]?.version).toBeGreaterThan(1)
    })
  })

  describe('findLowStock', () => {
    it('reports what is sellable, not what is on the shelf', async () => {
      await seedProduct(BIKE, 5)
      await seedProduct(HELMET, 20)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 4 }]))

      const low = await inTransaction((tx) => findLowStock(tx, 2))
      expect(low.map((l) => l.productId)).toEqual([BIKE])
      expect(low[0]).toMatchObject({ onHand: 5, reserved: 4, available: 1 })
    })
  })

  describe('database constraints', () => {
    it('refuses a negative on_hand even by direct SQL', async () => {
      await seedProduct(BIKE, 1)
      await expect(
        inTransaction((tx) =>
          tx.execute(sql`UPDATE inventory SET on_hand = -1 WHERE product_id = ${BIKE}`)
        )
      ).rejects.toThrow()
    })

    it('refuses a second reservation row for the same order and product', async () => {
      await seedProduct(BIKE, 10)
      const orderId = await seedOrder()
      await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }]))

      await expect(
        inTransaction((tx) =>
          tx.insert(schema.stockReservations).values({
            orderId,
            productId: BIKE,
            quantity: 1,
            expiresAt: new Date(Date.now() + 60_000),
          })
        )
      ).rejects.toThrow()
    })

    it('refuses an order whose total does not equal its parts', async () => {
      await expect(
        seedOrder({ subtotalCents: 1000, discountCents: 0, shippingCents: 0, totalCents: 1 })
      ).rejects.toThrow()
    })

    it('refuses a discount larger than the subtotal', async () => {
      await expect(
        seedOrder({ subtotalCents: 1000, discountCents: 2000, shippingCents: 0, totalCents: 0 })
      ).rejects.toThrow()
    })

    it('refuses an order that belongs to nobody', async () => {
      await expect(seedOrder({ guestEmail: null, customerId: null })).rejects.toThrow()
    })

    it('refuses a duplicate idempotency key, so a double click makes one order', async () => {
      const key = 'duplicate-key-test'
      await seedOrder({ idempotencyKey: key })
      await expect(seedOrder({ idempotencyKey: key })).rejects.toThrow()
    })
  })
})
