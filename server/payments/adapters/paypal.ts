/**
 * PayPal adapter — Smart Checkout (Orders v2).
 *
 * Flow:
 *   1. /api/orders/create calls prepareCheckout() while creating the local
 *      order in 'pending' status.
 *   2. prepareCheckout() creates a PayPal Order via /v2/checkout/orders and
 *      returns the PayPal order id back to the browser as `clientPayload`.
 *   3. The browser uses PayPal Smart Buttons with that order id; user
 *      approves in the PayPal popup.
 *   4. /api/payments/paypal/capture-order captures the payment and flips the
 *      local order to 'paid'.
 *   5. The webhook handler is the safety net for missed captures (closed
 *      tab, network drop after approval, etc.).
 *
 * Invoice id = our orderNumber so PayPal-side searches reconcile to us.
 */
import { CheckoutPaymentIntent, type OrderRequest } from '@paypal/paypal-server-sdk'
import type { PaymentAdapter } from '~/server/payments/types'
import { getOrdersController, isPayPalEnabled, verifyPayPalWebhook } from '~/server/utils/paypal'
import { readRawBody } from 'h3'

function money(n: number): string {
  // PayPal requires fixed-2 decimals as a string.
  return n.toFixed(2)
}

export const paypalAdapter: PaymentAdapter = {
  code: 'paypal',

  async validate({ context }) {
    if (!isPayPalEnabled()) return { ok: false, reason: 'paypal_not_enabled' }
    if (context.total <= 0) return { ok: false, reason: 'zero_total_not_chargeable' }
    if (context.currency !== 'EUR') return { ok: false, reason: 'unsupported_currency' }
    // PayPal accepts orders without an email, but we want one for receipts /
    // dispute matching. The order route already collects guest email for
    // logged-in users; guests checking out via PayPal pass their PayPal email
    // post-capture instead — so this is a soft requirement.
    return { ok: true }
  },

  async prepareCheckout({ context }) {
    const ordersController = getOrdersController()

    const body: OrderRequest = {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          referenceId: context.orderNumber,
          invoiceId: context.orderNumber,
          customId: context.customer.customerId || undefined,
          description: `Vitesse Eco — ${context.orderNumber}`,
          amount: {
            currencyCode: 'EUR',
            value: money(context.total),
            breakdown: {
              itemTotal: { currencyCode: 'EUR', value: money(context.subtotal) },
              shipping: { currencyCode: 'EUR', value: money(context.shippingCost) },
              discount: { currencyCode: 'EUR', value: money(context.discount) },
            },
          },
          // PayPal validates that sum(items) === item_total exactly. We send
          // each line item so the customer sees an itemised breakdown in the
          // PayPal UI.
          items: context.items.map((it) => ({
            name: it.productName.slice(0, 127),
            sku: it.sku.slice(0, 127),
            quantity: String(it.quantity),
            unitAmount: { currencyCode: 'EUR', value: money(it.price) },
            // category omitted intentionally — defaults to PHYSICAL_GOODS
          })),
        },
      ],
    }

    const { result } = await ordersController.createOrder({ body, prefer: 'return=minimal' })

    if (!result?.id) {
      throw new Error('PayPal createOrder returned no id')
    }

    return {
      initialStatus: 'pending',
      externalPaymentId: result.id,
      clientPayload: { paypalOrderId: result.id },
    }
  },

  async verifyWebhook(event) {
    const headers = Object.fromEntries(
      Object.entries(event.node.req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v])
    ) as Record<string, string | undefined>
    const rawBody = (await readRawBody(event)) || ''
    const ok = await verifyPayPalWebhook({ headers, rawBody: String(rawBody) })
    if (!ok) return { ok: false }

    // Parsed payload is safe to use now that the signature checks out.
    let parsed: { event_type?: string; resource?: { invoice_id?: string; supplementary_data?: { related_ids?: { order_id?: string } }; purchase_units?: Array<{ invoice_id?: string }> } } = {}
    try { parsed = JSON.parse(String(rawBody)) } catch {}

    const eventType = parsed.event_type
    // Both completion events tell us the same thing: money moved.
    const completed = eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.COMPLETED'
    if (!completed) return { ok: true }

    // invoice_id is our orderNumber — set during prepareCheckout. Different
    // event types put it in different places, so check both.
    const invoiceId =
      parsed.resource?.invoice_id ||
      parsed.resource?.purchase_units?.[0]?.invoice_id

    return { ok: true, orderNumber: invoiceId, newStatus: 'paid' }
  },
}
