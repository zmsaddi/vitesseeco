/**
 * Claiming a provider event, once — and again when the first attempt failed.
 *
 * The unique index on (provider, event_id) makes a redelivery of a processed
 * event a no-op, which is the point. But the claim used to be
 * `ON CONFLICT DO NOTHING` whatever had happened to the first attempt, so an
 * event that FAILED — the database unreachable for a minute — answered every
 * retry with "duplicate" and was never processed. A Stripe payment that landed
 * during an outage left its order awaiting payment for good; the sweep then
 * cancelled it and restocked it while the customer had paid.
 *
 * A failed event, or one stuck at 'received' because the function died
 * mid-handle, can now be claimed again by the provider's retry. That is safe
 * because every handler is idempotent: order transitions are conditional on
 * the status they expect, so re-running a half-done event finishes it and
 * re-running a done one changes nothing. The provider's own retry schedule
 * (Stripe: about three days, backing off) is what bounds a genuine bug.
 */
import { sql } from 'drizzle-orm'
import { db, queryRows } from '../db/client'

/** A claim younger than this belongs to a handler that may still be running. */
const STALE_CLAIM_MINUTES = 5

/** The row id to process under, or null when someone already has. */
export async function claimWebhookEvent(input: {
  provider: 'stripe' | 'paypal'
  eventId: string
  type: string
  payload: string
}): Promise<string | null> {
  const rows = await queryRows<{ id: string }>(
    db(),
    sql`
      INSERT INTO webhook_events (provider, event_id, type, payload, status)
      VALUES (${input.provider}, ${input.eventId}, ${input.type}, ${input.payload}::jsonb, 'received')
      ON CONFLICT (provider, event_id) DO UPDATE
         SET status = 'received', error = NULL, received_at = NOW()
       WHERE webhook_events.status = 'failed'
          OR (webhook_events.status = 'received'
              AND webhook_events.received_at < NOW() - (${STALE_CLAIM_MINUTES} || ' minutes')::interval)
      RETURNING id
    `
  )
  return rows[0]?.id ?? null
}
