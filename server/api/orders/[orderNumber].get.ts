/**
 * Single-order detail endpoint (P3-07).
 *
 * Reads an order by orderNumber for the authenticated customer.
 * Tries PG first (post-PG-primary world); falls back to Sanity for orders
 * created on the legacy path.
 */
import { useDBHttp } from '~/server/database/db'
import { sessions, orders } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'
import { rateLimit } from '~/server/utils/rateLimit'
import { createClient } from '@sanity/client'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 30, windowMs: 60_000 })

  const orderNumber = getRouterParam(event, 'orderNumber')
  if (!orderNumber || !/^ORD-[A-Z0-9]+$/.test(orderNumber)) {
    throw createError({ statusCode: 400, message: 'Invalid order number' })
  }

  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDBHttp()
  const [session] = await db
    .select({ customerId: sessions.customerId })
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1)
  if (!session) throw createError({ statusCode: 401, message: 'Session expired' })

  // Try PG first
  const [pgOrder] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.customerId, session.customerId)))
    .limit(1)

  if (pgOrder) {
    return {
      source: 'pg',
      orderNumber: pgOrder.orderNumber,
      status: pgOrder.status,
      paymentMethod: pgOrder.paymentMethod,
      shippingMethod: pgOrder.shippingMethod,
      trackingNumber: pgOrder.trackingNumber,
      items: pgOrder.items,
      subtotal: Number(pgOrder.subtotal),
      shippingCost: Number(pgOrder.shippingCost),
      discount: Number(pgOrder.discount),
      total: Number(pgOrder.total),
      promoCode: pgOrder.promoCode,
      shippingAddress: pgOrder.shippingAddress,
      billingAddress: pgOrder.billingAddress,
      notes: pgOrder.notes,
      createdAt: pgOrder.createdAt,
      updatedAt: pgOrder.updatedAt,
    }
  }

  // Fallback: legacy Sanity-stored order
  const sanity = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
  })

  const sanityOrder = await sanity.fetch(
    `*[_type == "order" && orderNumber == $n && customer.customerId == $cid][0]{
      orderNumber, status, paymentMethod, total, subtotal, shippingCost, discount,
      shippingMethod, trackingNumber, promoCode, notes,
      shippingAddress, billingAddress,
      items[]{ productName, color, quantity, price, sku },
      createdAt
    }`,
    { n: orderNumber, cid: session.customerId }
  )

  if (!sanityOrder) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }

  return { source: 'sanity', ...sanityOrder }
})
