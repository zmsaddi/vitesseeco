/**
 * Start a checkout.
 *
 * Places the order (which reserves stock and redeems any promotion in one
 * transaction), then either opens a Stripe session or, for cash, returns the
 * order straight away. The client is told what to render next; it is never told
 * an amount it could have influenced.
 */
import { defineRoute } from '../../security/handler'
import { verifyCaptcha } from '../../security/captcha'
import { clientIp } from '../../security/request'
import { startCheckoutSchema } from '../../../shared/schemas'
import {
  placeOrder,
  attachPaymentSession,
  attachPayPalOrder,
  holdStockForPayPalReview,
  recordPayPalCapture,
  transitionOrder,
} from '../../services/orders'
import { holdIsLive } from '../../services/stock'
import { audit } from '../../services/audit'
import { notifyOrder } from '../../services/notify'
import { isOnline } from '../../payments'
import { createCheckoutSession, stripe } from '../../payments/stripe'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { orders } from '../../db/schema'
import { createPayPalOrder, findPayPalOrder } from '../../payments/paypal'
import { stateOfPayPalOrder, type PaymentState } from '../../payments/reconcile'
import { toDecimalString } from '../../../shared/money'
import { AppError, ERROR_CODES } from '../../../shared/errors'
import { localizedUrl } from '../../../shared/locales'
import type { LocaleCode } from '../../../shared/locales'
import type { OrderStatus } from '../../../shared/schemas'

export default defineRoute({
  access: 'public',
  rateLimit: 'checkout',
  body: startCheckoutSchema,
  handler: async ({ event, body, customer, market }) => {
    // Verified FIRST, before the catalogue is read or a row is written. A check
    // that runs after the expensive work still lets an attacker cause it.
    await verifyCaptcha(body.captchaToken, clientIp(event))

    const email = customer?.email ?? body.email
    if (!email) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
        details: { issues: [{ path: 'email', message: 'an email address is required' }] },
        internal: 'guest checkout without an email',
      })
    }

    const order = await placeOrder({
      lines: body.cart.lines,
      locale: body.locale as LocaleCode,
      market,
      paymentMethod: body.paymentMethod,
      shipping: {
        methodCode: body.shipping.methodCode,
        country: body.shipping.destination.country,
        postalCode: body.shipping.destination.postalCode,
      },
      ...(body.shippingAddress ? { shippingAddress: body.shippingAddress } : {}),
      ...(body.billingAddress ? { billingAddress: body.billingAddress } : {}),
      ...(body.cart.promoCode ? { promoCode: body.cart.promoCode } : {}),
      ...(body.notes ? { notes: body.notes } : {}),
      idempotencyKey: body.idempotencyKey,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      customer: customer
        ? {
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
          }
        : null,
      guestEmail: email,
    })

    const summary = {
      orderNumber: order.orderNumber,
      total: toDecimalString(order.breakdown.total),
      subtotal: toDecimalString(order.breakdown.subtotal),
      discount: toDecimalString(order.breakdown.discount),
      shipping: toDecimalString(order.breakdown.shipping),
    }

    // A replayed request returns the order as it now stands. A cancelled one —
    // an abandoned attempt the sweep closed, or one the shop cancelled — is never
    // shown as placed, whatever the method: the browser is told to start a fresh
    // purchase (the message key tells the cases apart; details stay private).
    if (order.status === 'cancelled') {
      throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
        messageKey: 'errors.order_closed',
        internal: `checkout replayed for ${order.orderNumber}, which is cancelled`,
      })
    }

    if (!isOnline(body.paymentMethod)) {
      // Cash: nothing to charge now. The order is agreed, the stock is held,
      // and an admin marks it paid when the money arrives — so the owner is
      // told now, once: a replayed request is the same order, not a new one.
      if (!order.replayed) await notifyOrder(order.orderNumber, 'placed')
      return { ...summary, mode: 'cash' as const }
    }

    // Only an online order still awaiting payment may be offered a way to pay:
    // minting a payment for one already paid would take the money twice.
    if (order.status !== 'awaiting_payment') {
      throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
        messageKey: 'errors.order_already_paid',
        internal: `checkout replayed for ${order.orderNumber}, which is ${order.status}`,
      })
    }

    if (body.paymentMethod === 'paypal') {
      // Temporary bridge (server/payments/paypal.ts).
      //
      // A replay: the buttons it showed may have been used and the capture's
      // answer lost on the way back — so PayPal is asked first, and money it
      // took settles the order instead of being offered a second time. Then the
      // rule a card replay follows: nothing is shown again over a hold that has
      // lapsed, since its units may be someone else's by now — re-showing the
      // buttons there sold a bike another customer had paid for. The attempt
      // is closed and the page starts a fresh purchase, which reserves the
      // ordinary way.
      const [attached] = await db()
        .select({ paypalOrderId: orders.paypalOrderId })
        .from(orders)
        .where(eq(orders.id, order.id))
        .limit(1)
      const asked: PaymentState | null = attached?.paypalOrderId
        ? await settlePayPalAttempt(order.orderNumber, attached.paypalOrderId)
        : null
      if (asked === 'paid' || asked === 'pending') {
        throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
          messageKey: 'errors.order_already_paid',
          internal: `checkout replayed for ${order.orderNumber}, whose PayPal payment is ${asked}`,
        })
      }
      if (!(await holdIsLive(db(), order.id))) {
        if (asked === 'unknown') {
          // Approved a moment ago, or refunded: neither paid nor provably
          // unpaid, and nothing is closed on that.
          throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
            internal: `checkout replayed for ${order.orderNumber}: its hold lapsed and PayPal's answer settles nothing yet`,
          })
        }
        throw await closeAttempt(order.orderNumber, 'its stock hold lapsed before PayPal was paid')
      }

      // The amount handed to PayPal is the placed order's own total; the
      // browser stated nothing.
      const { paypalOrderId } = await createPayPalOrder({
        orderNumber: order.orderNumber,
        total: order.breakdown.total,
      })
      await attachPayPalOrder(order.id, paypalOrderId)
      return { ...summary, mode: 'paypal' as const, paypalOrderId }
    }

    // A replay of an order that already has a session reuses it while it can
    // still be paid. Overwriting it orphaned the first one: paid later, its
    // webhook found no order, and the money matched nothing.
    const [attached] = await db()
      .select({ sessionId: orders.stripeSessionId })
      .from(orders)
      .where(eq(orders.id, order.id))
      .limit(1)
    if (attached?.sessionId) {
      const existing = await stripe().checkout.sessions.retrieve(attached.sessionId)
      if (existing.status === 'open' && existing.client_secret) {
        return { ...summary, mode: 'stripe' as const, clientSecret: existing.client_secret }
      }
      if (existing.status === 'complete') {
        throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
          messageKey: 'errors.order_already_paid',
          internal: `checkout replayed for ${order.orderNumber}, whose session is already complete`,
        })
      }
      if (existing.status !== 'expired') {
        // Open, yet with nothing to mount it by: not a session this route
        // opened. Nothing is cancelled on a reading this odd.
        throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
          internal: `session ${existing.id} of ${order.orderNumber} is ${existing.status} without a client secret`,
        })
      }
      // Expired — and the stock hold with it, stretched to that very moment. A
      // second session would be payable over units that may be someone else's
      // by now: replacing the dead one sold the same bike twice. So the attempt
      // is over. It is closed as its lost expiry event would have closed it,
      // which frees a single-use promotion too, and the page starts a fresh
      // purchase, whose new order reserves its stock like any other.
      throw await closeAttempt(order.orderNumber, `its session ${existing.id} expired`)
    }

    // No session yet on a replay: the first attempt failed before one was
    // attached. A hold that has lapsed since is not revived, for the same reason.
    if (!(await holdIsLive(db(), order.id))) {
      throw await closeAttempt(order.orderNumber, 'its stock hold lapsed before a session was opened')
    }

    const session = await createCheckoutSession({
      orderNumber: order.orderNumber,
      orderId: order.id,
      lines: order.breakdown.lines,
      shippingCost: order.breakdown.shipping,
      discount: order.breakdown.discount,
      locale: body.locale as LocaleCode,
      customerEmail: email,
      shippingCountry: body.shipping.destination.country,
      // The order number rides along so the confirmation page can greet the
      // customer with it — the session id alone names nothing a human keeps.
      returnUrl: `${localizedUrl('/commande/confirmation', body.locale as LocaleCode)}?order=${order.orderNumber}&session={CHECKOUT_SESSION_ID}`,
    })

    const outcome = await attachPaymentSession(order.id, { id: session.sessionId, payableUntil: session.expiresAt })
    if (!outcome.attached) {
      // The order moved while Stripe was being asked — cancelled by the sweep
      // or the shop — or its hold lapsed meanwhile. The new session was never
      // handed to anyone; it is expired as well, so nothing stays payable for
      // an order that cannot take the money.
      await stripe()
        .checkout.sessions.expire(session.sessionId)
        .catch((error: unknown) => {
          console.warn(`[checkout] could not expire unattached session ${session.sessionId}:`, String(error).slice(0, 200))
        })
      if (outcome.holdLapsed) {
        throw await closeAttempt(order.orderNumber, 'its stock hold lapsed while its session was opened')
      }
      throw refusal(order.orderNumber, outcome.status, 'it changed while its session was opened')
    }

    return { ...summary, mode: 'stripe' as const, clientSecret: session.clientSecret }
  },
})

/**
 * End an attempt that can no longer be paid, as its lost expiry event would
 * have — its hold and any promotion use go back — and return what the browser
 * is told: start a fresh purchase, or, had it been paid meanwhile, that it is.
 */
async function closeAttempt(orderNumber: string, why: string): Promise<AppError> {
  const moved = await transitionOrder(orderNumber, 'cancelled', { expectFrom: 'awaiting_payment' })
  return refusal(orderNumber, moved.changed ? 'cancelled' : moved.from, why)
}

/** The answer to a replay that cannot be paid, worded the way the page acts on. */
function refusal(orderNumber: string, status: OrderStatus, why: string): AppError {
  const paid = status !== 'cancelled' && status !== 'draft' && status !== 'awaiting_payment'
  return new AppError(ERROR_CODES.ALREADY_PROCESSED, {
    messageKey: paid ? 'errors.order_already_paid' : 'errors.order_closed',
    internal: `checkout refused for ${orderNumber} (${status}): ${why}`,
  })
}

/**
 * What became of a PayPal attempt, asked of PayPal before anything is decided
 * about it. Money PayPal took settles the order now, as the sweep would; a
 * capture PayPal is still reviewing keeps its units for the review. Throws when
 * PayPal cannot be asked: nothing is closed on silence.
 */
async function settlePayPalAttempt(orderNumber: string, paypalOrderId: string): Promise<PaymentState> {
  const remote = await findPayPalOrder(paypalOrderId)
  // An order PayPal no longer knows (they expire unapproved) was never paid.
  if (!remote) return 'unpaid'
  const state = stateOfPayPalOrder(remote)
  if (state === 'paid' && remote.captureId) {
    await recordPayPalCapture(orderNumber, remote.captureId)
    const moved = await transitionOrder(orderNumber, 'paid', { expectFrom: 'awaiting_payment' })
    if (moved.changed) {
      await audit({
        action: 'order.reconciled_paid',
        actorType: 'system',
        resourceType: 'order',
        resourceId: orderNumber,
        metadata: { reason: 'checkout replayed; PayPal reports the capture its answer never brought back', captureId: remote.captureId },
      })
    }
  } else if (state === 'pending' && remote.captureId) {
    await holdStockForPayPalReview(orderNumber, { id: remote.captureId, status: remote.captureStatus })
  }
  return state
}
