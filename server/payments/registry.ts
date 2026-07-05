/**
 * Payment adapter registry (P4-01 / P4-05).
 *
 * Single resolution point: the order route asks for `getPaymentAdapter(code)`
 * and never sees implementation details. New adapters are added to the
 * `ADAPTERS` map below; nothing else needs to change.
 *
 * Feature flags filter adapters out at runtime — e.g., ENABLE_STRIPE keeps
 * the Stripe stub out of production checkout until it's actually wired.
 */
import type { PaymentAdapter } from '~/server/payments/types'
import { inStoreAdapter } from '~/server/payments/adapters/inStore'
import { stripeAdapter } from '~/server/payments/adapters/stripe'
import { paypalAdapter } from '~/server/payments/adapters/paypal'
import { klarnaAdapter } from '~/server/payments/adapters/klarna'
import { codAdapter } from '~/server/payments/adapters/cod'

const ADAPTERS: Record<string, PaymentAdapter> = {
  in_store: inStoreAdapter,
  cod: codAdapter, // cash on delivery — own fleet countries (BE/NL)
  stripe: stripeAdapter, // card payments
  paypal: paypalAdapter,
  klarna: klarnaAdapter,
  // Future: apple_pay, google_pay, bank_transfer
}

const FLAGS: Record<string, () => boolean> = {
  in_store: () => true,
  cod: () => true, // availability is governed per-country by the adapter + Sanity doc
  stripe: () => process.env.ENABLE_STRIPE === 'true',
  paypal: () => process.env.ENABLE_PAYPAL === 'true',
  klarna: () => process.env.ENABLE_KLARNA === 'true',
}

/** Throws if the code is unknown or its feature flag is off. */
export function getPaymentAdapter(code: string): PaymentAdapter {
  const adapter = ADAPTERS[code]
  if (!adapter) throw new Error(`Unknown payment method: ${code}`)
  const enabled = FLAGS[code] ?? (() => true)
  if (!enabled()) throw new Error(`Payment method "${code}" is not currently enabled`)
  return adapter
}

/** Returns the codes of all currently-enabled adapters. */
export function listEnabledAdapterCodes(): string[] {
  return Object.keys(ADAPTERS).filter((code) => (FLAGS[code] ?? (() => true))())
}
