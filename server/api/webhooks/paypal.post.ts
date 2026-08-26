/**
 * PayPal webhooks — the safety net of the temporary bridge
 * (server/payments/paypal.ts).
 *
 * The capture endpoint is the primary paid path; this exists for the tab that
 * closed between approval and capture. It keeps the three properties the
 * Stripe receiver enforces: the signature is verified against the RAW body
 * (by replaying it to PayPal's verification endpoint — PayPal's scheme, not
 * ours), every event is claimed under the (provider, event_id) unique index so
 * a redelivery is a no-op, and the paid flip is the same forward-only
 * `transitionOrder` everything else uses. PayPal redelivers for days; none of
 * those redeliveries may pull a shipped order backwards.
 *
 * Deliberately NOT wrapped by defineRoute, for the same reasons as the Stripe
 * receiver beside it: no session, no browser origin, and the unparsed body is
 * the thing being verified.
 */
import { defineEventHandler, readRawBody, setResponseStatus } from 'h3'
import { sql } from 'drizzle-orm'
import { db, queryRows } from '../../db/client'
import { webhookEvents } from '../../db/schema'
import { paypalConfigured, verifyPayPalWebhook, paidOrderNumberFromWebhook } from '../../payments/paypal'
import { transitionOrder } from '../../services/orders'
import { applyApiHeaders } from '../../security/headers'
import { toAppError } from '../../../shared/errors'

export default defineEventHandler(async (event) => {
  applyApiHeaders(event)

  // A bridge without credentials has no webhooks to receive.
  if (!paypalConfigured()) {
    setResponseStatus(event, 404)
    return { received: false }
  }

  const rawBody = await readRawBody(event, 'utf8')
  if (!rawBody) {
    setResponseStatus(event, 400)
    return { received: false }
  }

  const headers = Object.fromEntries(
    Object.entries(event.node.req.headers).map(([name, value]) => [
      name.toLowerCase(),
      Array.isArray(value) ? value[0] : value,
    ])
  ) as Record<string, string | undefined>

  if (!(await verifyPayPalWebhook(headers, rawBody))) {
    console.warn('[webhook] paypal delivery rejected: signature did not verify')
    setResponseStatus(event, 400)
    return { received: false }
  }

  let eventId: string | undefined
  let eventType: string | undefined
  try {
    const parsed = JSON.parse(rawBody) as { id?: string; event_type?: string }
    eventId = parsed.id
    eventType = parsed.event_type
  } catch {
    // Verified but unparseable cannot happen — verification parsed it — but a
    // guard beats a throw in a receiver.
  }
  if (!eventId) {
    setResponseStatus(event, 400)
    return { received: false }
  }

  // Claim the event; the unique index makes a redelivery conflict into a no-op.
  const claimed = await queryRows<{ id: string }>(
    db(),
    sql`
      INSERT INTO webhook_events (provider, event_id, type, payload, status)
      VALUES ('paypal', ${eventId}, ${eventType ?? 'unknown'}, ${rawBody}::jsonb, 'received')
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING id
    `
  )
  if (claimed.length === 0) {
    return { received: true, duplicate: true }
  }
  const recordId = claimed[0]?.id as string

  try {
    const orderNumber = paidOrderNumberFromWebhook(rawBody)
    if (orderNumber) {
      try {
        // Idempotent against the capture endpoint: whoever flips first wins,
        // the other updates nothing and settles nothing.
        await transitionOrder(orderNumber, 'paid', { expectFrom: 'awaiting_payment' })
      } catch (error) {
        const appError = toAppError(error)
        if (appError.code !== 'NOT_FOUND') throw error
        // Not ours, or a sandbox event against production. Nothing to do, and
        // nothing worth failing the delivery over — same rule as Stripe's.
        console.warn(`[webhook] paypal event for unknown order ${orderNumber}`)
      }
    }
    await db()
      .update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(sql`${webhookEvents.id} = ${recordId}`)
    return { received: true }
  } catch (error) {
    const appError = toAppError(error)
    console.error(`[webhook] paypal ${eventType ?? 'unknown'} failed`, appError.internal ?? appError.message)
    await db()
      .update(webhookEvents)
      .set({ status: 'failed', error: (appError.internal ?? appError.message).slice(0, 1000) })
      .where(sql`${webhookEvents.id} = ${recordId}`)
    // A 500 asks PayPal to retry; the retry hits the dedupe and is skipped —
    // a failure needs a human, not a loop of half-applied side effects.
    setResponseStatus(event, 500)
    return { received: false }
  }
})
