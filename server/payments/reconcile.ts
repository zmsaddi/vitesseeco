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
  paypalCaptureId: string | null
}

export type PaymentProbe = (order: ProbeTarget) => Promise<PaymentState>

/** A Checkout Session read as a payment state. Pure, so it is tested directly. */
export function stateOfSession(session: Pick<Stripe.Checkout.Session, 'status' | 'payment_status'>): PaymentState {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return 'paid'
  // Complete but unpaid is a delayed method (SEPA, some bank redirects) whose
  // money is still travelling; async_payment_succeeded or _failed decides it.
  if (session.status === 'complete') return 'pending'
  if (session.status === 'expired') return 'unpaid'
  // Still open: the customer could pay in the next second.
  return 'unknown'
}

export const providerPaymentState: PaymentProbe = async (order) => {
  if (order.paymentMethod === 'paypal') {
    // Capture happens on our server, and its id is stored before the order
    // moves. An id with the order still awaiting payment means the move failed
    // after the money was taken.
    return order.paypalCaptureId ? 'paid' : 'unpaid'
  }
  if (order.paymentMethod !== 'stripe') return 'unknown'
  // No session was ever attached: the checkout failed before Stripe saw it.
  if (!order.stripeSessionId) return 'unpaid'
  try {
    return stateOfSession(await stripe().checkout.sessions.retrieve(order.stripeSessionId))
  } catch (error) {
    console.warn(`[reconcile] could not ask Stripe about ${order.orderNumber}:`, String(error).slice(0, 200))
    return 'unknown'
  }
}
