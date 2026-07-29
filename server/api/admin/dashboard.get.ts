/**
 * The numbers the owner opens the panel for.
 *
 * Revenue counts PAID orders only. Counting orders that were merely placed
 * flatters the figure with baskets that were abandoned at the payment step,
 * and the difference is exactly the number worth watching.
 */
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { db, queryRows } from '../../db/client'
import { cents, toDecimalString } from '../../../shared/money'

const PERIODS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 } as const

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: z.object({ period: z.enum(['24h', '7d', '30d', '90d']).default('7d') }).strict(),
  handler: async ({ query }) => {
    const days = PERIODS[query.period]
    const since = sql.raw(`INTERVAL '${days} days'`)

    const [totals] = await queryRows<{
      placed: string
      paid: string
      cancelled: string
      awaiting: string
      revenue_cents: string
    }>(
      db(),
      sql`
        SELECT
          COUNT(*)::text AS placed,
          COUNT(*) FILTER (WHERE status IN ('paid','processing','shipped','delivered'))::text AS paid,
          COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
          COUNT(*) FILTER (WHERE status = 'awaiting_payment')::text AS awaiting,
          COALESCE(SUM(total_cents) FILTER (
            WHERE status IN ('paid','processing','shipped','delivered')
          ), 0)::text AS revenue_cents
        FROM orders
        WHERE created_at > NOW() - ${since}
      `
    )

    const placed = Number(totals?.placed ?? 0)
    const paid = Number(totals?.paid ?? 0)
    const revenue = cents(Number(totals?.revenue_cents ?? 0))

    const byStatus = await queryRows<{ status: string; count: string }>(
      db(),
      sql`
        SELECT status, COUNT(*)::text AS count
          FROM orders
         WHERE created_at > NOW() - ${since}
         GROUP BY status
      `
    )

    const topProducts = await queryRows<{ name: string; units: string; revenue_cents: string }>(
      db(),
      sql`
        SELECT oi.name_snapshot AS name,
               SUM(oi.quantity)::text AS units,
               SUM(oi.line_total_cents)::text AS revenue_cents
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at > NOW() - ${since}
           AND o.status IN ('paid','processing','shipped','delivered')
         GROUP BY oi.name_snapshot
         ORDER BY SUM(oi.line_total_cents) DESC
         LIMIT 10
      `
    )

    // Orders needing a human right now, regardless of the reporting period.
    const [queue] = await queryRows<{ to_process: string; to_ship: string; cash_unpaid: string }>(
      db(),
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'paid')::text AS to_process,
          COUNT(*) FILTER (WHERE status = 'processing')::text AS to_ship,
          COUNT(*) FILTER (
            WHERE status = 'awaiting_payment' AND payment_method IN ('cod','in_store')
          )::text AS cash_unpaid
        FROM orders
      `
    )

    return {
      period: query.period,
      placed,
      paid,
      cancelled: Number(totals?.cancelled ?? 0),
      awaitingPayment: Number(totals?.awaiting ?? 0),
      revenue: toDecimalString(revenue),
      // The share of started checkouts that actually became money.
      conversion: placed > 0 ? Math.round((paid / placed) * 1000) / 10 : 0,
      averageOrder: paid > 0 ? toDecimalString(cents(Math.round(revenue / paid))) : '0.00',
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, Number(row.count)])),
      topProducts: topProducts.map((row) => ({
        name: row.name,
        units: Number(row.units),
        revenue: toDecimalString(cents(Number(row.revenue_cents))),
      })),
      queue: {
        toProcess: Number(queue?.to_process ?? 0),
        toShip: Number(queue?.to_ship ?? 0),
        cashAwaitingCollection: Number(queue?.cash_unpaid ?? 0),
      },
    }
  },
})
