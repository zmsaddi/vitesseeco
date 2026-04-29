/**
 * Stock service — PG-primary inventory operations (P0-13, ADR-001).
 *
 * Owns SELECT … FOR UPDATE semantics. Used by orders/create.post.ts inside
 * the order transaction so that concurrent requests for the same SKU are
 * serialized by the database and oversell becomes impossible.
 */

import { sql } from 'drizzle-orm'
import { inventory } from '~/server/database/schema'

export interface StockItem {
  productId: string
  sku?: string
  quantity: number
}

export interface StockCheckResult {
  ok: boolean
  insufficient?: Array<{ productId: string; requested: number; available: number }>
  notFound?: string[]
}

/**
 * Lock and decrement inventory rows in one shot. Caller must already be
 * inside a PG transaction (`db.transaction(async tx => ...)`) so the locks
 * are released atomically when the order insert commits or rolls back.
 *
 * Algorithm:
 *   1. SELECT FOR UPDATE the rows for every requested product. This blocks
 *      other transactions trying to lock the same rows until we commit/rollback.
 *   2. Compare requested quantity to available stock for each row.
 *   3. If any row is insufficient or missing, return ok=false with details.
 *      The caller should rollback the transaction (which releases the locks).
 *   4. Otherwise UPDATE each row to decrement stock and bump version.
 *
 * Returns ok=true on success. The decrement happens inline.
 */
export async function lockAndDecrement(
  tx: any,
  items: StockItem[]
): Promise<StockCheckResult> {
  if (items.length === 0) return { ok: true }

  const productIds = [...new Set(items.map((i) => i.productId))]

  // Step 1: SELECT FOR UPDATE all relevant rows. Order by product_id to keep
  // a stable lock order across requests and avoid deadlocks.
  // Using raw SQL for the FOR UPDATE clause (drizzle's query builder has
  // limited support for it across versions — this is the most portable form).
  const rows: Array<{ product_id: string; stock: number }> = await tx.execute(
    sql`
      SELECT product_id, stock
      FROM inventory
      WHERE product_id = ANY(${productIds})
      ORDER BY product_id
      FOR UPDATE
    `
  ).then((r: any) => r.rows ?? r)

  const stockMap = new Map<string, number>(rows.map((r) => [r.product_id, r.stock]))

  // Step 2 & 3: validate every requested item against the locked snapshot.
  const insufficient: Array<{ productId: string; requested: number; available: number }> = []
  const notFound: string[] = []
  // Aggregate quantity per product in case the cart has duplicates.
  const requestedByProduct = new Map<string, number>()
  for (const item of items) {
    requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity)
  }

  for (const [pid, requested] of requestedByProduct) {
    if (!stockMap.has(pid)) {
      notFound.push(pid)
      continue
    }
    const available = stockMap.get(pid) ?? 0
    if (available < requested) {
      insufficient.push({ productId: pid, requested, available })
    }
  }

  if (insufficient.length > 0 || notFound.length > 0) {
    return { ok: false, insufficient: insufficient.length ? insufficient : undefined, notFound: notFound.length ? notFound : undefined }
  }

  // Step 4: decrement.
  for (const [pid, requested] of requestedByProduct) {
    await tx.execute(
      sql`
        UPDATE inventory
        SET stock = stock - ${requested},
            version = version + 1,
            updated_at = NOW()
        WHERE product_id = ${pid}
      `
    )
  }

  return { ok: true }
}

/**
 * Compensating increment, used if the order is rolled back AFTER the
 * transaction has committed but before downstream side-effects (e.g.,
 * payment capture failure in a future Stripe flow). Phase 0 does not call
 * this directly — the row lock + transaction rollback covers the in-flight
 * failure case. Reserved for future use.
 */
export async function increment(
  tx: any,
  items: StockItem[]
): Promise<void> {
  for (const item of items) {
    await tx.execute(
      sql`
        UPDATE inventory
        SET stock = stock + ${item.quantity},
            version = version + 1,
            updated_at = NOW()
        WHERE product_id = ${item.productId}
      `
    )
  }
}

/**
 * Read current stock without locking. Safe for previews / non-checkout reads.
 */
export async function readStock(
  tx: any,
  productIds: string[]
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map()
  const rows: Array<{ product_id: string; stock: number }> = await tx.execute(
    sql`SELECT product_id, stock FROM inventory WHERE product_id = ANY(${productIds})`
  ).then((r: any) => r.rows ?? r)
  return new Map(rows.map((r) => [r.product_id, r.stock]))
}
