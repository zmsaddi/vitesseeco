/**
 * Payment methods.
 *
 * Three, and only three, will ever be listed here:
 *
 *   stripe    every online method, chosen by Stripe from the amount and the
 *             customer's country — cards, iDEAL, Bancontact, Klarna, PayPal,
 *             SEPA, Apple Pay, Google Pay. Enabling one is a Dashboard switch.
 *   cod       cash to our own driver, in Belgium and the Netherlands
 *   in_store  cash or card at the counter in Poitiers
 *
 * The cash methods are not a shortcoming of the design; they are the business.
 * No payment processor on earth can collect notes at a customer's door, so
 * those two branches stay ours forever, and they are deliberately small.
 */
import { AppError, ERROR_CODES } from '../../shared/errors'
import type { Cents } from '../../shared/money'

export type PaymentMethodCode = 'stripe' | 'cod' | 'in_store'

export interface PaymentMethodDescriptor {
  code: PaymentMethodCode
  /** Whether the customer is sent to a payment form at all. */
  online: boolean
  /** Countries that may use it. Empty means everywhere we ship. */
  countries: string[]
  /** Shipping codes it is compatible with. Empty means all of them. */
  shippingCodes: string[]
  /** A ceiling for cash, because a driver should not carry unlimited notes. */
  maxAmount: Cents | null
}

const CASH_ON_DELIVERY_CEILING = 300_000 as Cents // EUR 3,000

export const PAYMENT_METHODS: Record<PaymentMethodCode, PaymentMethodDescriptor> = {
  stripe: {
    code: 'stripe',
    online: true,
    countries: [],
    shippingCodes: [],
    maxAmount: null,
  },
  cod: {
    code: 'cod',
    online: false,
    // Only where our own van goes. Handing cash to a third-party courier is a
    // different business with different risk.
    countries: ['BE', 'NL'],
    shippingCodes: [],
    maxAmount: CASH_ON_DELIVERY_CEILING,
  },
  in_store: {
    code: 'in_store',
    online: false,
    countries: [],
    // Only meaningful when the customer is coming to the shop anyway.
    shippingCodes: ['pickup'],
    maxAmount: null,
  },
}

export interface MethodContext {
  country: string
  shippingCode: string
  total: Cents
}

/** Methods a customer may actually choose for this basket and destination. */
export function availableMethods(context: MethodContext): PaymentMethodDescriptor[] {
  return Object.values(PAYMENT_METHODS).filter((method) => eligible(method, context))
}

function eligible(method: PaymentMethodDescriptor, context: MethodContext): boolean {
  const country = context.country.toUpperCase()
  if (method.countries.length > 0 && !method.countries.includes(country)) return false
  if (method.shippingCodes.length > 0 && !method.shippingCodes.includes(context.shippingCode)) return false
  if (method.maxAmount !== null && context.total > method.maxAmount) return false
  // Nothing free to pay for; the order should not have reached a payment step.
  if (context.total <= 0) return false
  return true
}

/**
 * Reject a method the customer is not entitled to.
 *
 * Called on the server at order time, not just when the options were listed —
 * the browser chooses from a list, but the list is not the authority.
 */
export function assertMethodAllowed(code: PaymentMethodCode, context: MethodContext): void {
  const method = PAYMENT_METHODS[code]
  if (!method || !eligible(method, context)) {
    throw new AppError(ERROR_CODES.UNKNOWN_PAYMENT_METHOD, {
      internal:
        `${code} is not available for ${context.country} / ${context.shippingCode} / ` +
        `${context.total} cents`,
    })
  }
}

export function isOnline(code: PaymentMethodCode): boolean {
  return PAYMENT_METHODS[code]?.online === true
}
