/**
 * Order transitions against a real database.
 *
 * These prove the two properties that decide whether stock stays honest:
 * a transition settles its stock exactly once, and a repeated or racing
 * transition settles nothing.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { transitionOrder } from '../../server/services/orders'
import { readAvailability, reserveStock } from '../../server/services/stock'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { closePool, hasDatabase, inTransaction, resetDatabase, seedOrder, seedProduct, testDb } from './setup'

const BIKE = 'product-v20-noir'

/** An order that already holds stock, as a real one does the moment it exists. */
async function orderHolding(quantity: number, overrides = {}) {
  const orderId = await seedOrder({ status: 'awaiting_payment', ...overrides })
  await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity }]))
  const rows = await testDb().execute<{ order_number: string }>(
    sql`SELECT order_number FROM orders WHERE id = ${orderId}`
  )
  return { orderId, orderNumber: rows.rows[0]?.order_number as string }
}

async function statusOf(orderNumber: string): Promise<string> {
  const rows = await testDb().execute<{ status: string }>(
    sql`SELECT status FROM orders WHERE order_number = ${orderNumber}`
  )
  return rows.rows[0]?.status as string
}

async function available(): Promise<number> {
  const rows = await readAvailability(testDb(), [BIKE])
  return rows.get(BIKE)?.available ?? 0
}

async function onHand(): Promise<number> {
  const rows = await readAvailability(testDb(), [BIKE])
  return rows.get(BIKE)?.onHand ?? 0
}

describe.skipIf(!hasDatabase)('order lifecycle', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
    await seedProduct(BIKE, 10)
  })

  describe('payment', () => {
    it('consumes the stock hold exactly once', async () => {
      const { orderNumber } = await orderHolding(2)
      expect(await onHand()).toBe(10)
      expect(await available()).toBe(8)

      const result = await transitionOrder(orderNumber, 'paid')
      expect(result.changed).toBe(true)
      expect(await onHand()).toBe(8)
      expect(await available()).toBe(8)
    })

    it('is a no-op when the event is redelivered', async () => {
      // Stripe retries for three days. The second delivery must change nothing.
      const { orderNumber } = await orderHolding(2)
      await transitionOrder(orderNumber, 'paid')

      const replay = await transitionOrder(orderNumber, 'paid')
      expect(replay.changed).toBe(false)
      expect(await onHand()).toBe(8)
    })

    it('does not resurrect an order that has already shipped', async () => {
      const { orderNumber } = await orderHolding(1)
      await transitionOrder(orderNumber, 'paid')
      await transitionOrder(orderNumber, 'processing')
      await transitionOrder(orderNumber, 'shipped')

      // A late webhook for an order already on the van.
      const late = await transitionOrder(orderNumber, 'paid', { expectFrom: 'awaiting_payment' })
      expect(late.changed).toBe(false)
      expect(await statusOf(orderNumber)).toBe('shipped')
    })

    it('settles once when two webhooks arrive together', async () => {
      const { orderNumber } = await orderHolding(3)

      const results = await Promise.allSettled([
        transitionOrder(orderNumber, 'paid'),
        transitionOrder(orderNumber, 'paid'),
      ])
      const changes = results.filter((r) => r.status === 'fulfilled' && r.value.changed)

      expect(changes).toHaveLength(1)
      expect(await onHand()).toBe(7)
    })

    it('stamps the moment it was paid', async () => {
      const { orderNumber } = await orderHolding(1)
      await transitionOrder(orderNumber, 'paid')
      const rows = await testDb().execute<{ paid_at: string | null }>(
        sql`SELECT paid_at FROM orders WHERE order_number = ${orderNumber}`
      )
      expect(rows.rows[0]?.paid_at).not.toBeNull()
    })
  })

  describe('cancellation', () => {
    it('gives the units back when payment never happened', async () => {
      const { orderNumber } = await orderHolding(4)
      expect(await available()).toBe(6)

      await transitionOrder(orderNumber, 'cancelled')
      expect(await available()).toBe(10)
      expect(await onHand()).toBe(10)
    })

    it('gives the units back after payment, without crediting twice', async () => {
      const { orderNumber } = await orderHolding(4)
      await transitionOrder(orderNumber, 'paid')
      expect(await onHand()).toBe(6)

      await transitionOrder(orderNumber, 'cancelled')
      // The hold was already consumed at payment, so cancelling restores
      // nothing a second time — the units left with the sale.
      expect(await onHand()).toBe(6)
    })

    it('is a no-op when cancelled twice', async () => {
      const { orderNumber } = await orderHolding(2)
      expect((await transitionOrder(orderNumber, 'cancelled')).changed).toBe(true)
      expect((await transitionOrder(orderNumber, 'cancelled')).changed).toBe(false)
      expect(await available()).toBe(10)
    })

    it('refuses to cancel an order that has shipped', async () => {
      const { orderNumber } = await orderHolding(1)
      await transitionOrder(orderNumber, 'paid')
      await transitionOrder(orderNumber, 'processing')
      await transitionOrder(orderNumber, 'shipped')

      const error = await transitionOrder(orderNumber, 'cancelled').catch((e: unknown) => e)
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION)
    })

    it('frees stock for the next buyer', async () => {
      await resetDatabase()
      await seedProduct(BIKE, 1)
      const first = await orderHolding(1)
      const second = await seedOrder({ status: 'awaiting_payment' })

      // The last unit is held, so nobody else can take it.
      await expect(
        inTransaction((tx) => reserveStock(tx, second, [{ productId: BIKE, quantity: 1 }]))
      ).rejects.toBeInstanceOf(AppError)

      await transitionOrder(first.orderNumber, 'cancelled')

      await expect(
        inTransaction((tx) => reserveStock(tx, second, [{ productId: BIKE, quantity: 1 }]))
      ).resolves.toBeUndefined()
    })
  })

  describe('guards', () => {
    it('refuses to skip payment', async () => {
      const { orderNumber } = await orderHolding(1)
      await expect(transitionOrder(orderNumber, 'shipped')).rejects.toBeInstanceOf(AppError)
      expect(await statusOf(orderNumber)).toBe('awaiting_payment')
    })

    it('does nothing when the expected starting status does not match', async () => {
      const { orderNumber } = await orderHolding(1)
      await transitionOrder(orderNumber, 'paid')

      const result = await transitionOrder(orderNumber, 'cancelled', { expectFrom: 'awaiting_payment' })
      expect(result.changed).toBe(false)
      expect(await statusOf(orderNumber)).toBe('paid')
    })

    it('reports an unknown order rather than failing quietly', async () => {
      const error = await transitionOrder('ORD-DOESNOTEXIST', 'paid').catch((e: unknown) => e)
      expect((error as AppError).code).toBe(ERROR_CODES.NOT_FOUND)
    })
  })
})
