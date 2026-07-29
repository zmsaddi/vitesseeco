/**
 * Integration-test harness.
 *
 * These tests run against a REAL Postgres, because the behaviour under test is
 * the database's: row locks, unique constraints, check constraints and how two
 * concurrent transactions settle a race. A mock would only prove that our mock
 * behaves like our mock.
 *
 * The driver here is node-postgres rather than Neon's, so the suite runs against
 * any ordinary Postgres — a service container in CI, or a local instance. The
 * SQL is identical; only the transport differs.
 *
 * Set TEST_DATABASE_URL to a scratch database. A URL that looks like production
 * is refused outright, because the suite truncates tables.
 */
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import * as schema from '../../server/db/schema'
import type { Transaction } from '../../server/db/client'

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? ''

/** Integration tests skip rather than fail when no scratch database is configured. */
export const hasDatabase = TEST_DATABASE_URL.length > 0

function assertSafeTarget(url: string): void {
  const lowered = url.toLowerCase()
  const isLocal = lowered.includes('localhost') || lowered.includes('127.0.0.1')
  const namedTest = /\/[^/?]*test/.test(lowered)
  if (!isLocal && !namedTest) {
    throw new Error(
      'TEST_DATABASE_URL does not look like a scratch database. This suite truncates tables — ' +
        'point it at localhost or at a database whose name contains "test".'
    )
  }
}

let sharedPool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!sharedPool) {
    assertSafeTarget(TEST_DATABASE_URL)
    // Several connections, because the concurrency cases genuinely run in
    // parallel and a single-connection pool would serialise them into passing.
    sharedPool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 12 })
  }
  return sharedPool
}

/**
 * The shared database handle. Also what services under test receive, so they
 * exercise the same driver the suite uses — the rate limiter reaching for a
 * hardwired Neon client instead of accepting one is exactly the coupling these
 * tests caught.
 */
export function testDb() {
  return drizzle(getPool(), { schema })
}

const client = testDb

/** Run work in a transaction against the scratch database. */
export async function inTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  return client().transaction(async (tx) => work(tx as unknown as Transaction))
}

/** Wipe every table. CASCADE handles the graph, so order does not matter. */
export async function resetDatabase(): Promise<void> {
  await client().execute(sql`
    TRUNCATE TABLE
      stock_reservations, order_items, promo_redemptions, orders,
      inventory, sessions, oauth_identities, addresses, customers,
      webhook_events, contact_messages, rate_limits, audit_log, events
    RESTART IDENTITY CASCADE
  `)
}

export async function closePool(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end()
    sharedPool = null
  }
}

/** Seed one inventory row. */
export async function seedProduct(productId: string, onHand: number, sku?: string): Promise<void> {
  await client()
    .insert(schema.inventory)
    .values({ productId, onHand, sku: sku ?? productId })
    .onConflictDoUpdate({ target: schema.inventory.productId, set: { onHand } })
}

let orderSequence = 0

/**
 * Seed a minimal order. Money is consistent by construction so the check
 * constraints pass — these tests are about stock, not pricing.
 */
export async function seedOrder(
  overrides: Partial<typeof schema.orders.$inferInsert> = {}
): Promise<string> {
  orderSequence++
  const subtotal = overrides.subtotalCents ?? 95000
  const discount = overrides.discountCents ?? 0
  const shipping = overrides.shippingCents ?? 0

  const [row] = await client()
    .insert(schema.orders)
    .values({
      orderNumber: `ORD-TEST${String(orderSequence).padStart(5, '0')}`,
      idempotencyKey: `key-${orderSequence}-${Math.random().toString(36).slice(2)}`,
      guestEmail: 'guest@example.com',
      shippingMethodCode: 'pickup',
      paymentMethod: 'stripe',
      subtotalCents: subtotal,
      discountCents: discount,
      shippingCents: shipping,
      totalCents: subtotal - discount + shipping,
      ...overrides,
    })
    .returning({ id: schema.orders.id })

  if (!row) throw new Error('seedOrder: insert returned no row')
  return row.id
}

export { schema }
