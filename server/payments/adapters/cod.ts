import type { PaymentAdapter } from '~/server/payments/types'

/**
 * Cash on delivery — LIVE for BE/NL only (owner 2026-07-05): our OWN
 * delivery fleet serves those countries, so the driver collects cash at
 * the door. Extend COUNTRIES when the fleet grows (NRW-Germany planned).
 *
 * Order lifecycle mirrors in_store: created as `pending`, flipped to
 * `paid` by the admin in /admin once the driver hands the cash in.
 */
const COUNTRIES = ['BE', 'NL']

export const codAdapter: PaymentAdapter = {
  code: 'cod',

  async validate({ context }) {
    if (context.total <= 0) {
      return { ok: false, reason: 'zero_total_not_chargeable' }
    }
    const country = String((context.shippingAddress as any)?.country || '').toUpperCase()
    if (!COUNTRIES.includes(country)) {
      return { ok: false, reason: 'cod_not_available_for_country' }
    }
    return { ok: true }
  },

  async prepareCheckout() {
    return { initialStatus: 'pending' as const }
  },
}
