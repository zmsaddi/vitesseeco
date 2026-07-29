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
import { db, queryRows } from '../../db/client'
import { webhookEvents } from '../../db/schema'
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

  // Claim the event. The unique index on (provider, event_id) is what makes a
  // redelivery harmless: the insert conflicts, nothing is claimed, and the
  // handler below never runs a second time.
  const claimed = await queryRows<{ id: string }>(
    db(),
    sql`
      INSERT INTO webhook_events (provider, event_id, type, payload, status)
      VALUES ('stripe', ${stripeEvent.id}, ${stripeEvent.type}, ${JSON.stringify(stripeEvent.data.object)}::jsonb, 'received')
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING id
    `
  )

  if (claimed.length === 0) {
    // Already seen. Acknowledge so Stripe stops retrying.
    return { received: true, duplicate: true }
  }

  const recordId = claimed[0]?.id as string

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

    // A 500 asks Stripe to retry. The record is marked failed but keeps its
    // unique id, so a retry re-enters here and is skipped — deliberate: a
    // failure needs a human, not an infinite loop of half-applied side effects.
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
