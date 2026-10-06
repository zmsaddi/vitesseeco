/**
 * Placing an order, against a real database.
 *
 * The property under test is that a REFUSED order leaves nothing behind.
 *
 * The payment rules — a cash ceiling, a country restriction — can only be
 * checked against the real total, and the total exists only once the basket is
 * priced. That sequencing was used as a reason to check them in the route,
 * AFTER placeOrder had already returned. So a refused method answered 400
 * having written the order, its lines, its stock hold and its promotion
 * redemption, and the hold sat on the shelf until the sweep collected it an
 * hour later. Refusing a sale must not cost the shop a bike for an hour.
 *
 * Only the catalogue is stubbed here — it is a network read of someone else's
 * service. The database is real, which is the whole point: the assertion is
 * that the tables are empty, not that a function was not called.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { AppError } from '../../shared/errors'
import { closePool, hasDatabase, inTransaction, resetDatabase, seedProduct, testDb } from './setup'

const BIKE = 'product-v20-noir'
/** Unpublished in the panel: the catalogue still knows its name, and no longer sells it. */
const HIDDEN = 'product-cargo-vert'
/** Deleted from the Studio: nothing is left to name it with. */
const DELETED = 'product-retired-2025'

vi.mock('../../server/catalog', () => ({
  getProductsByIds: async (ids: string[]) =>
    new Map(
      ids.includes(BIKE)
        ? [
            [
              BIKE,
              {
                id: BIKE,
                slug: 'v20-pro-noir',
                name: 'V20 Pro — Noir',
                color: 'Noir',
                image: null,
                price: 95000,
                compareAtPrice: null,
                sku: BIKE,
              },
            ],
          ]
        : []
    ),
  getProductNames: async (ids: string[]) =>
    new Map(
      [
        [BIKE, 'V20 Pro — Noir'],
        [HIDDEN, 'Cargo — Vert'],
      ].filter(([id]) => ids.includes(id as string)) as Array<[string, string]>
    ),
  getPromo: async () => null,
  shippingMethodsFor: async () => [
    { code: 'own-fleet-fr', name: 'Livraison', price: 0, freeAbove: null, estimatedDays: null },
  ],
}))

// Imported after the stub above is registered by vitest's hoisting, and after
// ./setup has pointed the production accessor at the scratch database.
const { placeOrder } = await import('../../server/services/orders')


async function countOf(table: 'orders' | 'order_items' | 'stock_reservations'): Promise<number> {
  const rows = await testDb().execute<{ count: string }>(
    sql`SELECT COUNT(*)::text AS count FROM ${sql.raw(table)}`
  )
  return Number(rows.rows[0]?.count ?? '0')
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    lines: [{ productId: BIKE, quantity: 1 }],
    locale: 'fr' as const,
    paymentMethod: 'stripe' as const,
    shipping: { methodCode: 'own-fleet-fr', country: 'FR', postalCode: '86000' },
    idempotencyKey: crypto.randomUUID(),
    customer: null,
    guestEmail: 'guest@example.com',
    firstName: 'Sim',
    lastName: 'Client',
    phone: '+33745830049',
    runTransaction: inTransaction,
    read: testDb(),
    ...overrides,
  }
}

describe.skipIf(!hasDatabase)('placing an order', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
    await seedProduct(BIKE, 5)
  })

  it('writes the order, its line and its hold when the method is allowed', async () => {
    const placed = await placeOrder(order() as never)

    expect(placed.orderNumber).toMatch(/^ORD-/)
    expect(await countOf('orders')).toBe(1)
    expect(await countOf('order_items')).toBe(1)
    expect(await countOf('stock_reservations')).toBe(1)
  })

  it('leaves no order, no line and no stock hold when the method is refused', async () => {
    // Cash on delivery is offered in Belgium and the Netherlands, never France.
    await expect(placeOrder(order({ paymentMethod: 'cod' }) as never)).rejects.toThrow()

    expect(await countOf('orders')).toBe(0)
    expect(await countOf('order_items')).toBe(0)
    expect(await countOf('stock_reservations')).toBe(0)
  })

  it('leaves the shelf untouched when the method is refused', async () => {
    // The consequence the shop feels: a hold taken by a request that was then
    // rejected still makes the bike unsellable to the next customer.
    await expect(placeOrder(order({ paymentMethod: 'cod' }) as never)).rejects.toThrow()

    const rows = await testDb().execute<{ on_hand: number }>(
      sql`SELECT on_hand FROM inventory WHERE product_id = ${BIKE}`
    )
    expect(rows.rows[0]?.on_hand).toBe(5)
  })

  it('refuses a basket holding products that left the catalogue, and says which', async () => {
    // One unpublished bike used to turn the whole basket into "Introuvable.":
    // the refusal was a NOT_FOUND whose details never reached the browser, so
    // the page could neither show the basket nor say which line was at fault.
    const error = await placeOrder(
      order({
        lines: [
          { productId: BIKE, quantity: 1 },
          { productId: HIDDEN, quantity: 1 },
          { productId: DELETED, quantity: 1 },
        ],
      }) as never
    ).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AppError)
    // Exactly what the browser receives.
    expect((error as AppError).toPublic()).toEqual({
      code: 'PRODUCT_UNAVAILABLE',
      messageKey: 'errors.product_unavailable',
      details: {
        unavailable: [
          { productId: HIDDEN, name: 'Cargo — Vert' },
          { productId: DELETED, name: null },
        ],
      },
    })
    expect(await countOf('orders')).toBe(0)
    expect(await countOf('stock_reservations')).toBe(0)
  })

  it('resolves a repeated key to the one order, rather than a second', async () => {
    // What keeps a double-clicked pay button, a retry and a lost response from
    // becoming three orders and three holds for one basket.
    const idempotencyKey = crypto.randomUUID()
    const first = await placeOrder(order({ idempotencyKey }) as never)
    const second = await placeOrder(order({ idempotencyKey }) as never)

    expect(second.orderNumber).toBe(first.orderNumber)
    expect(await countOf('orders')).toBe(1)
    expect(await countOf('stock_reservations')).toBe(1)
  })
})
