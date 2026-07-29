/**
 * Outbox processor route (P0-12).
 *
 * Triggered by an external free cron service (e.g. cron-job.org) every
 * 5–15 minutes — see ADR-08 / Q-08. Authenticated via CRON_SECRET header
 * to prevent random callers from forcing work on the database.
 *
 * Also re-usable as an in-process opportunistic flush: import drainOutbox()
 * directly from server/utils/outbox.ts at the end of an order request.
 */

import { drainOutbox } from '~/server/utils/outbox'
import { dispatchOutboxEntry } from '~/server/utils/sanitySync'
import { sweepAbandonedOrders, pruneTelemetry, type SweepResult } from '~/server/utils/abandonedOrders'

export default defineEventHandler(async (event) => {
  // Auth: require CRON_SECRET header to match env var. Without this, anyone
  // could DoS the DB by hitting the route in a tight loop.
  const expected = process.env.CRON_SECRET
  if (!expected) {
    throw createError({ statusCode: 503, message: 'CRON_SECRET not configured' })
  }
  const provided = getRequestHeader(event, 'x-cron-secret')
  if (provided !== expected) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const result = await drainOutbox({
    batchSize: 25,
    process: dispatchOutboxEntry,
  })

  // Housekeeping rides along on the same schedule. Failures here must not fail
  // the outbox drain, which is the part that keeps Sanity converged.
  let abandoned: SweepResult | null = null
  let pruned: Awaited<ReturnType<typeof pruneTelemetry>> | null = null
  try {
    abandoned = await sweepAbandonedOrders()
  } catch (err) {
    console.error('[CRON] abandoned-order sweep failed', err)
  }
  try {
    pruned = await pruneTelemetry()
  } catch (err) {
    console.error('[CRON] telemetry prune failed', err)
  }

  return { ok: true, ...result, abandoned, pruned }
})
