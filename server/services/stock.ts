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
import { ONLINE_HOLD_MS } from '../../shared/holds'

/**
 * How long a hold survives without news. Long enough for a slow bank redirect.
 * Defined in shared/holds.ts, because the checkout page times its purchase key
 * by it too.
 */
export const RESERVATION_TTL_MS = ONLINE_HOLD_MS

/**
 * How long a hold lasts when nobody is going to pay online.
 *
 * A cash-on-delivery order is an agreed sale waiting for a van, not a basket
 * somebody wandered away from. On the online TTL its hold expired after half an
 * hour, the bike went back on sale while a customer was waiting for it, and the
 * sweep then settled the dead hold — so when the driver finally collected the
 * money, `consumeReservations` found nothing to consume and `on_hand` was never
 * decremented. The bike left the building and Postgres kept counting it, for
 * every cash and counter sale ever made.
 */
export const CASH_RESERVATION_TTL_MS = 14 * 24 * 60 * 60 * 1000

/** A hold ending within this many seconds is one an online payment can still release. */
const BRIEF_HOLD_SECONDS = RESERVATION_TTL_MS / 1000 + 60

/**
 * Put units back on the shelf for an order whose hold has already been consumed.
 *
 * `releaseReservations` settles a live hold; once payment has turned that hold
 * into a decrement there is nothing left to settle, so cancelling a PAID order
 * refunded the customer and never returned the bike to stock. This is the other
 * direction, and it reads the order's own line items because the reservation
 * rows are gone by then.
 */
export async function restockOrder(tx: Transaction, orderId: string): Promise<number> {
  // Locked first, in product order, like every other writer of these rows: an
  // UPDATE … FROM locks in join order, and two transactions taking the same
  // rows in different orders deadlock.
  await tx.execute(sql`
    SELECT product_id FROM inventory
     WHERE product_id IN (SELECT product_id FROM order_items WHERE order_id = ${orderId})
     ORDER BY product_id
       FOR UPDATE
  `)
  const restocked = await tx.execute<{ product_id: string; quantity: number }>(sql`
    UPDATE inventory AS i
       SET on_hand = i.on_hand + oi.quantity,
           version = i.version + 1,
           updated_at = NOW()
      FROM order_items AS oi
     WHERE oi.order_id = ${orderId}
       AND i.product_id = oi.product_id
    RETURNING i.product_id, oi.quantity
  `)
  return restocked.rows.length
}

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
  //
  // `outlasting` is the part of those holds still standing once an online
  // payment's window has passed: cash-on-delivery and counter orders, held for
  // fourteen days and never swept. A minute of slack, because expires_at is
  // stamped by the application's clock and NOW() is the database's.
  const held = await tx.execute<{
    product_id: string
    reserved: string | number
    outlasting: string | number
  }>(sql`
    SELECT product_id,
           COALESCE(SUM(quantity), 0) AS reserved,
           COALESCE(SUM(quantity) FILTER (
             WHERE expires_at > NOW() + ${sql.raw(`INTERVAL '${BRIEF_HOLD_SECONDS} seconds'`)}
           ), 0) AS outlasting
      FROM stock_reservations
     WHERE product_id IN ${inList(productIds)}
       AND settled_at IS NULL
       AND expires_at > NOW()
     GROUP BY product_id
  `)
  const reserved = new Map(held.rows.map((r) => [r.product_id, Number(r.reserved)]))
  const outlasting = new Map(held.rows.map((r) => [r.product_id, Number(r.outlasting)]))

  const shortfalls: ShortfallLine[] = []
  for (const line of lines) {
    const available = (onHand.get(line.productId) ?? 0) - (reserved.get(line.productId) ?? 0)
    if (available < line.quantity) {
      shortfalls.push({ productId: line.productId, requested: line.quantity, available: Math.max(0, available) })
    }
  }
  if (shortfalls.length > 0) {
    // Two different truths share this code: an empty shelf, and a full shelf
    // whose last units sit in holds for payments still in progress. The second
    // is told as "briefly reserved, try again shortly" — telling that customer
    // "out of stock" sends them to a competitor over a wait of minutes.
    //
    // Only a hold that ends within an online payment's window is brief. Every
    // live hold used to count, so the last bike held for a cash-on-delivery
    // order — fourteen days, and in practice sold — had the next customer told
    // to come back in a few minutes, again and again.
    const merelyReserved = shortfalls.every(
      (s) => (onHand.get(s.productId) ?? 0) - (outlasting.get(s.productId) ?? 0) >= s.requested
    )
    throw new AppError(ERROR_CODES.OUT_OF_STOCK, {
      details: { lines: shortfalls },
      ...(merelyReserved ? { messageKey: 'errors.stock_reserved' } : {}),
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
 * Whether an order's stock hold is still live.
 *
 * An order's holds are written together with one expiry and stretched together
 * (`stretchLiveHold`), so they live and lapse as one: the hold is live when the
 * order has unsettled holds and none of them has expired.
 */
export async function holdIsLive(executor: SqlExecutor, orderId: string): Promise<boolean> {
  const [row] = await queryRows<{ unsettled: number; live: number }>(
    executor,
    sql`
    SELECT count(*)::int AS unsettled,
           count(*) FILTER (WHERE expires_at > NOW())::int AS live
      FROM stock_reservations
     WHERE order_id = ${orderId}
       AND settled_at IS NULL
  `
  )
  return !!row && row.unsettled > 0 && row.live === row.unsettled
}

/**
 * Keep an order's LIVE hold for as long as a payment window opened over it.
 *
 * Stripe opens no Checkout Session for less than thirty minutes, and the hold
 * was taken when the order was placed — so a session opened even a minute later
 * stayed payable after its hold had lapsed, when the units could already be
 * someone else's. Stretching a live hold takes nothing from anyone: those units
 * are already this order's. A lapsed hold is never revived here — another
 * customer may hold the units now — so the answer is false, the caller opens no
 * payment, and the customer starts again with a fresh order, which reserves the
 * ordinary way, through `reserveStock`.
 *
 * Never shortens a hold. The inventory rows are locked first, in the same stable
 * order as every other writer, and liveness is judged on the clock rather than
 * on NOW(): NOW() is when this transaction began, and a hold that lapsed while
 * the locks were awaited is one another checkout may already have counted free.
 */
export async function stretchLiveHold(tx: Transaction, orderId: string, until: Date): Promise<boolean> {
  const held = await tx.execute<{ product_id: string }>(sql`
    SELECT product_id
      FROM stock_reservations
     WHERE order_id = ${orderId}
       AND settled_at IS NULL
  `)
  if (held.rows.length === 0) return false

  await tx.execute(sql`
    SELECT product_id FROM inventory
     WHERE product_id IN ${inList([...new Set(held.rows.map((row) => row.product_id))])}
     ORDER BY product_id
       FOR UPDATE
  `)

  // Judged once, under the locks: from here on no other checkout can count
  // these units, so a hold found live is still this order's when stretched.
  const lapsed = await tx.execute(sql`
    SELECT 1
      FROM stock_reservations
     WHERE order_id = ${orderId}
       AND settled_at IS NULL
       AND expires_at <= clock_timestamp()
     LIMIT 1
  `)
  if (lapsed.rows.length > 0) return false

  const stretched = await tx.execute(sql`
    UPDATE stock_reservations
       SET expires_at = GREATEST(expires_at, ${until.toISOString()}::timestamptz)
     WHERE order_id = ${orderId}
       AND settled_at IS NULL
    RETURNING id
  `)
  // One settled meanwhile (the sweep's housekeeping) means the order no longer
  // holds everything it ordered.
  return stretched.rows.length === held.rows.length
}

/**
 * Make sure an order holds every unit it ordered until `until` — asked just
 * before money is taken for it, where the payment window can outlive the hold.
 *
 * The PayPal bridge is that case: its buttons stay payable long after a
 * thirty-minute hold has lapsed, and a capture over a lapsed hold sold a bike
 * another customer had bought meanwhile — takeStockForLatePayment then found
 * nothing left to take. So, under the inventory locks:
 *
 *   stretched  the hold is live; it now lasts until `until` (never shortened)
 *   retaken    it had lapsed, or the sweep had settled it, and every unit was
 *              still free — on hand, less what OTHER orders hold live — so the
 *              units are this order's again until `until`
 *   short      a unit is no longer free; nothing is written, and the money
 *              must not be taken
 *
 * Never takes a unit another order holds. This order's own hold is judged on
 * the clock, as in stretchLiveHold — one that lapsed while the locks were
 * awaited may already have been counted free by another checkout — and other
 * orders' holds are counted exactly as reserveStock counts them, so a re-take
 * is what a fresh order would have been allowed, no more. The caller holds the
 * order's row (services/orders.ts), so the order cannot be paid or cancelled
 * while this decides.
 */
export async function holdForPayment(
  tx: Transaction,
  orderId: string,
  until: Date
): Promise<'stretched' | 'retaken' | 'short'> {
  const ordered = await tx.execute<{ product_id: string; quantity: number }>(sql`
    SELECT product_id, SUM(quantity)::int AS quantity
      FROM order_items
     WHERE order_id = ${orderId}
     GROUP BY product_id
  `)
  const wanted = new Map(ordered.rows.map((row) => [row.product_id, Number(row.quantity)]))
  const productIds = [...wanted.keys()].sort()
  if (productIds.length === 0) return 'stretched'

  const locked = await tx.execute<{ product_id: string; on_hand: number }>(sql`
    SELECT product_id, on_hand FROM inventory
     WHERE product_id IN ${inList(productIds)}
     ORDER BY product_id
       FOR UPDATE
  `)
  const onHand = new Map(locked.rows.map((row) => [row.product_id, Number(row.on_hand)]))

  // Judged once, under the locks: from here on no other checkout can count
  // these units, so a hold found live is still this order's when stretched.
  const own = await tx.execute<{ id: string; product_id: string; quantity: number }>(sql`
    SELECT id, product_id, quantity
      FROM stock_reservations
     WHERE order_id = ${orderId}
       AND settled_at IS NULL
       AND expires_at > clock_timestamp()
  `)
  const live = new Map<string, number>()
  for (const row of own.rows) live.set(row.product_id, (live.get(row.product_id) ?? 0) + Number(row.quantity))
  if (productIds.every((id) => (live.get(id) ?? 0) >= wanted.get(id)!)) {
    const stretched = await tx.execute(sql`
      UPDATE stock_reservations
         SET expires_at = GREATEST(expires_at, ${until.toISOString()}::timestamptz)
       WHERE id IN ${inList(own.rows.map((row) => row.id))}
         AND settled_at IS NULL
      RETURNING id
    `)
    // One settled meanwhile (the sweep's housekeeping, on a hold that lapsed a
    // moment ago) is taken again below, like any lapsed hold.
    if (stretched.rows.length === own.rows.length) return 'stretched'
  }

  const others = await tx.execute<{ product_id: string; held: number }>(sql`
    SELECT product_id, SUM(quantity)::int AS held
      FROM stock_reservations
     WHERE product_id IN ${inList(productIds)}
       AND order_id <> ${orderId}
       AND settled_at IS NULL
       AND expires_at > NOW()
     GROUP BY product_id
  `)
  const heldByOthers = new Map(others.rows.map((row) => [row.product_id, Number(row.held)]))
  for (const productId of productIds) {
    const shelf = onHand.get(productId)
    // No inventory row: reserveStock refuses such a product, and so does this.
    if (shelf === undefined) return 'short'
    if (shelf - (heldByOthers.get(productId) ?? 0) < wanted.get(productId)!) return 'short'
  }

  // The units are this order's again. An order has one hold row per product
  // for life, so the lapsed (or swept) row is taken up again rather than
  // joined by a second; a hold never decremented anything, so nothing else
  // moves. A line still held live keeps the later of its two expiries.
  await tx
    .insert(stockReservations)
    .values(productIds.map((productId) => ({ orderId, productId, quantity: wanted.get(productId)!, expiresAt: until })))
    .onConflictDoUpdate({
      target: [stockReservations.orderId, stockReservations.productId],
      set: {
        quantity: sql`excluded.quantity`,
        expiresAt: sql`GREATEST(${stockReservations.expiresAt}, excluded.expires_at)`,
        settledAt: null,
      },
    })
  return 'retaken'
}

/**
 * Payment succeeded: turn the LIVE holds into a real decrement.
 *
 * Idempotent by construction — it only touches rows that are still unsettled,
 * so a redelivered webhook decrements nothing a second time. Returns the number
 * of lines it actually settled, which the caller can use to tell a genuine
 * first delivery from a replay.
 *
 * Only holds that have not expired are consumed. An expired hold no longer
 * protects its units — another customer may hold them now — so consuming it
 * would take their units and fail their payment. Lines without a live hold go
 * through takeStockForLatePayment, which takes only what is free.
 */
export async function consumeReservations(tx: Transaction, orderId: string): Promise<number> {
  return (await consumeLiveReservations(tx, orderId)).length
}

/** As consumeReservations, returning what was consumed, per product. */
export async function consumeLiveReservations(tx: Transaction, orderId: string): Promise<StockLine[]> {
  const claimed = await tx.execute<{ product_id: string; quantity: number }>(sql`
    UPDATE stock_reservations
       SET settled_at = NOW()
     WHERE order_id = ${orderId}
       AND settled_at IS NULL
       AND expires_at > NOW()
    RETURNING product_id, quantity
  `)

  if (claimed.rows.length === 0) return []

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

  return claimed.rows.map((row) => ({ productId: row.product_id, quantity: Number(row.quantity) }))
}

/**
 * Close an order's expired holds without touching stock: a hold never
 * decremented anything, so letting it go gives nothing back either. Used when
 * the order is paid, so a lapsed hold cannot linger as "unsettled".
 */
export async function settleExpiredHolds(tx: Transaction, orderId: string): Promise<number> {
  const settled = await tx.execute(sql`
    UPDATE stock_reservations
       SET settled_at = NOW()
     WHERE order_id = ${orderId}
       AND settled_at IS NULL
       AND expires_at <= NOW()
    RETURNING id
  `)
  return settled.rows.length
}

/**
 * Take the units for a payment that arrived after its hold had expired.
 *
 * An online hold lives 30 minutes; money can land later — a webhook retried
 * after an outage, a delayed method, the sweep finding a payment whose event
 * never arrived. Before this, such an order became paid while its units stayed
 * on the shelf, and the same bike could be sold again.
 *
 * The customer HAS paid, so this never refuses. It takes what is free — on_hand
 * minus what OTHER orders still hold live — and never a unit someone else is
 * holding: taking that would move the oversell onto a customer who did nothing
 * wrong, whose own payment would then fail. Whatever is missing is the late
 * order's shortfall, returned so the caller can put it in front of a person.
 * Rows are locked in the same stable order as everywhere else.
 *
 * Known limit, unchanged from before: restockOrder gives back the ordered
 * quantity, so cancelling an order that was SHORT re-credits units that were
 * never taken. Fixing that needs a per-line record of what was taken (a schema
 * change); until then the shortfall is written on the order for the admin.
 */
export async function takeStockForLatePayment(
  tx: Transaction,
  orderId: string,
  /** What live holds already covered when this payment arrived — taken once, not twice. */
  covered: StockLine[] = []
): Promise<{ lines: number; short: Array<{ productId: string; missing: number }> }> {
  const ordered = await tx.execute<{ product_id: string; quantity: number }>(sql`
    SELECT product_id, SUM(quantity)::int AS quantity
      FROM order_items
     WHERE order_id = ${orderId}
     GROUP BY product_id
  `)
  const coveredBy = new Map<string, number>()
  for (const line of covered) coveredBy.set(line.productId, (coveredBy.get(line.productId) ?? 0) + line.quantity)
  const wanted = {
    rows: ordered.rows
      .map((row) => ({ product_id: row.product_id, quantity: Number(row.quantity) - (coveredBy.get(row.product_id) ?? 0) }))
      .filter((row) => row.quantity > 0),
  }
  if (wanted.rows.length === 0) return { lines: 0, short: [] }

  const locked = await tx.execute<{ product_id: string; on_hand: number }>(sql`
    SELECT product_id, on_hand FROM inventory
     WHERE product_id IN ${inList(wanted.rows.map((row) => row.product_id))}
     ORDER BY product_id
       FOR UPDATE
  `)
  const onHand = new Map(locked.rows.map((row) => [row.product_id, Number(row.on_hand)]))

  // Read under the inventory locks, so no hold can be taken in between.
  const others = await tx.execute<{ product_id: string; held: number }>(sql`
    SELECT product_id, SUM(quantity)::int AS held
      FROM stock_reservations
     WHERE product_id IN ${inList(wanted.rows.map((row) => row.product_id))}
       AND order_id <> ${orderId}
       AND settled_at IS NULL
       AND expires_at > NOW()
     GROUP BY product_id
  `)
  const heldByOthers = new Map(others.rows.map((row) => [row.product_id, Number(row.held)]))

  const short: Array<{ productId: string; missing: number }> = []
  let lines = 0
  for (const row of wanted.rows) {
    const shelf = onHand.get(row.product_id)
    // A product with no inventory row is not stock-tracked; nothing to take.
    if (shelf === undefined) continue
    const free = Math.max(shelf - (heldByOthers.get(row.product_id) ?? 0), 0)
    const take = Math.min(row.quantity, free)
    if (take < row.quantity) short.push({ productId: row.product_id, missing: row.quantity - take })
    if (take > 0) {
      await tx.execute(sql`
        UPDATE inventory
           SET on_hand = on_hand - ${take},
               version = version + 1,
               updated_at = NOW()
         WHERE product_id = ${row.product_id}
      `)
    }
    lines++
  }
  return { lines, short }
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

