/**
 * A customer's own orders.
 *
 * Ownership is part of the WHERE clause, not a check performed on the result.
 * That distinction is what makes an insecure-direct-object-reference bug
 * impossible here rather than merely absent: there is no moment at which a row
 * belonging to someone else has been fetched.
 */
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { db, queryRows } from '../../db/client'
import { orderItems, orders } from '../../db/schema'
import { paginationSchema } from '../../../shared/schemas'
import { toDecimalString, cents } from '../../../shared/money'

export default defineRoute({
  access: 'customer',
  rateLimit: 'standard',
  query: paginationSchema,
  handler: async ({ query, customer }) => {
    const offset = (query.page - 1) * query.perPage

    const rows = await db()
      .select({
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        shippingMethodCode: orders.shippingMethodCode,
        totalCents: orders.totalCents,
        trackingNumber: orders.trackingNumber,
        carrier: orders.carrier,
        createdAt: orders.createdAt,
        shippedAt: orders.shippedAt,
        deliveredAt: orders.deliveredAt,
      })
      .from(orders)
      .where(eq(orders.customerId, customer!.id))
      .orderBy(desc(orders.createdAt))
      .limit(query.perPage)
      .offset(offset)

    const counted = await queryRows<{ count: string }>(
      db(),
      sql`SELECT COUNT(*)::text AS count FROM orders WHERE customer_id = ${customer!.id}`
    )
    const total = Number(counted[0]?.count ?? 0)

    // One query for the lines of every order on this page, rather than one per
    // order — a customer with twenty orders should not cost twenty round trips.
    const numbers = rows.map((row) => row.orderNumber)
    const lines = numbers.length
      ? await db()
          .select({
            orderId: orderItems.orderId,
            name: orderItems.nameSnapshot,
            color: orderItems.colorSnapshot,
            image: orderItems.imageSnapshot,
            quantity: orderItems.quantity,
            lineTotalCents: orderItems.lineTotalCents,
            orderNumber: orders.orderNumber,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .where(eq(orders.customerId, customer!.id))
      : []

    const linesByOrder = new Map<string, typeof lines>()
    for (const line of lines) {
      const bucket = linesByOrder.get(line.orderNumber) ?? []
      bucket.push(line)
      linesByOrder.set(line.orderNumber, bucket)
    }

    return {
      orders: rows.map((row) => ({
        orderNumber: row.orderNumber,
        status: row.status,
        paymentMethod: row.paymentMethod,
        shippingMethod: row.shippingMethodCode,
        total: toDecimalString(cents(row.totalCents)),
        trackingNumber: row.trackingNumber,
        carrier: row.carrier,
        createdAt: row.createdAt,
        shippedAt: row.shippedAt,
        deliveredAt: row.deliveredAt,
        items: (linesByOrder.get(row.orderNumber) ?? []).map((line) => ({
          name: line.name,
          color: line.color,
          image: line.image,
          quantity: line.quantity,
          lineTotal: toDecimalString(cents(line.lineTotalCents)),
        })),
      })),
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    }
  },
})

export { z }
