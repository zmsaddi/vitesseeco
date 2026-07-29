/**
 * Customer order list.
 *
 * Reads Postgres, the authoritative store. The Sanity mirror is deliberately
 * not consulted: it is a publicly readable dataset and therefore carries
 * operational fields only, no customer identity.
 */
import { useDBHttp } from '~/server/database/db'
import { sessions, orders } from '~/server/database/schema'
import { eq, and, gt, desc, count } from 'drizzle-orm'
import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 30, windowMs: 60_000 })

  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDBHttp()
  const [session] = await db.select({ customerId: sessions.customerId }).from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1)
  if (!session) throw createError({ statusCode: 401, message: 'Session expired' })

  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10))
  const offset = (page - 1) * limit

  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      total: orders.total,
      shippingMethod: orders.shippingMethod,
      trackingNumber: orders.trackingNumber,
      items: orders.items,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, session.customerId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.customerId, session.customerId))

  return {
    orders: rows.map(r => ({ ...r, total: Number(r.total) })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
})
