/**
 * Admin orders list — reads PG directly (live, no Sanity sync lag).
 * Filters/sort (status, q, payment, dateFrom/dateTo, sort) come from the
 * shared builder so the CSV export matches exactly. Also returns per-status
 * counts for the filter chips.
 */
import { count, sql } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'
import { buildAdminOrderFilters, ORDER_SORTS } from '~/server/utils/adminOrderQuery'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 120, windowMs: 60_000 })
  await requireAdmin(event)

  const q = getQuery(event)
  const page = Math.max(1, parseInt(q.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(q.limit as string) || 20))
  const { where, sort } = buildAdminOrderFilters(q)

  const db = useDBHttp()

  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      total: orders.total,
      customerName: sql<string>`${orders.customerSnapshot}->>'name'`,
      customerEmail: sql<string>`COALESCE(${orders.customerSnapshot}->>'email', ${orders.guestEmail})`,
      itemsCount: sql<number>`jsonb_array_length(${orders.items})`,
      trackingNumber: orders.trackingNumber,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(where)
    .orderBy(...ORDER_SORTS[sort])
    .limit(limit)
    .offset((page - 1) * limit)

  const [{ value: total }] = await db.select({ value: count() }).from(orders).where(where)

  // Global per-status counts (independent of current filter) for the chips.
  const statusRows = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .groupBy(orders.status)
  const counts: Record<string, number> = { all: 0 }
  for (const r of statusRows) {
    counts[r.status] = Number(r.n)
    counts.all += Number(r.n)
  }

  return {
    orders: rows.map((r) => ({ ...r, total: Number(r.total) })),
    total: Number(total),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    counts,
  }
})
