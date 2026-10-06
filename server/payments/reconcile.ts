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
import { findPayPalOrder, paypalConfigured } from './paypal'

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
export function stateOfPayPalOrder(
  order: {
    status: string
    captureId: string | null
    captureStatus?: string | null
    createTime?: string | null
    updateTime?: string | null
  },
  now: Date = new Date()
): PaymentState {
  if (order.status === 'COMPLETED' && order.captureId) {
    // The capture decides, not the order: a COMPLETED order can carry a capture
    // still pending, declined, or already refunded.
    switch (order.captureStatus ?? 'COMPLETED') {
      case 'COMPLETED':
        return 'paid'
      case 'PENDING':
        return 'pending'
      case 'DECLINED':
      case 'FAILED':
        return 'unpaid'
      default:
        // Refunded or partly refunded: money moved and moved back. A person decides.
        return 'unknown'
    }
  }
  if (order.status === 'APPROVED') {
    // Approved but not captured. Usually abandoned — but a capture may be in
    // flight right now, from a payer who approved late. Only an approval that
    // has sat untouched past a grace period is read as nothing coming.
    //
    // Counted from PayPal's last change when it states one. An approved,
    // uncaptured order usually carries its create_time alone, and waiting for an
    // update_time that never comes deferred it on every run until PayPal forgot
    // the order hours later — its promotion use held all that time, and its
    // capture still possible long after the stock hold had lapsed.
    const stamp = order.updateTime ?? order.createTime
    const changed = stamp ? Date.parse(stamp) : Number.NaN
    return Number.isFinite(changed) && now.getTime() - changed > APPROVAL_GRACE_MS ? 'unpaid' : 'unknown'
  }
  if (['CREATED', 'VOIDED', 'PAYER_ACTION_REQUIRED'].includes(order.status)) return 'unpaid'
  return 'unknown'
}

/** How long an approved-but-uncaptured PayPal order is given before it counts as abandoned. */
export const APPROVAL_GRACE_MS = 15 * 60_000

/**
 * Whether Stripe's "no such session" means no money ever came through it.
 *
 * Asked in its own mode, it does. A LIVE session looked up with a test key is
 * "not found" for a reason that says nothing about payment, so it proves
 * nothing. A TEST session looked up with a live key is the other way round:
 * test money is never real, so whatever happened to it, nothing was paid here —
 * read as "unknown", such an order (a preview sharing this database) was
 * deferred on every run, forever, holding its promotion use.
 */
export function missingSessionMeansUnpaid(sessionId: string, secretKey: string | undefined): boolean {
  const sessionLive = sessionId.startsWith('cs_live_')
  const keyLive = /^(sk|rk)_live_/.test(secretKey ?? '')
  return !sessionLive || keyLive
}

export const providerPaymentState: PaymentProbe = async (order) => {
  if (order.paymentMethod === 'paypal') {
    // A capture id on our side is money taken, whatever PayPal says next.
    if (order.paypalCaptureId) return 'paid'
    // No PayPal order was ever created: the checkout failed before PayPal saw it.
    if (!order.paypalOrderId) return 'unpaid'
    if (!paypalConfigured()) return 'unknown'
    try {
      const found = await findPayPalOrder(order.paypalOrderId)
      // An order PayPal no longer knows (they expire unapproved) was never paid.
      return found ? stateOfPayPalOrder(found) : 'unpaid'
    } catch (error) {
      // A timeout, a 5xx, a credentials problem: not an answer.
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
    // A session this account has never heard of can never be paid here — but
    // only if we asked in the right mode. A live session looked up with a test
    // key is "missing" for a reason that says nothing about payment.
    if ((error as { code?: string })?.code === 'resource_missing') {
      if (missingSessionMeansUnpaid(order.stripeSessionId, process.env.STRIPE_SECRET_KEY)) return 'unpaid'
      console.warn(`[reconcile] ${order.orderNumber}: session ${order.stripeSessionId} is from another Stripe mode than the key`)
      return 'unknown'
    }
    console.warn(`[reconcile] could not ask Stripe about ${order.orderNumber}:`, String(error).slice(0, 200))
    return 'unknown'
  }
}

/**
 * Before an unpaid online order is cancelled by hand: shut the door the money
 * would come through, then say whether any already did.
 *
 * Cancelling used to leave the Checkout Session open. A customer still on the
 * payment form could pay a minute later — for an order already cancelled, its
 * bike already back on sale — and be told the payment had failed. An open
 * session is expired first, after which Stripe refuses to take the money, and
 * then read again: it may have completed in between. A PayPal order cannot be
 * shut from here; its approval grace period (stateOfPayPalOrder) covers a
 * payer who is capturing right now.
 *
 * Only 'unpaid' means the order can be cancelled.
 */
export async function closeCheckout(order: ProbeTarget): Promise<PaymentState> {
  if (order.paymentMethod === 'stripe' && order.stripeSessionId) {
    try {
      const session = await stripe().checkout.sessions.retrieve(order.stripeSessionId)
      if (session.status === 'open') await stripe().checkout.sessions.expire(order.stripeSessionId)
    } catch (error) {
      // Completed a moment ago, or Stripe unreachable: the read below decides.
      console.warn(`[reconcile] could not expire ${order.stripeSessionId}:`, String(error).slice(0, 200))
    }
  }
  return providerPaymentState(order)
}
