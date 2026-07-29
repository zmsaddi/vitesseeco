/**
 * The order queue.
 *
 * Filters are validated into an allowlist before they reach a query, so a
 * filter value is never concatenated into SQL and an unrecognised one is a 400
 * rather than a silently ignored parameter — the old build dropped unknown
 * payment filters and returned every order, which reads as "no orders match"
 * when in fact nothing was filtered at all.
 */
import { and, desc, eq, gte, ilike, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { db, queryRows } from '../../db/client'
import { orders } from '../../db/schema'
import { orderStatusSchema, paginationSchema } from '../../../shared/schemas'
import { cents, toDecimalString } from '../../../shared/money'

const querySchema = paginationSchema
  .extend({
    status: orderStatusSchema.optional(),
    // Every method the shop can actually take. An unknown value is refused,
    // not ignored.
    payment: z.enum(['stripe', 'cod', 'in_store']).optional(),
    search: z.string().trim().max(120).optional(),
    since: z.coerce.date().optional(),
  })
  .strict()

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: querySchema,
  handler: async ({ query }) => {
    const conditions: SQL[] = []
    if (query.status) conditions.push(eq(orders.status, query.status))
    if (query.payment) conditions.push(eq(orders.paymentMethod, query.payment))
    if (query.since) conditions.push(gte(orders.createdAt, query.since))
    if (query.search) {
      const term = `%${query.search}%`
      const match = or(
        ilike(orders.orderNumber, term),
        ilike(orders.guestEmail, term),
        sql`${orders.customerSnapshot}->>'email' ILIKE ${term}`,
        sql`${orders.customerSnapshot}->>'name' ILIKE ${term}`
      )
      if (match) conditions.push(match)
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const offset = (query.page - 1) * query.perPage

    const rows = await db()
      .select({
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        shippingMethodCode: orders.shippingMethodCode,
        totalCents: orders.totalCents,
        customerSnapshot: orders.customerSnapshot,
        guestEmail: orders.guestEmail,
        shippingAddress: orders.shippingAddress,
        trackingNumber: orders.trackingNumber,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(query.perPage)
      .offset(offset)

    const counted = await db()
      .select({ value: sql<string>`COUNT(*)::text` })
      .from(orders)
      .where(where)
    const total = Number(counted[0]?.value ?? 0)

    return {
      orders: rows.map((row) => ({
        ...row,
        total: toDecimalString(cents(row.totalCents)),
        totalCents: undefined,
      })),
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    }
  },
})

export { queryRows }
