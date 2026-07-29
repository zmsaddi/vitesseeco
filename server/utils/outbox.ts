/**
 * Outbox helpers (P0-12, ADR-001).
 *
 * The outbox is how PG-primary order data is propagated to Sanity (and any
 * future downstream consumer). Writers ENQUEUE entries inside their PG
 * transaction — guaranteeing the entry is durable iff the order itself is
 * durable. A worker CLAIMS due entries, then drains them with retry.
 *
 * status vocabulary: pending → processing → done | failed.
 */

import { sql, eq } from 'drizzle-orm'
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
// A claimed row is never released if its worker dies (function timeout, deploy
// mid-flight). After this long the claim is treated as abandoned and the row
// becomes claimable again — must stay above the slowest realistic dispatch,
// otherwise a merely slow entry gets picked up a second time.
const STALE_CLAIM_MINUTES = 5
const DONE_RETENTION_DAYS = 7
const CLEANUP_BATCH = 200

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

type ClaimedEntry = {
  id: string
  kind: string
  payload: any
  attempts: number
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

  // Claim before processing: the cron worker and the opportunistic post-order
  // flush can overlap, so rows have to leave the queue atomically or both
  // dispatch the same entry (and Sanity gets a duplicate order doc — the
  // existence check in dispatchOutboxEntry is a read, not a lock). SKIP LOCKED
  // sends the loser of the race to other rows instead of blocking it.
  // scheduled_at doubles as the claim timestamp, which is what makes an
  // abandoned claim detectable and reclaimable.
  const claimRes = await db.execute<ClaimedEntry>(sql`
    UPDATE outbox
    SET status = 'processing',
        attempts = attempts + 1,
        scheduled_at = NOW()
    WHERE id IN (
      SELECT id FROM outbox
      WHERE (status = 'pending' AND scheduled_at <= NOW())
         OR (status = 'processing' AND scheduled_at <= NOW() - make_interval(mins => ${STALE_CLAIM_MINUTES}))
      ORDER BY scheduled_at
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, payload, attempts
  `)
  const claimed = claimRes.rows

  if (claimed.length === 0) {
    // Idle round — spend the roundtrip trimming the tail instead. Bounded, so
    // a large backlog disappears over several runs rather than in one long
    // statement; the (status, scheduled_at) index makes the subselect an
    // early-terminating range scan.
    try {
      await db.execute(sql`
        DELETE FROM outbox
        WHERE id IN (
          SELECT id FROM outbox
          WHERE status = 'done'
            AND scheduled_at < NOW() - make_interval(days => ${DONE_RETENTION_DAYS})
          ORDER BY scheduled_at
          LIMIT ${CLEANUP_BATCH}
        )
      `)
    } catch (err) {
      console.warn('[OUTBOX] retention cleanup failed', err)
    }
    return { processed: 0, succeeded: 0, failed: 0, permanentlyFailed: 0 }
  }

  let succeeded = 0
  let failed = 0
  let permanentlyFailed = 0

  for (const entry of claimed) {
    // The claim already incremented attempts, so a row coming back past the cap
    // was claimed and never released: the worker died on it every time.
    if (entry.attempts > PERMANENT_FAIL_AFTER) {
      await db
        .update(outbox)
        .set({
          status: 'failed',
          lastError: `abandoned after ${entry.attempts} claims without completion`,
          processedAt: new Date(),
        })
        .where(eq(outbox.id, entry.id))
      permanentlyFailed++
      console.error(
        `[OUTBOX] entry ${entry.id} (${entry.kind}) abandoned — claimed ${entry.attempts} times without completing`
      )
      continue
    }

    try {
      await opts.process({ id: entry.id, kind: entry.kind, payload: entry.payload })
      // Mark done
      await db
        .update(outbox)
        .set({ status: 'done', processedAt: new Date(), lastError: null })
        .where(eq(outbox.id, entry.id))
      succeeded++
    } catch (err) {
      // attempts is already at its post-claim value; releasing the row only
      // moves it back to pending and reschedules it.
      const isPermanent = entry.attempts >= PERMANENT_FAIL_AFTER

      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, Math.min(entry.attempts, MAX_ATTEMPTS))
      const nextRunAt = new Date(Date.now() + backoffMs)

      await db
        .update(outbox)
        .set({
          status: isPermanent ? 'failed' : 'pending',
          lastError: err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 1000) : String(err).slice(0, 1000),
          scheduledAt: nextRunAt,
        })
        .where(eq(outbox.id, entry.id))

      if (isPermanent) {
        permanentlyFailed++
        // Surface for alerting once Sentry is wired in P0-16.
        console.error(
          `[OUTBOX] entry ${entry.id} (${entry.kind}) marked permanently failed after ${entry.attempts} attempts`,
          err
        )
      } else {
        failed++
      }
    }
  }

  return { processed: claimed.length, succeeded, failed, permanentlyFailed }
}
