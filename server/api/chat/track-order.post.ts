/**
 * Chat widget order tracking — live from PG.
 *
 * Privacy: an order is only revealed when the caller proves ownership:
 * - logged-in session whose customerId matches the order, OR
 * - the email provided matches the order's guest/customer-snapshot email.
 * Not-found and not-yours return the same response (no existence oracle).
 */
import { eq } from 'drizzle-orm'
import { and, gt } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { orders, sessions } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 15, windowMs: 60_000 })

  const body = await readBody(event)
  const orderNumber = typeof body?.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!/^ORD-[A-Z0-9]{1,20}$/.test(orderNumber)) {
    throw createError({ statusCode: 400, message: 'Invalid order number' })
  }

  const db = useDBHttp()
  const [order] = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      trackingNumber: orders.trackingNumber,
      customerId: orders.customerId,
      guestEmail: orders.guestEmail,
      customerSnapshot: orders.customerSnapshot,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1)

  const notFound = { found: false as const }
  if (!order) return notFound

  // Ownership check
  let owned = false
  const token = getCookie(event, 'auth_token')
  if (token && order.customerId) {
    const [session] = await db
      .select({ customerId: sessions.customerId })
      .from(sessions)
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1)
    if (session?.customerId === order.customerId) owned = true
  }
  if (!owned && email) {
    const snapshotEmail = ((order.customerSnapshot as any)?.email || '').toLowerCase()
    const guestEmail = (order.guestEmail || '').toLowerCase()
    if (email === snapshotEmail || email === guestEmail) owned = true
  }
  if (!owned) return notFound

  return {
    found: true as const,
    orderNumber: order.orderNumber,
    status: order.status,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt,
  }
})
