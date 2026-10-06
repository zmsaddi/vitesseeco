/**
 * Capture an approved PayPal payment. Temporary bridge — see
 * server/payments/paypal.ts for what leaves when Stripe's PayPal activates.
 *
 * The browser sends ONLY the order number. Which PayPal order that means is
 * read from our own row, and before any money moves PayPal is asked to state
 * the invoice id and amount it holds — both must match the order. A tampered
 * client can therefore neither capture someone else's payment into its order
 * nor capture a rewritten amount; the worst it can do is complete a payment
 * its payer already approved. Nor is money taken for units the order no longer
 * holds: an approval can come long after the stock hold lapsed.
 *
 * The paid flip is the same `transitionOrder` the Stripe webhook uses, so
 * stock consumption, forward-only status and the audit of money stay one
 * mechanism. The PayPal webhook is the safety net when this call never comes.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { db } from '../../db/client'
import { orders } from '../../db/schema'
import { capturePayPalOrder, getPayPalOrder } from '../../payments/paypal'
import { stateOfPayPalOrder } from '../../payments/reconcile'
import { transitionOrder, recordPayPalCapture } from '../../services/orders'
import { notifyOrder, reportPaymentOnClosedOrder } from '../../services/notify'
import { audit } from '../../services/audit'
import { holdStockForPayPalCapture, holdStockForPayPalReview } from '../../services/orders'
import { orderNumberSchema } from '../../../shared/schemas'
import { toDecimalString } from '../../../shared/money'
import { AppError, ERROR_CODES } from '../../../shared/errors'

export default defineRoute({
  access: 'public',
  rateLimit: 'checkout',
  body: z.object({ orderNumber: orderNumberSchema }).strict(),
  handler: async ({ body }) => {
    const [order] = await db()
      .select({
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        totalCents: orders.totalCents,
        paypalOrderId: orders.paypalOrderId,
      })
      .from(orders)
      .where(eq(orders.orderNumber, body.orderNumber))
      .limit(1)

    if (!order || order.paymentMethod !== 'paypal' || !order.paypalOrderId) {
      throw new AppError(ERROR_CODES.NOT_FOUND, {
        internal: `no capturable paypal order ${body.orderNumber}`,
      })
    }

    // A double click or a replayed request after the webhook already settled
    // it: the answer is the state, not an error.
    if (order.status === 'paid' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered') {
      return { state: 'paid' as const }
    }
    // Closed before the payer approved — swept, or cancelled by the shop.
    // Answered before PayPal is asked anything, so no money moves, and in the
    // words a replayed checkout gets (start.post.ts): the page drops its spent
    // purchase key on this message, so the next press starts a fresh purchase
    // instead of replaying the closed one.
    if (order.status === 'cancelled') {
      throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
        messageKey: 'errors.order_closed',
        internal: `capture asked for ${body.orderNumber}, which is cancelled`,
      })
    }
    if (order.status !== 'awaiting_payment') {
      throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
        internal: `order ${body.orderNumber} is ${order.status}, not awaiting_payment`,
      })
    }

    // What PayPal believes about this order, from PayPal — not from the
    // browser. The binding and the money must both agree before capture.
    const remote = await getPayPalOrder(order.paypalOrderId)
    const expected = toDecimalString(order.totalCents as never)
    if (remote.invoiceId !== body.orderNumber || remote.amountValue !== expected || remote.currency !== 'EUR') {
      await audit({
        action: 'order.paypal_capture_mismatch',
        actorType: 'system',
        resourceType: 'order',
        resourceId: body.orderNumber,
        metadata: {
          paypalOrderId: order.paypalOrderId,
          invoiceId: remote.invoiceId,
          amount: remote.amountValue,
          currency: remote.currency,
          expected,
        },
      })
      throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
        internal: `paypal order ${order.paypalOrderId} does not match ${body.orderNumber}`,
      })
    }

    // Approved: the capture below takes the money, and the units must be this
    // order's when it does. The buttons stay payable long after the thirty-
    // minute hold lapses, and a capture over a lapsed hold sold a bike another
    // customer had bought meanwhile. A live hold is stretched over the capture,
    // a lapsed one taken again if its units are still free; otherwise the
    // attempt is closed now, while nothing is charged, and the page starts over
    // on the words a closed order gets. Only an approved order is held for:
    // nothing else can be captured, so nothing else may keep a bike off sale —
    // and money PayPal already took (COMPLETED) is honoured whatever the hold.
    if (remote.status === 'APPROVED') {
      const hold = await holdStockForPayPalCapture(body.orderNumber)
      if (!hold.held) {
        if (['paid', 'processing', 'shipped', 'delivered'].includes(hold.status)) return { state: 'paid' as const }
        if (hold.status === 'cancelled') {
          throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
            messageKey: 'errors.order_closed',
            internal: `capture refused for ${body.orderNumber}: closed before the money moved — its stock was no longer held, or it was cancelled meanwhile`,
          })
        }
        throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
          internal: `order ${body.orderNumber} is ${hold.status}, not awaiting_payment`,
        })
      }
    }

    const captured = await capturePayPalOrder(order.paypalOrderId)
    if (captured.status !== 'COMPLETED') {
      // Not charged. The order stays awaiting_payment with its stock hold;
      // the customer can retry, and the sweep settles a walked-away attempt.
      throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
        internal: `paypal capture of ${order.paypalOrderId} ended ${captured.status}`,
      })
    }

    // The capture decides, not the order — the reading the sweep makes too
    // (payments/reconcile.ts). A COMPLETED order can carry a capture PayPal is
    // still reviewing, or one it declined; marking that paid released a bike
    // against money PayPal could still refuse. Only when PayPal lists no
    // capture at all (its minimal answer) does the order's COMPLETED stand.
    const settled = captured.captureId ? stateOfPayPalOrder(captured) : 'paid'
    if (settled === 'unpaid') {
      // Declined or failed: nothing was charged, as with an uncompleted order.
      throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
        internal: `paypal capture ${captured.captureId} of ${order.paypalOrderId} is ${captured.captureStatus}`,
      })
    }
    if (settled !== 'paid') {
      // Held by PayPal — a review — or something a person has to read. The
      // order stays awaiting payment, and the capture out of paypal_capture_id,
      // which reads as money taken: the capture's own PAYMENT.CAPTURE.COMPLETED,
      // or the sweep asking PayPal, settles it once PayPal has. Meanwhile the
      // bike stays this payer's — a thirty-minute hold put it back on sale while
      // PayPal was still deciding — and the order says why it waits, capture id
      // included.
      console.warn(`[paypal] capture ${captured.captureId} of ${body.orderNumber} is ${captured.captureStatus}; the order waits for PayPal`)
      await audit({
        action: 'order.paypal_capture_held',
        actorType: 'system',
        resourceType: 'order',
        resourceId: body.orderNumber,
        metadata: { paypalOrderId: order.paypalOrderId, captureId: captured.captureId, captureStatus: captured.captureStatus },
      })
      if (captured.captureId) {
        await holdStockForPayPalReview(body.orderNumber, { id: captured.captureId, status: captured.captureStatus }).catch(
          (error: unknown) => {
            // PayPal holds the payer's money either way; the answer must still
            // reach them, or they pay a second time.
            console.error(`[paypal] ${body.orderNumber}: could not hold the stock for PayPal's review`, error)
          }
        )
      }
      return { state: 'pending' as const }
    }

    if (captured.captureId) await recordPayPalCapture(body.orderNumber, captured.captureId)

    // Consumes the stock hold; forward-only, idempotent against the webhook.
    // `from` is the status as it stands — transitionOrder locks the row — so a
    // webhook that paid the order a moment earlier reads as paid, not as closed.
    const moved = await transitionOrder(body.orderNumber, 'paid', { expectFrom: 'awaiting_payment' })

    // ── A capture that landed on a closed order ─────────────────────────────
    // PayPal took the money, but the order was cancelled while the payer
    // approved — by the sweep, or the shop. The order row is locked while it
    // moves, so `from` is where it really stood: a capture that lost the paid
    // flip to its own webhook reads 'paid', not this. The customer has paid; a
    // person must honour or refund it, and must hear about it — on the order
    // itself, where the panel shows it, not only in a log.
    if (moved.changed) {
      // Whichever of this and the webhook moved the order announces it; the
      // other changed nothing and stays quiet.
      await notifyOrder(body.orderNumber, 'paid')
    } else if (moved.from === 'cancelled') {
      // Noted on the order, logged, audited and announced — once, whichever
      // path saw it first.
      await reportPaymentOnClosedOrder({
        orderNumber: body.orderNumber,
        provider: 'paypal',
        reference: captured.captureId,
        status: moved.from,
      })
    }
    // ── end of the closed-order capture ─────────────────────────────────────

    await audit({
      action: 'order.paypal_captured',
      actorType: 'system',
      resourceType: 'order',
      resourceId: body.orderNumber,
      metadata: { paypalOrderId: order.paypalOrderId, captureId: captured.captureId },
    })

    return { state: 'paid' as const }
  },
})
