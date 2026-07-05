/**
 * Admin single-order detail — full PG row (admins see everything, including
 * addresses, snapshot, notes and payment metadata).
 */
import { eq } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 120, windowMs: 60_000 })
  await requireAdmin(event)

  const orderNumber = getRouterParam(event, 'orderNumber')
  if (!orderNumber || !/^ORD-[A-Z0-9]+$/.test(orderNumber)) {
    throw createError({ statusCode: 400, message: 'Invalid order number' })
  }

  const db = useDBHttp()
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    shippingMethod: order.shippingMethod,
    trackingNumber: order.trackingNumber,
    items: order.items,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    discount: Number(order.discount),
    total: Number(order.total),
    promoCode: order.promoCode,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    customerSnapshot: order.customerSnapshot,
    customerId: order.customerId,
    guestEmail: order.guestEmail,
    stripePaymentId: order.stripePaymentId,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
})
