/**
 * Admin dashboard stats — everything reads live from PG.
 *
 * Periods are rolling windows (24h / 7d / 30d) to avoid timezone ambiguity.
 * Revenue excludes cancelled orders.
 */
import { and, asc, count, desc, gte, lte, ne, sql } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { orders, events, inventory } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })
  await requireAdmin(event)

  const db = useDBHttp()
  const now = Date.now()
  const since24h = new Date(now - 24 * 3600_000)
  const since7d = new Date(now - 7 * 24 * 3600_000)
  const since30d = new Date(now - 30 * 24 * 3600_000)

  async function periodStats(since: Date) {
    const [row] = await db
      .select({ n: count(), revenue: sql<string>`COALESCE(SUM(${orders.total}), 0)` })
      .from(orders)
      .where(and(gte(orders.createdAt, since), ne(orders.status, 'cancelled')))
    return { orders: Number(row.n), revenue: Number(row.revenue) }
  }

  const [p24h, p7d, p30d] = await Promise.all([
    periodStats(since24h),
    periodStats(since7d),
    periodStats(since30d),
  ])

  // Status distribution (all time)
  const statusRows = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .groupBy(orders.status)
  const statusCounts: Record<string, number> = {}
  for (const r of statusRows) statusCounts[r.status] = Number(r.n)

  // Conversion funnel, last 30 days
  const funnelRows = await db
    .select({ type: events.eventType, n: count() })
    .from(events)
    .where(gte(events.createdAt, since30d))
    .groupBy(events.eventType)
  const funnelMap: Record<string, number> = {}
  for (const r of funnelRows) funnelMap[r.type] = Number(r.n)
  const funnel = {
    addToCart: funnelMap.add_to_cart ?? 0,
    checkoutStarted: funnelMap.checkout_started ?? 0,
    orderCreated: funnelMap.order_created ?? 0,
  }

  // Top products by quantity, last 30 days
  const topRes: any = await db.execute(sql`
    SELECT item->>'productName' AS name,
           SUM(COALESCE((item->>'quantity')::int, 1)) AS qty
    FROM ${orders}, jsonb_array_elements(${orders.items}) AS item
    WHERE ${orders.createdAt} > ${since30d} AND ${orders.status} != 'cancelled'
    GROUP BY 1
    ORDER BY qty DESC
    LIMIT 5
  `)
  const topProducts: Array<{ name: string; qty: number }> = (topRes.rows ?? topRes ?? []).map(
    (r: any) => ({ name: String(r.name ?? ''), qty: Number(r.qty) })
  )

  // Low stock (PG inventory is the source of truth)
  const lowStock = await db
    .select({ productId: inventory.productId, sku: inventory.sku, stock: inventory.stock })
    .from(inventory)
    .where(lte(inventory.stock, 3))
    .orderBy(asc(inventory.stock))
    .limit(8)

  // Latest orders
  const recentOrders = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      customerName: sql<string>`${orders.customerSnapshot}->>'name'`,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(5)

  return {
    periods: { h24: p24h, d7: p7d, d30: p30d },
    statusCounts,
    funnel,
    topProducts,
    lowStock,
    recentOrders: recentOrders.map((r) => ({ ...r, total: Number(r.total) })),
  }
})
