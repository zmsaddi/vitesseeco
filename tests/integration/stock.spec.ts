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
  consumeReservations,
  expireStaleReservations,
  findLowStock,
  readAvailability,
  releaseReservations,
  reserveStock,
  setOnHand,
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
