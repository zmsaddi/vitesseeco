/**
 * Admin order update: status, tracking number, internal notes.
 *
 * - PG is the source of truth; the Sanity mirror converges via a
 *   'sanity.order.patch' outbox entry (drained by the existing cron).
 * - Every change is written to audit_log with before/after (actor = admin email).
 * - Any valid status can be set (admin override) — the UI guides the normal
 *   pending → paid → processing → shipped → delivered flow.
 */
import { eq } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'
import { audit } from '~/server/utils/audit'
import { enqueueOutbox } from '~/server/utils/outbox'

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']

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
  const [before] = await db
    .select({
      status: orders.status,
      trackingNumber: orders.trackingNumber,
      notes: orders.notes,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1)
  if (!before) throw createError({ statusCode: 404, message: 'Order not found' })

  updates.updatedAt = new Date()
  await db.update(orders).set(updates).where(eq(orders.orderNumber, orderNumber))

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
