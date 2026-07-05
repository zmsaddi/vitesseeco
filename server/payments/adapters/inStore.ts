import type { PaymentAdapter } from '~/server/payments/types'

/**
 * In-store payment (P4-02).
 *
 * The order is created in 'pending' status; the customer pays at the shop on
 * pickup. This is the only live adapter at the time of writing — Stripe is
 * stubbed in P4-03 and will be wired in v2.
 */
export const inStoreAdapter: PaymentAdapter = {
  code: 'in_store',

  async validate({ context }) {
    if (context.total < 0) return { ok: false, reason: 'negative_total' }
    // Paying at the shop only makes sense when the order is PICKED UP at
    // the shop (owner rule 2026-07-06).
    if (context.shippingCode && context.shippingCode !== 'pickup') {
      return { ok: false, reason: 'in_store_payment_requires_pickup' }
    }
    return { ok: true }
  },

  async prepareCheckout(_input) {
    // No external action — order goes straight to "pending" awaiting in-store payment.
    return { initialStatus: 'pending' }
  },
}
