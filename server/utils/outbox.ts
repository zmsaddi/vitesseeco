/**
 * Outbox helpers (P0-12, ADR-001).
 *
 * The outbox is how PG-primary order data is propagated to Sanity (and any
 * future downstream consumer). Writers ENQUEUE entries inside their PG
 * transaction — guaranteeing the entry is durable iff the order itself is
 * durable. A worker DRAINS pending entries with retry.
 */

import { sql, and, eq, lt } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { outbox } from '~/server/database/schema'

export type OutboxKind =
  | 'sanity.order.create'
  | 'sanity.order.patch'
  | 'sanity.inventory.patch'
  | 'sanity.promo.increment'
  | 'sanity.promo.decrement'

export interface OutboxEntryInput {
  kind: OutboxKind
  payload: Record<string, unknown>
}

/**
 * Enqueue an outbox entry. Must be called inside the same PG transaction as
 * the writer that produced it, so atomicity is preserved.
 */
export async function enqueueOutbox(tx: any, entry: OutboxEntryInput): Promise<void> {
  await tx.insert(outbox).values({
    kind: entry.kind,
    payload: entry.payload as any,
    status: 'pending',
    attempts: 0,
  })
}

const MAX_ATTEMPTS = 8 // 50ms, 100, 200, 400, 800, 1600, 3200, 6400 → ~13s cumulative
const BASE_BACKOFF_MS = 50
const PERMANENT_FAIL_AFTER = 12 // alert / mark failed after this

export interface DrainOptions {
  /** Max entries processed per call. Keeps function execution time bounded on Vercel. */
  batchSize?: number
  /** Worker function — receives the entry, must throw on failure. */
  process: (entry: { id: string; kind: string; payload: any }) => Promise<void>
}

export interface DrainResult {
  processed: number
  succeeded: number
  failed: number
  permanentlyFailed: number
}

/**
 * Drain pending outbox entries that are due (scheduled_at <= now).
 * Bounded by batchSize to keep each invocation fast.
 */
export async function drainOutbox(opts: DrainOptions): Promise<DrainResult> {
  // HTTP driver: no Pool cold-start, so the cron route stays well under the
  // 30 s free-tier wall on cron-job.org even when Neon's compute resumed
  // from auto-suspend. enqueueOutbox still runs against the Pool tx (it
  // takes the tx as an arg from orderService).
  const db = useDBHttp()
  const batchSize = opts.batchSize ?? 25

  const pending = await db
    .select()
    .from(outbox)
    .where(
      and(
        eq(outbox.status, 'pending'),
        lt(outbox.scheduledAt, new Date())
      )
    )
    .limit(batchSize)

  let succeeded = 0
  let failed = 0
  let permanentlyFailed = 0

  for (const entry of pending) {
    try {
      await opts.process({ id: entry.id, kind: entry.kind, payload: entry.payload })
      // Mark done
      await db
        .update(outbox)
        .set({ status: 'done', processedAt: new Date(), lastError: null })
        .where(eq(outbox.id, entry.id))
      succeeded++
    } catch (err) {
      const nextAttempt = (entry.attempts ?? 0) + 1
      const isPermanent = nextAttempt >= PERMANENT_FAIL_AFTER

      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, Math.min(nextAttempt, MAX_ATTEMPTS))
      const nextRunAt = new Date(Date.now() + backoffMs)

      await db
        .update(outbox)
        .set({
          status: isPermanent ? 'failed' : 'pending',
          attempts: nextAttempt,
          lastError: err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 1000) : String(err).slice(0, 1000),
          scheduledAt: nextRunAt,
        })
        .where(eq(outbox.id, entry.id))

      if (isPermanent) {
        permanentlyFailed++
        // Surface for alerting once Sentry is wired in P0-16.
        console.error(
          `[OUTBOX] entry ${entry.id} (${entry.kind}) marked permanently failed after ${nextAttempt} attempts`,
          err
        )
      } else {
        failed++
      }
    }
  }

  return { processed: pending.length, succeeded, failed, permanentlyFailed }
}
