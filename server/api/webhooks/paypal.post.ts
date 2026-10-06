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
import { db } from '../../db/client'
import { webhookEvents } from '../../db/schema'
import { claimWebhookEvent } from '../../services/webhookClaims'
import { captureIdFromWebhook, paypalConfigured, verifyPayPalWebhook, paidOrderNumberFromWebhook } from '../../payments/paypal'
import { transitionOrder } from '../../services/orders'
import { notifyOrder, reportPaymentOnClosedOrder } from '../../services/notify'
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

  // Claim the event; a processed one is a no-op, a failed one is re-run
  // (server/services/webhookClaims.ts).
  const claim = await claimWebhookEvent({ provider: 'paypal', eventId, type: eventType ?? 'unknown', payload: rawBody })
  if (claim.state === 'processed') {
    return { received: true, duplicate: true }
  }
  if (claim.state === 'in_flight') {
    // Not acknowledged, so PayPal retries after the claim has gone stale.
    setResponseStatus(event, 409)
    return { received: false, inFlight: true }
  }
  const recordId = claim.id

  try {
    const orderNumber = paidOrderNumberFromWebhook(rawBody)
    if (orderNumber) {
      try {
        // Idempotent against the capture endpoint: whoever flips first wins,
        // the other updates nothing and settles nothing.
        const moved = await transitionOrder(orderNumber, 'paid', { expectFrom: 'awaiting_payment' })
        if (moved.changed) {
          await notifyOrder(orderNumber, 'paid')
        } else if (moved.from === 'cancelled') {
          // Captured, but the order closed first. The capture endpoint reports
          // the same payment under the same capture id, so the owner hears of
          // it once whichever path sees it first.
          await reportPaymentOnClosedOrder({
            orderNumber,
            provider: 'paypal',
            reference: captureIdFromWebhook(rawBody),
            status: moved.from,
          })
        }
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
    // A 500 asks PayPal to retry, and the retry claims the failed record again;
    // the capture transition is idempotent, so a re-run finishes what failed.
    setResponseStatus(event, 500)
    return { received: false }
  }
})
