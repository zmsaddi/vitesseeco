/**
 * Capture an approved PayPal payment. Temporary bridge — see
 * server/payments/paypal.ts for what leaves when Stripe's PayPal activates.
 *
 * The browser sends ONLY the order number. Which PayPal order that means is
 * read from our own row, and before any money moves PayPal is asked to state
 * the invoice id and amount it holds — both must match the order. A tampered
 * client can therefore neither capture someone else's payment into its order
 * nor capture a rewritten amount; the worst it can do is complete a payment
 * its payer already approved.
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
import { noteOnOrder, transitionOrder, recordPayPalCapture } from '../../services/orders'
import { audit } from '../../services/audit'
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
      // order stays awaiting payment and the capture unrecorded, since a
      // recorded capture reads as money taken: the capture's own
      // PAYMENT.CAPTURE.COMPLETED, or the sweep asking PayPal, settles it once
      // PayPal has.
      console.warn(`[paypal] capture ${captured.captureId} of ${body.orderNumber} is ${captured.captureStatus}; the order waits for PayPal`)
      await audit({
        action: 'order.paypal_capture_held',
        actorType: 'system',
        resourceType: 'order',
        resourceId: body.orderNumber,
        metadata: { paypalOrderId: order.paypalOrderId, captureId: captured.captureId, captureStatus: captured.captureStatus },
      })
      return { state: 'pending' as const }
    }

    if (captured.captureId) await recordPayPalCapture(body.orderNumber, captured.captureId)

    // Consumes the stock hold; forward-only, idempotent against the webhook.
    const moved = await transitionOrder(body.orderNumber, 'paid', { expectFrom: 'awaiting_payment' })

    // ── A capture that landed on a closed order ─────────────────────────────
    // PayPal took the money, but the order was cancelled while the payer
    // approved — by the sweep, or the shop. The order row is locked while it
    // moves, so `from` is where it really stood: a capture that lost the paid
    // flip to its own webhook reads 'paid', not this. The customer has paid; a
    // person must honour or refund it, and must hear about it — on the order
    // itself, where the panel shows it, not only in a log.
    if (!moved.changed && moved.from === 'cancelled') {
      console.error(
        `[paypal] capture ${captured.captureId} landed on ${body.orderNumber}, which is ${moved.from} — refund or honour it`
      )
      await audit({
        action: 'order.paypal_captured_on_closed_order',
        actorType: 'system',
        resourceType: 'order',
        resourceId: body.orderNumber,
        metadata: { paypalOrderId: order.paypalOrderId, captureId: captured.captureId, status: moved.from },
      })
      await noteOnOrder(
        body.orderNumber,
        `ATTENTION : paiement PayPal encaissé après l'annulation de la commande (capture ${captured.captureId ?? 'non communiquée'}). ` +
          `Stock non décompté — à honorer ou à rembourser à la main.`
      ).catch((error: unknown) => {
        // The payment is the fact and the answer must still reach the payer.
        console.error(`[paypal] ${body.orderNumber}: could not record the closed-order note`, error)
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
