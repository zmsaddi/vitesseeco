import type { PaymentAdapter } from '~/server/payments/types'

/**
 * Stripe adapter — STUB (P4-03).
 *
 * No live API calls. Wiring is intentionally deferred to v2 per the upgrade
 * plan (ADR-07, Q-05). When the time comes:
 *
 *   1. npm i stripe
 *   2. Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in Vercel env
 *   3. Replace the throws below with real PaymentIntent calls
 *   4. Add /api/webhooks/stripe.post.ts that calls verifyWebhook()
 *   5. Set ENABLE_STRIPE=true to expose this method in checkout
 *
 * Until ENABLE_STRIPE=true, the registry filters this adapter out so the
 * checkout UI never offers it.
 */
export const stripeAdapter: PaymentAdapter = {
  code: 'stripe',

  async validate({ context }) {
    if (context.total <= 0) {
      return { ok: false, reason: 'zero_total_not_chargeable' }
    }
    if (!context.customer.email) {
      return { ok: false, reason: 'email_required_for_stripe' }
    }
    return { ok: true }
  },

  async prepareCheckout(_input) {
    throw new Error(
      'Stripe is stubbed. Implement PaymentIntent creation here, set ENABLE_STRIPE=true, and configure STRIPE_SECRET_KEY before exposing this method.'
    )
  },

  async verifyWebhook(_event) {
    throw new Error('Stripe webhook handler not implemented yet — see server/payments/adapters/stripe.ts')
  },
}
