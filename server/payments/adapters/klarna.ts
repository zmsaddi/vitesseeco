import type { PaymentAdapter } from '~/server/payments/types'

/**
 * Klarna adapter — SCAFFOLD (owner decision 2026-07-05: card + Klarna will
 * be offered at checkout).
 *
 * Two activation routes — pick ONE in the owner accounts session:
 *
 *  A) THROUGH STRIPE (recommended: one contract, one webhook, one payout):
 *     Klarna is just a payment_method_types entry on the Stripe
 *     Checkout/PaymentIntent. In that case implement it inside
 *     adapters/stripe.ts and DELETE this file + its registry entry —
 *     the Sanity `klarna` method doc would then also use code `stripe`.
 *
 *  B) DIRECT Klarna Payments API (this adapter):
 *     1. Klarna merchant account → KLARNA_USERNAME / KLARNA_PASSWORD
 *        (+ KLARNA_API_BASE: https://api.playground.klarna.com then
 *        https://api.klarna.com)
 *     2. prepareCheckout: POST /payments/v1/sessions with the order lines
 *        → return { initialStatus: 'pending', clientPayload: {
 *        redirectUrl | client_token } }
 *     3. /api/webhooks/klarna.post.ts → verifyWebhook() confirms
 *        authorization → order flips to paid (same outbox convergence
 *        as PayPal).
 *     4. Set ENABLE_KLARNA=true to expose the method in checkout.
 *
 * Until ENABLE_KLARNA=true the registry filters this adapter out, so the
 * checkout UI never offers it.
 */
export const klarnaAdapter: PaymentAdapter = {
  code: 'klarna',

  async validate({ context }) {
    if (context.total <= 0) {
      return { ok: false, reason: 'zero_total_not_chargeable' }
    }
    if (!context.customer.email) {
      return { ok: false, reason: 'email_required_for_klarna' }
    }
    // Klarna availability is per billing country — the target markets are
    // all covered (FR/BE/NL/DE/ES + LU), so no country gate needed here.
    return { ok: true }
  },

  async prepareCheckout(_input) {
    throw new Error(
      'Klarna is scaffolded but not wired. Create the Klarna session here (or activate via Stripe instead), then set ENABLE_KLARNA=true.'
    )
  },

  async verifyWebhook(_event) {
    throw new Error('Klarna webhook handler not implemented yet — see server/payments/adapters/klarna.ts')
  },
}
