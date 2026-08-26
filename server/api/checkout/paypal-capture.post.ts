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
import { transitionOrder, recordPayPalCapture } from '../../services/orders'
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

    if (captured.captureId) await recordPayPalCapture(body.orderNumber, captured.captureId)

    // Consumes the stock hold; forward-only, idempotent against the webhook.
    await transitionOrder(body.orderNumber, 'paid', { expectFrom: 'awaiting_payment' })

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
