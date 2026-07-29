/**
 * One order, in full.
 *
 * The queue answers "what needs me now"; this answers "what do I put in the box
 * and where do I drive it". Those are different questions, and the second one
 * needs the street address and the line items — which the list view deliberately
 * does not carry, because sending every customer's address down the wire to
 * render a table of order numbers is a disclosure with no purpose.
 */
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getRouterParam } from 'h3'
import { defineRoute } from '../../../security/handler'
import { db } from '../../../db/client'
import { orderItems, orders } from '../../../db/schema'
import { AppError, ERROR_CODES } from '../../../../shared/errors'
import { cents, toDecimalString } from '../../../../shared/money'

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  handler: async ({ event }) => {
    const orderNumber = z
      .string()
      .trim()
      .min(4)
      .max(40)
      .regex(/^[A-Z0-9-]+$/i)
      .safeParse(getRouterParam(event, 'orderNumber'))

    if (!orderNumber.success) {
      throw new AppError(ERROR_CODES.NOT_FOUND, { internal: 'malformed order number' })
    }

    const [order] = await db()
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber.data.toUpperCase()))
      .limit(1)

    if (!order) {
      throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `no order ${orderNumber.data}` })
    }

    const items = await db()
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.createdAt))

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      shippingMethodCode: order.shippingMethodCode,
      locale: order.locale,
      marketCountry: order.marketCountry,
      subtotal: toDecimalString(cents(order.subtotalCents)),
      discount: toDecimalString(cents(order.discountCents)),
      shipping: toDecimalString(cents(order.shippingCents)),
      total: toDecimalString(cents(order.totalCents)),
      // The VAT contained in the price list that was used. Shown so the owner
      // can see what was applied, not as a determination of what is owed —
      // that also turns on the destination and on OSS registration.
      vat: {
        ratePercent: order.vatRateBp / 100,
        amount: toDecimalString(cents(order.vatCents)),
      },
      promoCode: order.promoCode,
      customerSnapshot: order.customerSnapshot,
      guestEmail: order.guestEmail,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      notes: order.notes,
      adminNotes: order.adminNotes,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      items: items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.nameSnapshot,
        color: item.colorSnapshot,
        image: item.imageSnapshot,
        quantity: item.quantity,
        unitPrice: toDecimalString(cents(item.unitPriceCents)),
        lineTotal: toDecimalString(cents(item.lineTotalCents)),
      })),
    }
  },
})
