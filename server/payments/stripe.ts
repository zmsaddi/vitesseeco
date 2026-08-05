/**
 * Stripe.
 *
 * One integration carries every online method the shop will ever need:
 *
 *   cards            Visa, Mastercard, CB, Amex
 *   iDEAL            the Netherlands — a flat EUR 0.29, against PayPal's ~EUR 27 on a bike
 *   Bancontact       Belgium
 *   Klarna           pay later / in instalments
 *   PayPal           through Stripe, so it is one reconciliation instead of two
 *   SEPA debit       for higher-value or invoiced orders
 *   Apple / Google Pay  wallets, on the devices that offer them
 *
 * None of those are named in this file, and that is the point. With dynamic
 * payment methods, Stripe decides what to show from the amount, the currency
 * and the customer's country, and which ones are eligible is a switch in the
 * Stripe Dashboard. Adding Klarna is an afternoon decision by the owner, not a
 * release.
 *
 * That is the direct answer to "payment methods are hard to add": the previous
 * build needed a new adapter class, a registry entry, a document in the CMS and
 * an environment flag — four steps, and even completing all four did nothing
 * until someone deployed.
 *
 * The EMBEDDED form is used rather than Stripe's hosted page, because the
 * hosted page cannot update shipping options as the customer types an address,
 * and our free delivery is scoped to specific postal prefixes. Embedded also
 * keeps the customer on our own URL and our own design.
 */
import Stripe from 'stripe'
import type { Cents } from '../../shared/money'
import type { LocaleCode } from '../../shared/locales'
import { AppError, ERROR_CODES } from '../../shared/errors'
import type { PricedLine } from '../services/pricing'

let client: Stripe | null = null

export function stripe(): Stripe {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
      internal: 'STRIPE_SECRET_KEY is not set',
    })
  }
  client = new Stripe(key, {
    // Pinned deliberately: an API version that floats with the SDK means a
    // dependency bump can change how money behaves.
    apiVersion: '2026-06-24.dahlia',
    // A payment that fails because of one slow network hop should be retried,
    // and Stripe's own idempotency makes that safe.
    maxNetworkRetries: 2,
    timeout: 20_000,
  })
  return client
}

/**
 * Stripe Checkout does not support Arabic — it covers 57 locales and Arabic is
 * available only in Elements. An Arabic-speaking visitor therefore sees the
 * payment form in French, which is a recorded decision rather than a surprise:
 * Arabic is a site language, not one of the five target markets.
 */
const CHECKOUT_LOCALES: Record<LocaleCode, Stripe.Checkout.SessionCreateParams.Locale> = {
  fr: 'fr',
  en: 'en',
  nl: 'nl',
  de: 'de',
  es: 'es',
  ar: 'fr',
}

export interface CreateSessionInput {
  orderNumber: string
  orderId: string
  lines: PricedLine[]
  shippingCost: Cents
  discount: Cents
  locale: LocaleCode
  customerEmail: string
  shippingCountry: string
  returnUrl: string
}

/**
 * Create an embedded Checkout Session.
 *
 * Amounts come from our own pricing service and are sent to Stripe as integers
 * of cents. The client never states a price, so there is nothing to tamper
 * with, and Stripe holds the amount from here on.
 */
export async function createCheckoutSession(input: CreateSessionInput): Promise<{
  clientSecret: string
  sessionId: string
}> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: 'eur',
      // EU prices are shown and charged inclusive of VAT.
      tax_behavior: 'inclusive',
      unit_amount: line.unitPrice,
      product_data: {
        name: line.name,
        ...(line.color ? { description: line.color } : {}),
        ...(line.image ? { images: [line.image] } : {}),
        metadata: { productId: line.productId },
      },
    },
  }))

  if (input.shippingCost > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'eur',
        tax_behavior: 'inclusive',
        unit_amount: input.shippingCost,
        product_data: { name: 'Livraison', metadata: { kind: 'shipping' } },
      },
    })
  }

  // A basket discount is expressed to Stripe as a coupon so the customer sees
  // the same breakdown we computed, rather than a silently reduced unit price.
  const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = []
  if (input.discount > 0) {
    const coupon = await stripe().coupons.create({
      amount_off: input.discount,
      currency: 'eur',
      duration: 'once',
      name: 'Remise',
    })
    discounts.push({ coupon: coupon.id })
  }

  // The delivery country is known before Stripe is asked anything. Handing it
  // over as a customer address means the method list opens already filtered
  // to the customer's own country — a French buyer is not offered Bancontact,
  // a Dutch one sees iDEAL first — instead of everything the account can do.
  const customer = await stripe().customers.create(
    {
      email: input.customerEmail,
      address: { country: input.shippingCountry },
    },
    { idempotencyKey: `customer:${input.orderNumber}` }
  )

  const session = await stripe().checkout.sessions.create(
    {
      mode: 'payment',
      // `embedded_page`, not the hosted redirect: only this mode can update
      // shipping options while the customer types an address, which our
      // postal-prefix free delivery requires — and it keeps them on our URL.
      ui_mode: 'embedded_page',
      line_items: lineItems,
      ...(discounts.length > 0 ? { discounts } : {}),
      // `payment_method_types` is deliberately ABSENT. Omitting it is what puts
      // Stripe in charge: it picks from what is enabled in the Dashboard,
      // ordered by what the customer's country actually uses. Listing methods
      // here would freeze them in code and make every addition a deployment —
      // which is precisely the friction the owner asked to be rid of.
      locale: CHECKOUT_LOCALES[input.locale],
      // The customer object carries the email AND the delivery country — this
      // is what lets Stripe open the method list already filtered by country
      // instead of waiting for a billing address to be typed.
      customer: customer.id,
      return_url: input.returnUrl,
      // Ties the payment back to the order without trusting anything the
      // browser sends back on return.
      client_reference_id: input.orderNumber,
      metadata: { orderNumber: input.orderNumber, orderId: input.orderId },
      payment_intent_data: {
        metadata: { orderNumber: input.orderNumber },
        description: `Vitesse Eco ${input.orderNumber}`,
      },
      // A session that outlives its stock hold would let a customer pay for
      // units we have already given back.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    // Stripe's own idempotency, keyed on our order: a retried create returns
    // the same session instead of a second one.
    { idempotencyKey: `session:${input.orderNumber}` }
  )

  if (!session.client_secret) {
    throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
      internal: `Stripe returned no client_secret for ${input.orderNumber}`,
    })
  }

  return { clientSecret: session.client_secret, sessionId: session.id }
}

/**
 * Verify a webhook signature and return the event.
 *
 * The raw body is required — parsing it first changes the bytes the signature
 * was computed over, and the check silently starts failing.
 */
export function verifyWebhook(rawBody: string, signature: string | undefined): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
      internal: 'STRIPE_WEBHOOK_SECRET is not set',
    })
  }
  if (!signature) {
    throw new AppError(ERROR_CODES.FORBIDDEN, { internal: 'webhook arrived without a signature' })
  }

  try {
    return stripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (error) {
    throw new AppError(ERROR_CODES.FORBIDDEN, {
      internal: `webhook signature rejected: ${error instanceof Error ? error.message : String(error)}`,
      cause: error,
    })
  }
}

/**
 * Events we act on.
 *
 * `checkout.session.completed` does NOT mean the money arrived. iDEAL and
 * Bancontact are delayed-notification methods: the session completes, and the
 * funds settle afterwards. Treating completion as payment would ship a bike
 * against a transfer that later fails — so a session whose payment_status is
 * still `unpaid` waits for `async_payment_succeeded`, and
 * `async_payment_failed` cancels the order and gives the stock back.
 */
export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
] as const

export type HandledEvent = (typeof HANDLED_EVENTS)[number]

export function isHandled(type: string): type is HandledEvent {
  return (HANDLED_EVENTS as readonly string[]).includes(type)
}

/** What a session event means for the order. */
export type PaymentOutcome = 'paid' | 'pending' | 'failed' | 'expired'

export function outcomeFor(event: Stripe.Event): { outcome: PaymentOutcome; sessionId: string } | null {
  if (!isHandled(event.type)) return null
  const session = event.data.object as Stripe.Checkout.Session

  switch (event.type) {
    case 'checkout.session.completed':
      // Paid outright (card, wallet) versus awaiting settlement (iDEAL, SEPA).
      return { outcome: session.payment_status === 'paid' ? 'paid' : 'pending', sessionId: session.id }
    case 'checkout.session.async_payment_succeeded':
      return { outcome: 'paid', sessionId: session.id }
    case 'checkout.session.async_payment_failed':
      return { outcome: 'failed', sessionId: session.id }
    case 'checkout.session.expired':
      return { outcome: 'expired', sessionId: session.id }
  }
}
