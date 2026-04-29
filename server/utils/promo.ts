/**
 * Promo code validation + atomic reservation/release.
 *
 * Fixes (P0-01, SEC-02): currentUses was never incremented after a successful
 * order, and any naive "increment after order" approach allows concurrent
 * over-use because two orders can pass validation before either increments.
 *
 * Strategy: reservation-before-order.
 *
 * 1. validatePromo() — read-only check, used by previews (e.g. cart UI).
 *
 * 2. reservePromoUse() — bumps currentUses by 1 BEFORE the order is created,
 *    using ifRevisionId optimistic locking. On revision conflict the function
 *    re-fetches the FULL document (not just _rev) and re-validates every
 *    rule including maxUses. This closes the concurrency window: once a
 *    reservation succeeds, currentUses is durably incremented; further
 *    attempts will see the new count and be rejected if maxUses is reached.
 *
 * 3. releasePromoUse() — compensating decrement, called by the order route
 *    if order creation fails after a successful reservation. Same retry loop
 *    with optimistic locking. If release fails after retry exhaustion, the
 *    caller MUST log loudly so the discrepancy can be reconciled manually.
 *
 * All commits use sync visibility (Sanity default) so the response only
 * returns once the document is durably committed. This is critical for a
 * financial counter — async visibility would let follow-up reads see stale
 * counts.
 */

import type { SanityClient } from '@sanity/client'

export interface PromoSnapshot {
  _id: string
  _rev: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minOrderAmount?: number
  maxUses?: number
  currentUses: number
  validFrom?: string
  validUntil?: string
}

export type PromoInvalidReason =
  | 'not_found'
  | 'inactive'
  | 'not_yet_active'
  | 'expired'
  | 'max_uses_reached'
  | 'min_amount_not_met'
  | 'retry_exhausted'
  | 'no_write_client'

export interface PromoValidationResult {
  valid: boolean
  reason?: PromoInvalidReason
  snapshot?: PromoSnapshot
  discount?: number
}

export interface ReserveResult {
  success: boolean
  reason?: PromoInvalidReason
  promoId?: string
  code?: string
  discount?: number
}

export interface ReleaseResult {
  success: boolean
  reason?: 'not_found' | 'retry_exhausted' | 'already_zero'
}

const PROMO_PROJECTION = `{
  _id, _rev, code, discountType, discountValue,
  minOrderAmount, maxUses, currentUses, validFrom, validUntil
}`

function evaluatePromo(promo: PromoSnapshot, subtotal: number): PromoValidationResult {
  const now = new Date()
  if (promo.validFrom && new Date(promo.validFrom) > now) {
    return { valid: false, reason: 'not_yet_active', snapshot: promo }
  }
  if (promo.validUntil && new Date(promo.validUntil) < now) {
    return { valid: false, reason: 'expired', snapshot: promo }
  }
  if (typeof promo.maxUses === 'number' && (promo.currentUses ?? 0) >= promo.maxUses) {
    return { valid: false, reason: 'max_uses_reached', snapshot: promo }
  }
  if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
    return { valid: false, reason: 'min_amount_not_met', snapshot: promo }
  }

  const raw = promo.discountType === 'percentage'
    ? Math.round((subtotal * promo.discountValue) / 100)
    : promo.discountValue
  const discount = Math.min(Math.max(0, raw), subtotal)

  return { valid: true, snapshot: promo, discount }
}

/**
 * Read-only validation. Does not mutate Sanity.
 * Use for previews where we don't want to consume a use yet (e.g., cart UI).
 */
export async function validatePromo(
  readClient: SanityClient,
  rawCode: string,
  subtotal: number
): Promise<PromoValidationResult> {
  const code = rawCode.toUpperCase().trim()
  if (!code) return { valid: false, reason: 'not_found' }

  const promo = await readClient.fetch<PromoSnapshot | null>(
    `*[_type == "promoCode" && code == $code && isActive == true][0]${PROMO_PROJECTION}`,
    { code }
  )
  if (!promo) return { valid: false, reason: 'not_found' }

  return evaluatePromo(promo, subtotal)
}

/**
 * Reserve a promo use atomically before the order is created.
 *
 * On every retry the document is re-fetched and re-validated, so a code that
 * hits maxUses due to a concurrent order is rejected on the next pass — no
 * over-use under concurrency.
 *
 * Returns the discount and the promo id; the caller should pair this with
 * releasePromoUse() if the order subsequently fails to persist.
 */
export async function reservePromoUse(
  writeClient: SanityClient | null,
  readClient: SanityClient,
  rawCode: string,
  subtotal: number,
  options: { maxRetries?: number } = {}
): Promise<ReserveResult> {
  if (!writeClient) {
    return { success: false, reason: 'no_write_client' }
  }
  const code = rawCode.toUpperCase().trim()
  if (!code) return { success: false, reason: 'not_found' }

  const maxRetries = options.maxRetries ?? 5

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const promo = await readClient.fetch<PromoSnapshot | null>(
      `*[_type == "promoCode" && code == $code && isActive == true][0]${PROMO_PROJECTION}`,
      { code }
    )

    if (!promo) return { success: false, reason: 'not_found' }

    const evaluation = evaluatePromo(promo, subtotal)
    if (!evaluation.valid) {
      return { success: false, reason: evaluation.reason }
    }

    try {
      // sync visibility (default) — must be durable before we apply the discount
      await writeClient
        .patch(promo._id)
        .ifRevisionId(promo._rev)
        .inc({ currentUses: 1 })
        .commit()
      return {
        success: true,
        promoId: promo._id,
        code: promo.code,
        discount: evaluation.discount,
      }
    } catch (_err) {
      // Likely a revision conflict caused by a concurrent reservation.
      // Loop, re-fetch, re-validate (so maxUses re-check happens on the new count).
      const backoffMs = 50 * Math.pow(2, attempt) // exponential: 50, 100, 200, 400, 800
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }

  return { success: false, reason: 'retry_exhausted' }
}

/**
 * Compensating decrement, used when the order fails AFTER a successful reservation.
 * Optimistic-lock retry. If release fails (e.g., document deleted) the caller
 * MUST log loudly and surface to audit_log (P0-17) for manual reconciliation.
 */
export async function releasePromoUse(
  writeClient: SanityClient,
  readClient: SanityClient,
  promoId: string,
  options: { maxRetries?: number } = {}
): Promise<ReleaseResult> {
  const maxRetries = options.maxRetries ?? 5

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const fresh = await readClient.fetch<{ _id: string; _rev: string; currentUses?: number } | null>(
      `*[_id == $id][0]{ _id, _rev, currentUses }`,
      { id: promoId }
    )
    if (!fresh) return { success: false, reason: 'not_found' }
    if ((fresh.currentUses ?? 0) <= 0) {
      // Defensive: nothing to release. Treat as success (idempotent).
      return { success: true, reason: 'already_zero' }
    }

    try {
      await writeClient
        .patch(promoId)
        .ifRevisionId(fresh._rev)
        .dec({ currentUses: 1 })
        .commit()
      return { success: true }
    } catch (_err) {
      const backoffMs = 50 * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }

  return { success: false, reason: 'retry_exhausted' }
}
