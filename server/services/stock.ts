/**
 * Stock.
 *
 * Sellable quantity is `on_hand` minus every live reservation. A reservation is
 * taken while payment is in flight and is settled one of three ways:
 *
 *   consume  payment succeeded — the hold becomes a real decrement of on_hand
 *   release  payment failed, was cancelled, or the customer walked away
 *   expire   nobody told us anything; the sweep gives the units back
 *
 * Three independent release paths exist on purpose. Stripe cannot hold stock
 * for us (manual capture is unsupported on iDEAL, Bancontact and PayPal — the
 * methods our Dutch and Belgian customers use), so a missed webhook must never
 * be able to strand inventory.
 *
 * Every mutation locks the inventory rows with SELECT ... FOR UPDATE in a stable
 * order. Concurrent checkouts for the same product therefore serialise in the
 * database, which is the only place a race can actually be settled.
 */
import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'
import { inventory, stockReservations } from '../db/schema'
import { queryRows, type SqlExecutor, type Transaction } from '../db/client'
import { AppError, ERROR_CODES } from '../../shared/errors'

/** How long a hold survives without news. Long enough for a slow bank redirect. */
export const RESERVATION_TTL_MS = 30 * 60 * 1000

/**
 * `IN (…)` with one bound parameter per value.
 *
 * Interpolating an array directly binds it as a single parameter, which
 * Postgres then rejects as a malformed array literal — and for a one-element
 * array it silently collapses to a scalar. Both are avoided by expanding here.
 */
function inList(values: readonly string[]): SQL {
  return sql`(${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )})`
}

export interface StockLine {
  productId: string
  quantity: number
}

export interface Availability {
  productId: string
  onHand: number
  reserved: number
  available: number
}

export interface ShortfallLine {
  productId: string
  requested: number
  available: number
}

/**
 * Read sellable quantities without locking. For product pages and cart previews
 * — never for deciding whether an order may proceed.
 */
export async function readAvailability(
  executor: SqlExecutor,
  productIds: string[]
): Promise<Map<string, Availability>> {
  const result = new Map<string, Availability>()
  if (productIds.length === 0) return result

  const rows = await queryRows<{ product_id: string; on_hand: number; reserved: string | number }>(
    executor,
    sql`
    SELECT i.product_id,
           i.on_hand,
           COALESCE(SUM(r.quantity) FILTER (
             WHERE r.settled_at IS NULL AND r.expires_at > NOW()
           ), 0) AS reserved
      FROM inventory i
      LEFT JOIN stock_reservations r ON r.product_id = i.product_id
     WHERE i.product_id IN ${inList(productIds)}
     GROUP BY i.product_id, i.on_hand
  `
  )

  for (const row of rows) {
    const reserved = Number(row.reserved)
    result.set(row.product_id, {
      productId: row.product_id,
      onHand: row.on_hand,
      reserved,
      available: row.on_hand - reserved,
    })
  }
  return result
}

/**
 * Place a hold for an order.
 *
 * Must be called inside the same transaction that creates the order, so the
 * order and its hold are durable together or not at all.
 *
 * Throws `OUT_OF_STOCK` carrying every short line, so the customer is told the
 * whole truth in one go rather than discovering it one product at a time.
 */
export async function reserveStock(
  tx: Transaction,
  orderId: string,
  lines: StockLine[],
  ttlMs: number = RESERVATION_TTL_MS
): Promise<void> {
  if (lines.length === 0) return

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
        internal: `reserveStock: quantity must be a positive integer, got ${line.quantity} for ${line.productId}`,
      })
    }
  }

  // One line per product — the caller must aggregate before asking.
  const productIds = [...new Set(lines.map((l) => l.productId))]
  if (productIds.length !== lines.length) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
      internal: 'reserveStock: duplicate product in lines',
    })
  }

  // Lock in a stable order so two concurrent checkouts holding overlapping
  // baskets cannot deadlock by grabbing the same rows in opposite orders.
  const locked = await tx.execute<{ product_id: string; on_hand: number }>(sql`
    SELECT product_id, on_hand
      FROM inventory
     WHERE product_id IN ${inList(productIds)}
     ORDER BY product_id
       FOR UPDATE
  `)

  const onHand = new Map(locked.rows.map((r) => [r.product_id, r.on_hand]))

  const missing = productIds.filter((id) => !onHand.has(id))
  if (missing.length > 0) {
    throw new AppError(ERROR_CODES.OUT_OF_STOCK, {
      details: { unknown: missing },
      internal: `reserveStock: no inventory row for ${missing.join(', ')}`,
    })
  }

  // Reservations are read after the lock, so any competing transaction has
  // either committed its hold or is blocked behind us.
  const held = await tx.execute<{ product_id: string; reserved: string | number }>(sql`
    SELECT product_id, COALESCE(SUM(quantity), 0) AS reserved
      FROM stock_reservations
     WHERE product_id IN ${inList(productIds)}
       AND settled_at IS NULL
       AND expires_at > NOW()
     GROUP BY product_id
  `)
  const reserved = new Map(held.rows.map((r) => [r.product_id, Number(r.reserved)]))

  const shortfalls: ShortfallLine[] = []
  for (const line of lines) {
    const available = (onHand.get(line.productId) ?? 0) - (reserved.get(line.productId) ?? 0)
    if (available < line.quantity) {
      shortfalls.push({ productId: line.productId, requested: line.quantity, available: Math.max(0, available) })
    }
  }
  if (shortfalls.length > 0) {
    throw new AppError(ERROR_CODES.OUT_OF_STOCK, {
      details: { lines: shortfalls },
      internal: `reserveStock: insufficient stock for ${shortfalls.map((s) => s.productId).join(', ')}`,
    })
  }

  const expiresAt = new Date(Date.now() + ttlMs)
  await tx.insert(stockReservations).values(
    lines.map((line) => ({
      orderId,
      productId: line.productId,
      quantity: line.quantity,
      expiresAt,
    }))
  )
}

/**
 * Payment succeeded: turn the holds into a real decrement.
 *
 * Idempotent by construction — it only touches rows that are still unsettled,
 * so a redelivered webhook decrements nothing a second time. Returns the number
 * of lines it actually settled, which the caller can use to tell a genuine
 * first delivery from a replay.
 */
export async function consumeReservations(tx: Transaction, orderId: string): Promise<number> {
  const claimed = await tx.execute<{ product_id: string; quantity: number }>(sql`
    UPDATE stock_reservations
       SET settled_at = NOW()
     WHERE order_id = ${orderId}
       AND settled_at IS NULL
    RETURNING product_id, quantity
  `)

  if (claimed.rows.length === 0) return 0

  // Lock before decrementing, in the same stable order used when reserving.
  const productIds = [...new Set(claimed.rows.map((r) => r.product_id))]
  await tx.execute(sql`
    SELECT product_id FROM inventory
     WHERE product_id IN ${inList(productIds)}
     ORDER BY product_id
       FOR UPDATE
  `)

  for (const row of claimed.rows) {
    // The guard is belt and braces: the hold already proved the units existed,
    // but a manual stock edit could have removed them in the meantime, and
    // on_hand must never go negative.
    const updated = await tx.execute(sql`
      UPDATE inventory
         SET on_hand = on_hand - ${row.quantity},
             version = version + 1,
             updated_at = NOW()
       WHERE product_id = ${row.product_id}
         AND on_hand >= ${row.quantity}
      RETURNING product_id
    `)
    if (updated.rows.length === 0) {
      throw new AppError(ERROR_CODES.OUT_OF_STOCK, {
        internal:
          `consumeReservations: on_hand for ${row.product_id} fell below the reserved ` +
          `${row.quantity} before capture — stock was edited during payment`,
      })
    }
  }

  return claimed.rows.length
}

/**
 * Give the units back. Used when payment fails, when the customer cancels, and
 * when an order is cancelled in the admin panel.
 *
 * Idempotent for the same reason as `consumeReservations`: a second call finds
 * nothing unsettled and changes nothing, so stock cannot be credited twice.
 */
export async function releaseReservations(tx: Transaction, orderId: string): Promise<number> {
  const released = await tx
    .update(stockReservations)
    .set({ settledAt: new Date() })
    .where(and(eq(stockReservations.orderId, orderId), isNull(stockReservations.settledAt)))
    .returning({ id: stockReservations.id })
  return released.length
}

/**
 * Settle holds nobody ever came back for.
 *
 * Expired reservations already stop counting against availability the moment
 * they expire — the queries filter on `expires_at > NOW()` — so this is
 * housekeeping, not correctness. It keeps the table small and the live-hold
 * index selective.
 */
export async function expireStaleReservations(tx: Transaction, limit = 500): Promise<number> {
  const expired = await tx.execute<{ id: string }>(sql`
    UPDATE stock_reservations
       SET settled_at = NOW()
     WHERE id IN (
       SELECT id FROM stock_reservations
        WHERE settled_at IS NULL
          AND expires_at <= NOW()
        ORDER BY expires_at
        LIMIT ${limit}
     )
    RETURNING id
  `)
  return expired.rows.length
}

/** Admin correction. Absolute value, never a delta, and never negative. */
export async function setOnHand(
  tx: Transaction,
  productId: string,
  onHandValue: number,
  sku?: string | null
): Promise<void> {
  if (!Number.isInteger(onHandValue) || onHandValue < 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
      internal: `setOnHand: expected a non-negative integer, got ${onHandValue}`,
    })
  }
  await tx
    .insert(inventory)
    .values({ productId, sku: sku ?? null, onHand: onHandValue, version: 1 })
    .onConflictDoUpdate({
      target: inventory.productId,
      set: {
        onHand: onHandValue,
        version: sql`${inventory.version} + 1`,
        updatedAt: new Date(),
        ...(sku !== undefined ? { sku: sku ?? null } : {}),
      },
    })
}

/** Products whose sellable quantity has fallen to or below a threshold. */
export async function findLowStock(
  executor: SqlExecutor,
  threshold: number
): Promise<Availability[]> {
  const rows = await queryRows<{ product_id: string; on_hand: number; reserved: string | number }>(
    executor,
    sql`
    SELECT i.product_id,
           i.on_hand,
           COALESCE(SUM(r.quantity) FILTER (
             WHERE r.settled_at IS NULL AND r.expires_at > NOW()
           ), 0) AS reserved
      FROM inventory i
      LEFT JOIN stock_reservations r ON r.product_id = i.product_id
     GROUP BY i.product_id, i.on_hand
    HAVING i.on_hand - COALESCE(SUM(r.quantity) FILTER (
             WHERE r.settled_at IS NULL AND r.expires_at > NOW()
           ), 0) <= ${threshold}
     ORDER BY 3 DESC
  `
  )
  return rows.map((row) => {
    const reservedCount = Number(row.reserved)
    return {
      productId: row.product_id,
      onHand: row.on_hand,
      reserved: reservedCount,
      available: row.on_hand - reservedCount,
    }
  })
}

/** Convenience for callers that only need to know whether a basket fits. */
export function shortfallsFor(
  availability: Map<string, Availability>,
  lines: StockLine[]
): ShortfallLine[] {
  const shortfalls: ShortfallLine[] = []
  for (const line of lines) {
    const available = availability.get(line.productId)?.available ?? 0
    if (available < line.quantity) {
      shortfalls.push({ productId: line.productId, requested: line.quantity, available: Math.max(0, available) })
    }
  }
  return shortfalls
}
