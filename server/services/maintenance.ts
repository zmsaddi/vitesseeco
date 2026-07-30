/**
 * The work nobody triggers.
 *
 * Everything here exists because a hold that is never released is a product
 * that quietly stops being sellable. A reservation carries an expiry precisely
 * so it cannot strand stock — but an expiry is only a promise until something
 * acts on it, and until this ran, nothing did.
 *
 * Three independent paths release a hold: the payment webhook, an admin
 * cancelling, and this sweep. That redundancy is the point. A webhook that
 * never arrives must not cost the shop a bike.
 *
 * Every step is bounded and idempotent, so a run that overlaps the previous one
 * does no harm and a failure part-way through loses nothing.
 *
 * Reads go through a `SqlExecutor` rather than through the module's own
 * connection, for exactly the reason that type exists: a service that opens a
 * connection to a hardwired URL cannot be pointed at a test database, and a
 * service that cannot be pointed at a test database is one whose tests never
 * ran. This project has learned that three times already.
 */
import { sql } from 'drizzle-orm'
import { db, queryRows, withTransaction, type SqlExecutor, type TransactionRunner } from '../db/client'
import { expireStaleReservations } from './stock'
import { transitionOrder } from './orders'
import { audit } from './audit'
import { pruneExpiredSessions } from '../security/session'

/**
 * How long an unpaid online order may hold its stock.
 *
 * Long enough that a customer wrestling with 3-D Secure on a bad connection is
 * not robbed of their basket, short enough that a browser closed at the payment
 * form does not hold the last bike overnight.
 */
const UNPAID_ORDER_TTL_MINUTES = 60

/** Telemetry is kept long enough to answer a question, not indefinitely. */
const EVENT_RETENTION_DAYS = 90
const WEBHOOK_RETENTION_DAYS = 30

/** Bounded, so one run cannot become an unbounded delete on a busy table. */
const PRUNE_LIMIT = 5000

export interface MaintenanceReport {
  reservationsExpired: number
  ordersCancelled: string[]
  rateLimitsPruned: number
  sessionsPruned: number
  eventsPruned: number
  webhooksPruned: number
}

/**
 * Cancel online orders that were never paid, and give their stock back.
 *
 * Cash orders are deliberately untouched: they are agreed sales awaiting a
 * driver, not abandoned baskets, and cancelling one because nobody clicked
 * anything would delete real work.
 */
async function cancelAbandonedOrders(
  executor: SqlExecutor,
  runTransaction: TransactionRunner
): Promise<string[]> {
  const stale = await queryRows<{ order_number: string }>(
    executor,
    sql`
      SELECT order_number
        FROM orders
       WHERE status = 'awaiting_payment'
         AND payment_method = 'stripe'
         AND paid_at IS NULL
         AND created_at < NOW() - (${UNPAID_ORDER_TTL_MINUTES} || ' minutes')::interval
       ORDER BY created_at
       LIMIT 100
    `
  )

  const cancelled: string[] = []
  for (const row of stale) {
    // One transaction each. A single bad row must not roll the sweep back and
    // leave every other order still holding stock.
    try {
      const result = await transitionOrder(row.order_number, 'cancelled', {
        expectFrom: 'awaiting_payment',
        runTransaction,
      })
      if (result.changed) {
        cancelled.push(row.order_number)
        await audit({
          action: 'order.abandoned_cancelled',
          actorType: 'system',
          resourceType: 'order',
          resourceId: row.order_number,
          metadata: { afterMinutes: UNPAID_ORDER_TTL_MINUTES },
        })
      }
    } catch (error) {
      // A payment landing at this exact moment makes the transition a no-op
      // rather than a conflict, which is the behaviour we want. Anything else
      // is worth seeing, without stopping the sweep.
      console.warn(`[maintenance] could not cancel ${row.order_number}`, error)
    }
  }
  return cancelled
}

export async function runMaintenance(
  runTransaction: TransactionRunner = withTransaction,
  executor?: SqlExecutor
): Promise<MaintenanceReport> {
  const reader = executor ?? db()

  const reservationsExpired = await runTransaction((tx) => expireStaleReservations(tx))
  const ordersCancelled = await cancelAbandonedOrders(reader, runTransaction)

  // Expired sessions were never pruned by anything: the function existed, was
  // exported, was named in the cron route's own description, and had no caller.
  // The table grew for the lifetime of the shop.
  const sessionsPruned = await pruneExpiredSessions(reader, PRUNE_LIMIT)

  // A rate-limit window that has closed is a row nobody will read again.
  const prunedLimits = await queryRows<{ bucket: string }>(
    reader,
    sql`DELETE FROM rate_limits WHERE expires_at < NOW() RETURNING bucket`
  )

  const prunedEvents = await queryRows<{ id: string }>(
    reader,
    sql`
      DELETE FROM events
       WHERE ctid IN (
         SELECT ctid FROM events
          WHERE created_at < NOW() - (${EVENT_RETENTION_DAYS} || ' days')::interval
          LIMIT ${PRUNE_LIMIT}
       )
      RETURNING id
    `
  )

  // Webhook rows exist to make a redelivery a no-op. Once the provider will no
  // longer redeliver, they are only a record of traffic.
  const prunedWebhooks = await queryRows<{ id: string }>(
    reader,
    sql`
      DELETE FROM webhook_events
       WHERE ctid IN (
         SELECT ctid FROM webhook_events
          WHERE received_at < NOW() - (${WEBHOOK_RETENTION_DAYS} || ' days')::interval
          LIMIT ${PRUNE_LIMIT}
       )
      RETURNING id
    `
  )

  return {
    reservationsExpired,
    ordersCancelled,
    rateLimitsPruned: prunedLimits.length,
    sessionsPruned,
    eventsPruned: prunedEvents.length,
    webhooksPruned: prunedWebhooks.length,
  }
}

export const MAINTENANCE_CONSTANTS = {
  UNPAID_ORDER_TTL_MINUTES,
  EVENT_RETENTION_DAYS,
  WEBHOOK_RETENTION_DAYS,
} as const
