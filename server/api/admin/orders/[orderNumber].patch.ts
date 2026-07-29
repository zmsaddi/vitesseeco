/**
 * Admin order update: status, tracking number, internal notes.
 *
 * - PG is the source of truth; the Sanity mirror converges via a
 *   'sanity.order.patch' outbox entry (drained by the existing cron).
 * - Every change is written to audit_log with before/after (actor = admin email).
 * - Any valid status can be set (admin override) — the UI guides the normal
 *   pending → paid → processing → shipped → delivered flow.
 * - Cancelling gives the reserved units back to inventory (see below).
 */
import { and, eq, ne } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'
import { audit } from '~/server/utils/audit'
import { enqueueOutbox } from '~/server/utils/outbox'
import { increment, type StockItem } from '~/server/utils/stock'

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']

// Stock is decremented once, when the order is created, so every status below
// still holds those units. 'delivered' is excluded: the goods physically left
// the warehouse, and a post-delivery return is an explicit stock edit.
const STOCK_HOLDING_STATUSES = ['pending', 'paid', 'processing', 'shipped']

/** `orders.items` is an untyped jsonb snapshot; keep only what restocking needs. */
function restockUnits(items: unknown): StockItem[] {
  if (!Array.isArray(items)) return []
  const units: StockItem[] = []
  for (const item of items as Array<{ productId?: unknown; quantity?: unknown }>) {
    const quantity = Number(item?.quantity)
    if (typeof item?.productId === 'string' && quantity > 0) {
      units.push({ productId: item.productId, quantity })
    }
  }
  return units
}

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })
  const admin = await requireAdmin(event)

  const orderNumber = getRouterParam(event, 'orderNumber')
  if (!orderNumber || !/^ORD-[A-Z0-9]+$/.test(orderNumber)) {
    throw createError({ statusCode: 400, message: 'Invalid order number' })
  }

  const body = await readBody(event)
  const updates: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !STATUSES.includes(body.status)) {
      throw createError({ statusCode: 400, message: 'Invalid status' })
    }
    updates.status = body.status
  }
  if (body.trackingNumber !== undefined) {
    if (typeof body.trackingNumber !== 'string' || body.trackingNumber.length > 100) {
      throw createError({ statusCode: 400, message: 'Invalid tracking number' })
    }
    updates.trackingNumber = body.trackingNumber.trim() || null
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string' || body.notes.length > 2000) {
      throw createError({ statusCode: 400, message: 'Invalid notes' })
    }
    updates.notes = body.notes.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const db = useDBHttp()
  const [current] = await db
    .select({
      status: orders.status,
      trackingNumber: orders.trackingNumber,
      notes: orders.notes,
      items: orders.items,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1)
  if (!current) throw createError({ statusCode: 404, message: 'Order not found' })
  const { items, ...before } = current

  const restocking =
    updates.status === 'cancelled' && STOCK_HOLDING_STATUSES.includes(before.status)

  updates.updatedAt = new Date()
  // When cancelling, the same UPDATE that moves the row off a stock-holding
  // status is what authorizes the restock — a concurrent (or repeated) cancel
  // matches nothing and therefore cannot give the units back twice.
  const changed = await db
    .update(orders)
    .set(updates)
    .where(
      restocking
        ? and(eq(orders.orderNumber, orderNumber), ne(orders.status, 'cancelled'))
        : eq(orders.orderNumber, orderNumber)
    )
    .returning({ id: orders.id })

  if (restocking && changed.length > 0) {
    const units = restockUnits(items)
    if (units.length > 0) {
      await increment(db, units)
      for (const productId of [...new Set(units.map((u) => u.productId))]) {
        await enqueueOutbox(db, {
          kind: 'sanity.inventory.patch',
          payload: { productId },
        })
      }
    }
  }

  await audit({
    actorType: 'admin',
    actorId: admin.email,
    action: 'order.admin_update',
    resourceType: 'order',
    resourceId: orderNumber,
    before,
    after: { ...before, ...updates, updatedAt: undefined },
  })

  // Converge the Sanity mirror (Studio order view) via the existing outbox.
  // enqueueOutbox only INSERTs, so the HTTP driver is fine here — no tx needed
  // because the order update above already committed independently.
  await enqueueOutbox(db, {
    kind: 'sanity.order.patch',
    payload: { orderNumber },
  })

  const [after] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
  return {
    ok: true,
    orderNumber,
    status: after.status,
    trackingNumber: after.trackingNumber,
    notes: after.notes,
    updatedAt: after.updatedAt,
  }
})
