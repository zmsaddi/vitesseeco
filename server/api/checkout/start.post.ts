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
import { placeOrder, attachPaymentSession, attachPayPalOrder } from '../../services/orders'
import { isOnline } from '../../payments'
import { createCheckoutSession } from '../../payments/stripe'
import { createPayPalOrder } from '../../payments/paypal'
import { toDecimalString } from '../../../shared/money'
import { AppError, ERROR_CODES } from '../../../shared/errors'
import { localizedUrl } from '../../../shared/locales'
import type { LocaleCode } from '../../../shared/locales'

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

    if (!isOnline(body.paymentMethod)) {
      // Cash: nothing to charge now. The order is agreed, the stock is held,
      // and an admin marks it paid when the money arrives.
      return { ...summary, mode: 'cash' as const }
    }

    if (body.paymentMethod === 'paypal') {
      // Temporary bridge (server/payments/paypal.ts). The amount handed to
      // PayPal is the placed order's own total; the browser stated nothing.
      const { paypalOrderId } = await createPayPalOrder({
        orderNumber: order.orderNumber,
        total: order.breakdown.total,
      })
      await attachPayPalOrder(order.id, paypalOrderId)
      return { ...summary, mode: 'paypal' as const, paypalOrderId }
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

    await attachPaymentSession(order.id, session.sessionId)

    return { ...summary, mode: 'stripe' as const, clientSecret: session.clientSecret }
  },
})
