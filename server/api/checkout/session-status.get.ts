/**
 * The payment state behind a confirmation page.
 *
 * The session id is an unguessable capability: Stripe hands it only to the
 * browser it redirected back, so holding it IS the authorisation to ask. The
 * answer is one word about one payment — no amounts, no addresses, no names.
 *
 * The DATABASE answers first, because money is asserted there and nowhere
 * else. Stripe is consulted only while our row still says awaiting_payment —
 * the webhook may be seconds behind the redirect, and a customer staring at
 * "processing" for a payment Stripe already settled would reload into support
 * mail. A delayed method (iDEAL, Bancontact, SEPA) can genuinely sit unpaid
 * for hours; that is `processing`, and the webhook will finish the story.
 */
import { z } from 'zod'
import Stripe from 'stripe'
import { defineRoute } from '../../security/handler'
import { stripe } from '../../payments/stripe'
import { findOrderByStripeSession } from '../../services/orders'
import { AppError, ERROR_CODES } from '../../../shared/errors'

export type PaymentState = 'paid' | 'processing' | 'failed'

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  query: z
    .object({
      session: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/).max(200),
    })
    .strict(),
  handler: async ({ query }): Promise<{ state: PaymentState; orderNumber: string }> => {
    const order = await findOrderByStripeSession(query.session)
    if (!order) {
      throw new AppError(ERROR_CODES.NOT_FOUND, {
        internal: `no order carries session ${query.session.slice(0, 20)}…`,
      })
    }

    // Our row is the verdict for every settled fate.
    if (order.status === 'cancelled') {
      return { state: 'failed', orderNumber: order.orderNumber }
    }
    if (order.status !== 'awaiting_payment' && order.status !== 'draft') {
      // paid and everything after it — the money arrived and stayed.
      return { state: 'paid', orderNumber: order.orderNumber }
    }

    // Still awaiting: ask Stripe where the session actually stands, so the
    // seconds between redirect and webhook do not read as limbo.
    let session: Stripe.Checkout.Session
    try {
      session = await stripe().checkout.sessions.retrieve(query.session)
    } catch {
      // Stripe unreachable is not a customer problem: the truthful answer for
      // an order that is still awaiting payment is that it is in flight.
      return { state: 'processing', orderNumber: order.orderNumber }
    }

    if (session.status === 'complete') {
      return {
        state: session.payment_status === 'unpaid' ? 'processing' : 'paid',
        orderNumber: order.orderNumber,
      }
    }
    // `open` — the customer left the form without finishing; `expired` — the
    // session died with the stock hold. Either way, no money moved.
    return { state: 'failed', orderNumber: order.orderNumber }
  },
})
