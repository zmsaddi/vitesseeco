/**
 * Payment adapter contract (P4-01).
 *
 * Each supported payment method (in_store, stripe, paypal, bank_transfer, ...)
 * implements this interface. The order route only knows codes, never the
 * specifics. To add a new method:
 *
 *   1. Create the adapter under server/payments/adapters/<code>.ts
 *   2. Register it in server/payments/registry.ts
 *   3. Add the document in Sanity (paymentMethod with the matching code)
 *   4. Set `isActive: true` in Sanity
 *
 * No order-route changes needed.
 */

import type { H3Event } from 'h3'

export interface OrderContext {
  orderNumber: string
  total: number
  subtotal: number
  shippingCost: number
  discount: number
  currency: 'EUR'
  items: Array<{ productId: string; sku: string; quantity: number; price: number; productName: string }>
  customer: { name: string; email: string; phone: string; customerId?: string }
  shippingAddress: Record<string, unknown>
  billingAddress?: Record<string, unknown>
  paymentCode: string
  /** Selected shipping/receiving method code ('pickup', 'free-benelux', ...). */
  shippingCode?: string
  promoCode?: string | null
  notes?: string | null
}

export interface ValidateInput {
  context: OrderContext
}

export interface ValidateResult {
  ok: boolean
  reason?: string
}

export interface PrepareCheckoutInput {
  context: OrderContext
  event: H3Event
}

export interface PrepareCheckoutResult {
  /** Status the order should be created with under this method. */
  initialStatus: 'pending' | 'paid' | 'processing'
  /** Optional client-side payload returned to the browser (e.g., Stripe payment intent id). */
  clientPayload?: Record<string, unknown>
  /** Adapter-specific id stored on the order (e.g., Stripe payment intent id). */
  externalPaymentId?: string
}

export interface PaymentAdapter {
  /** Unique short code matching paymentMethod.code in Sanity. */
  code: string
  /** Server-side validation before the order is committed. Adapter rejects here if its preconditions are not met. */
  validate(input: ValidateInput): Promise<ValidateResult>
  /** Called inside the order creation flow to obtain initialStatus + any external ids. */
  prepareCheckout(input: PrepareCheckoutInput): Promise<PrepareCheckoutResult>
  /** Optional webhook handler — only adapters that need async confirmation (Stripe) implement it. */
  verifyWebhook?(event: H3Event): Promise<{ ok: boolean; orderNumber?: string; newStatus?: string }>
}
