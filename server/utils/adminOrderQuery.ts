/**
 * Shared filter/sort builder for admin order endpoints (list + CSV export),
 * so both honor exactly the same query params.
 *
 * Params: status, q (free text), payment, dateFrom, dateTo (YYYY-MM-DD,
 * dateTo inclusive), sort (created_desc default).
 */
import { and, asc, desc, eq, gte, ilike, lt, or, sql, type SQL } from 'drizzle-orm'
import { orders } from '~/server/database/schema'

export const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
// Must stay in sync with the adapter registry (server/payments/registry.ts):
// an unlisted code silently drops the filter and returns every order.
export const PAYMENT_CODES = ['paypal', 'in_store', 'stripe', 'klarna', 'cod']

export const ORDER_SORTS = {
  created_desc: [desc(orders.createdAt)],
  created_asc: [asc(orders.createdAt)],
  total_desc: [desc(orders.total), desc(orders.createdAt)],
  total_asc: [asc(orders.total), desc(orders.createdAt)],
} as const

export type OrderSort = keyof typeof ORDER_SORTS

function parseDay(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function buildAdminOrderFilters(q: Record<string, unknown>): {
  where: SQL | undefined
  sort: OrderSort
} {
  const conds: SQL[] = []

  if (typeof q.status === 'string' && ORDER_STATUSES.includes(q.status)) {
    conds.push(eq(orders.status, q.status))
  }
  if (typeof q.payment === 'string' && PAYMENT_CODES.includes(q.payment)) {
    conds.push(eq(orders.paymentMethod, q.payment))
  }

  const from = parseDay(q.dateFrom)
  if (from) conds.push(gte(orders.createdAt, from))
  const to = parseDay(q.dateTo)
  if (to) conds.push(lt(orders.createdAt, new Date(to.getTime() + 24 * 3600_000)))

  const search = typeof q.q === 'string' ? q.q.trim().slice(0, 100) : ''
  if (search) {
    const pattern = `%${search}%`
    conds.push(
      or(
        ilike(orders.orderNumber, pattern),
        ilike(orders.guestEmail, pattern),
        sql`${orders.customerSnapshot}->>'email' ILIKE ${pattern}`,
        sql`${orders.customerSnapshot}->>'name' ILIKE ${pattern}`
      )!
    )
  }

  const sort: OrderSort =
    typeof q.sort === 'string' && q.sort in ORDER_SORTS ? (q.sort as OrderSort) : 'created_desc'

  return { where: conds.length ? and(...conds) : undefined, sort }
}
