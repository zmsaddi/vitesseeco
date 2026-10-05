/**
 * What the payment provider says about an order, asked before giving up on it.
 *
 * The sweep cancels online orders that are still awaiting payment after an
 * hour. Until this existed it decided that from our own database alone — and
 * our database is only as current as the last webhook that got through. A
 * webhook that failed during a database outage, or a SEPA debit that settles
 * days later, left an order the customer HAD paid looking abandoned, and the
 * sweep cancelled it and put the bike back on sale.
 *
 * So the provider is asked first, and "I could not find out" is never read as
 * "unpaid": an order is only cancelled on a positive answer that no money is
 * coming.
 */
import type Stripe from 'stripe'
import { stripe } from './stripe'
import { getPayPalOrder, paypalConfigured } from './paypal'

/**
 *  paid     money arrived — the order should be paid, not cancelled
 *  pending  money is on its way (delayed methods) — leave it alone
 *  unpaid   the provider confirms nothing is coming — safe to cancel
 *  unknown  the provider could not be asked — leave it for the next run
 */
export type PaymentState = 'paid' | 'pending' | 'unpaid' | 'unknown'

export interface ProbeTarget {
  orderNumber: string
  paymentMethod: string
  stripeSessionId: string | null
  paypalOrderId: string | null
  paypalCaptureId: string | null
}

export type PaymentProbe = (order: ProbeTarget) => Promise<PaymentState>

/**
 * A Checkout Session read as a payment state. Pure, so it is tested directly.
 *
 * Complete-but-unpaid is a delayed method (SEPA, some bank redirects). Its
 * PaymentIntent says whether money is still travelling or the attempt is dead:
 * without that distinction a failed debit would be deferred on every run,
 * forever, holding a place at the front of the sweep.
 */
export function stateOfSession(
  session: Pick<Stripe.Checkout.Session, 'status' | 'payment_status'> & {
    payment_intent?: string | Pick<Stripe.PaymentIntent, 'status'> | null
  }
): PaymentState {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return 'paid'
  if (session.status === 'expired') return 'unpaid'
  if (session.status === 'complete') {
    const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null
    switch (intent?.status) {
      case 'succeeded':
        return 'paid'
      case 'canceled':
      case 'requires_payment_method':
        return 'unpaid'
      default:
        // processing, requires_action, or not expanded: money may still come.
        return 'pending'
    }
  }
  // Still open: the customer could pay in the next second.
  return 'unknown'
}

/**
 * A PayPal order read as a payment state. Pure, so it is tested directly.
 *
 * The capture id on OUR row is not enough: PayPal charges first and our row is
 * written after, so a connection that dies between the two leaves money taken
 * and nothing recorded — exactly the outage this sweep must survive.
 */
export function stateOfPayPalOrder(order: { status: string; captureId: string | null }): PaymentState {
  if (order.status === 'COMPLETED' && order.captureId) return 'paid'
  // Approved by the payer but never captured: no money moved, and nothing will
  // capture it now — the capture endpoint only runs while the payer waits.
  if (['CREATED', 'APPROVED', 'VOIDED', 'PAYER_ACTION_REQUIRED'].includes(order.status)) return 'unpaid'
  return 'unknown'
}

export const providerPaymentState: PaymentProbe = async (order) => {
  if (order.paymentMethod === 'paypal') {
    // A capture id on our side is money taken, whatever PayPal says next.
    if (order.paypalCaptureId) return 'paid'
    // No PayPal order was ever created: the checkout failed before PayPal saw it.
    if (!order.paypalOrderId) return 'unpaid'
    if (!paypalConfigured()) return 'unknown'
    try {
      return stateOfPayPalOrder(await getPayPalOrder(order.paypalOrderId))
    } catch (error) {
      // An order PayPal no longer knows (they expire unapproved) was never paid;
      // anything else — a timeout, a 5xx — is not an answer.
      if (/answered 404/.test(String((error as { internal?: string })?.internal ?? error))) return 'unpaid'
      console.warn(`[reconcile] could not ask PayPal about ${order.orderNumber}:`, String(error).slice(0, 200))
      return 'unknown'
    }
  }
  if (order.paymentMethod !== 'stripe') return 'unknown'
  // No session was ever attached: the checkout failed before Stripe saw it.
  if (!order.stripeSessionId) return 'unpaid'
  try {
    return stateOfSession(
      await stripe().checkout.sessions.retrieve(order.stripeSessionId, { expand: ['payment_intent'] })
    )
  } catch (error) {
    // A session this account has never heard of can never be paid here.
    if ((error as { code?: string })?.code === 'resource_missing') return 'unpaid'
    console.warn(`[reconcile] could not ask Stripe about ${order.orderNumber}:`, String(error).slice(0, 200))
    return 'unknown'
  }
}
