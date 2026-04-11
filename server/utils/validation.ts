/**
 * Unified validation constants and rules.
 * Single source of truth — imported by server endpoints AND client stores.
 */

// ═══════ LIMITS ═══════
export const LIMITS = {
  MAX_CART_ITEMS: 20,
  MAX_QUANTITY_PER_ITEM: 10,
  MAX_ADDRESSES_PER_CUSTOMER: 5,
  MIN_PASSWORD_LENGTH: 8,
  MAX_NAME_LENGTH: 100,
  MAX_NOTE_LENGTH: 5000,
  MAX_SUBJECT_LENGTH: 200,
  MAX_MESSAGE_LENGTH: 5000,
  MAX_PROMO_CODE_LENGTH: 30,
  SESSION_DURATION_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const

export const ALLOWED_COUNTRIES = ['FR', 'BE', 'NL', 'DE', 'ES', 'LU', 'CH', 'AT', 'IT', 'PT'] as const
export type AllowedCountry = typeof ALLOWED_COUNTRIES[number]

// ═══════ VALIDATORS ═══════

/** RFC-compliant-ish email validation — stricter than the current regex */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length > 254) return false
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(trimmed)
}

/** Normalize email — lowercase + trim */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/** Validate Sanity document IDs and product IDs */
export function isValidProductId(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  return /^[a-zA-Z0-9._-]+$/.test(id)
}

/** Validate quantity within limits */
export function isValidQuantity(qty: unknown): qty is number {
  if (typeof qty !== 'number' || !Number.isFinite(qty)) return false
  const floored = Math.floor(qty)
  return floored >= 1 && floored <= LIMITS.MAX_QUANTITY_PER_ITEM
}

/** Validate country code */
export function isAllowedCountry(country: string): country is AllowedCountry {
  return ALLOWED_COUNTRIES.includes(country.toUpperCase() as AllowedCountry)
}

/** Validate name fields (firstName, lastName) */
export function isValidName(name: unknown): name is string {
  if (!name || typeof name !== 'string') return false
  const trimmed = name.trim()
  return trimmed.length >= 1 && trimmed.length <= LIMITS.MAX_NAME_LENGTH
}

/** Validate password meets minimum requirements */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= LIMITS.MIN_PASSWORD_LENGTH
}

/** Validate promo code format */
export function isValidPromoCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false
  const upper = code.toUpperCase().trim()
  return upper.length > 0 && upper.length <= LIMITS.MAX_PROMO_CODE_LENGTH && /^[A-Z0-9_-]+$/.test(upper)
}
