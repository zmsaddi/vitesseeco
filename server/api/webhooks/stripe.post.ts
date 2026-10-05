/**
 * Stripe webhooks.
 *
 * Three properties matter here, and each is enforced rather than assumed:
 *
 *  1. The signature is verified against the RAW body before anything is
 *     parsed. An unsigned or mis-signed request is rejected outright.
 *  2. Every event is recorded by its provider id under a unique index, so a
 *     redelivery collides and becomes a no-op. Stripe retries for three days,
 *     and the previous build let a redelivered event reset a shipped order to
 *     paid.
 *  3. Completion is not payment. iDEAL and Bancontact settle after the session
 *     completes, so a session still marked unpaid waits for the async event.
 *     Shipping a bike against a transfer that later fails is the failure this
 *     avoids.
 *
 * This route is deliberately NOT wrapped by defineRoute: it has no session, its
 * caller is Stripe rather than a browser, and it needs the unparsed body.
 */
import { defineEventHandler, getHeader, readRawBody, setResponseStatus } from 'h3'
import { sql } from 'drizzle-orm'
import { db } from '../../db/client'
import { webhookEvents } from '../../db/schema'
import { claimWebhookEvent } from '../../services/webhookClaims'
import { outcomeFor, verifyWebhook } from '../../payments/stripe'
import { findOrderByStripeSession, transitionOrder } from '../../services/orders'
import { AppError, toAppError } from '../../../shared/errors'
import { applyApiHeaders } from '../../security/headers'

export default defineEventHandler(async (event) => {
  applyApiHeaders(event)

  const rawBody = await readRawBody(event, 'utf8')
  if (!rawBody) {
    setResponseStatus(event, 400)
    return { received: false }
  }

  let stripeEvent
  try {
    stripeEvent = verifyWebhook(rawBody, getHeader(event, 'stripe-signature'))
  } catch (error) {
    const appError = toAppError(error)
    console.warn(`[webhook] rejected: ${appError.internal ?? appError.message}`)
    setResponseStatus(event, 400)
    return { received: false }
  }

  // Claim the event. A redelivery of a processed event conflicts and is
  // skipped; a redelivery of a FAILED one is claimed again and re-run
  // (server/services/webhookClaims.ts says why that is safe).
  const claim = await claimWebhookEvent({
    provider: 'stripe',
    eventId: stripeEvent.id,
    type: stripeEvent.type,
    payload: JSON.stringify(stripeEvent.data.object),
  })

  if (claim.state === 'processed') {
    // Done before. Acknowledge so Stripe stops retrying.
    return { received: true, duplicate: true }
  }
  if (claim.state === 'in_flight') {
    // Another attempt is processing it right now. Not acknowledged: if that
    // attempt dies, Stripe's next retry finds a stale claim and takes it over.
    setResponseStatus(event, 409)
    return { received: false, inFlight: true }
  }
  const recordId = claim.id

  try {
    await handle(stripeEvent)
    await db()
      .update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(sql`${webhookEvents.id} = ${recordId}`)
    return { received: true }
  } catch (error) {
    const appError = toAppError(error)
    console.error(`[webhook] ${stripeEvent.type} failed`, appError.internal ?? appError.message)

    await db()
      .update(webhookEvents)
      .set({ status: 'failed', error: (appError.internal ?? appError.message).slice(0, 1000) })
      .where(sql`${webhookEvents.id} = ${recordId}`)

    // A 500 asks Stripe to retry, and the retry claims the failed record again
    // — so an event that failed because the database was briefly unreachable
    // is processed once it is back, instead of being lost as a "duplicate".
    // The handler is idempotent; Stripe's backing-off schedule bounds a bug.
    setResponseStatus(event, 500)
    return { received: false }
  }
})

async function handle(stripeEvent: import('stripe').Stripe.Event): Promise<void> {
  const resolved = outcomeFor(stripeEvent)
  if (!resolved) return

  const order = await findOrderByStripeSession(resolved.sessionId)
  if (!order) {
    // Not ours, or the session was never attached. Nothing to do, and nothing
    // worth failing the delivery over.
    console.warn(`[webhook] no order for session ${resolved.sessionId}`)
    return
  }

  switch (resolved.outcome) {
    case 'paid':
      // Consumes the stock hold. Forward-only: an order already shipped stays
      // shipped, because the transition table forbids going back.
      await transitionOrder(order.orderNumber, 'paid', { expectFrom: 'awaiting_payment' })
      break

    case 'failed':
    case 'expired':
      // Releases the hold and gives back the promotion use.
      await transitionOrder(order.orderNumber, 'cancelled', { expectFrom: 'awaiting_payment' })
      break

    case 'pending':
      // Delayed settlement — iDEAL, Bancontact, SEPA. The order stays
      // awaiting_payment and the stock stays held until the async event lands.
      break
  }
}

export { AppError }
