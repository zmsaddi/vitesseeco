/**
 * Money.
 *
 * Every amount in this system is an integer number of cents, carried in a
 * branded type so a plain number cannot be passed where money is expected.
 * Floating point never touches a price: `0.1 + 0.2 !== 0.3` is a rounding bug
 * waiting to be discovered by a customer, and the previous build stored money
 * as `decimal` columns read back as strings and multiplied as floats.
 *
 * Rounding happens in exactly one place — `fromEuros` at the authoring boundary
 * and `applyPercentage` for discounts. Nothing else rounds.
 */

declare const CENTS: unique symbol
export type Cents = number & { readonly [CENTS]: true }

export const ZERO = 0 as Cents

/** Largest amount we will ever accept, as a guard against overflow and typos. */
const MAX_CENTS = 100_000_000 // 1,000,000.00 EUR

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

function assertValid(value: number, context: string): asserts value is Cents {
  if (!Number.isFinite(value)) throw new MoneyError(`${context}: not a finite number`)
  if (!Number.isInteger(value)) throw new MoneyError(`${context}: cents must be an integer, got ${value}`)
  if (Math.abs(value) > MAX_CENTS) throw new MoneyError(`${context}: amount out of range`)
}

/** Wrap a raw integer that is already in cents (e.g. read from Postgres). */
export function cents(value: number): Cents {
  assertValid(value, 'cents')
  return value
}

/**
 * Convert an author-facing euro amount (Sanity, a CSV, a form) into cents.
 * This is the only place a fractional input is allowed, and it is the only
 * place that rounds.
 */
export function fromEuros(value: number): Cents {
  if (!Number.isFinite(value)) throw new MoneyError('fromEuros: not a finite number')
  // Scale before rounding so 19.99 does not land on 19.98 through binary
  // representation: (19.99 * 100) is 1998.9999999999998.
  const scaled = Math.round((value + Number.EPSILON) * 100)
  assertValid(scaled, 'fromEuros')
  return scaled
}

/** Parse a decimal string such as "19.99" or "19,99" without going through a float. */
export function fromDecimalString(value: string): Cents {
  const trimmed = value.trim().replace(',', '.')
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed)
  if (!match) throw new MoneyError(`fromDecimalString: cannot parse "${value}"`)
  const [, sign, whole, fraction = ''] = match
  const padded = fraction.padEnd(2, '0')
  const total = Number(whole) * 100 + Number(padded)
  return cents(sign === '-' ? -total : total)
}

export function add(...amounts: Cents[]): Cents {
  return cents(amounts.reduce<number>((sum, a) => sum + a, 0))
}

export function subtract(a: Cents, b: Cents): Cents {
  return cents(a - b)
}

/** Multiply by a whole count — quantities are integers, never fractions. */
export function multiply(amount: Cents, quantity: number): Cents {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError(`multiply: quantity must be a non-negative integer, got ${quantity}`)
  }
  return cents(amount * quantity)
}

/**
 * Percentage discounts round half-up on the cent, which is the convention EU
 * consumers see and the one Stripe uses.
 */
export function applyPercentage(amount: Cents, percent: number): Cents {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new MoneyError(`applyPercentage: percent must be between 0 and 100, got ${percent}`)
  }
  return cents(Math.round((amount * percent) / 100))
}

/** Clamp to zero — a discount larger than the basket must not create a negative total. */
export function atLeastZero(amount: Cents): Cents {
  return amount < 0 ? ZERO : amount
}

export function isZero(amount: Cents): boolean {
  return amount === 0
}

export function greaterOrEqual(a: Cents, b: Cents): boolean {
  return a >= b
}

/** Euro value, for the rare API that insists on a decimal (never for arithmetic). */
export function toEuros(amount: Cents): number {
  return amount / 100
}

/** Canonical decimal string, e.g. "1249.00". Safe for APIs and CSV exports. */
export function toDecimalString(amount: Cents): string {
  const negative = amount < 0
  const abs = Math.abs(amount)
  const whole = Math.floor(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/**
 * Display string for a locale, e.g. "1 249,00 €" in French.
 * Formatting happens only at the edge, never before arithmetic.
 */
export function format(amount: Cents, formatLocale: string, currency = 'EUR'): string {
  return new Intl.NumberFormat(formatLocale, { style: 'currency', currency }).format(toEuros(amount))
}

/**
 * Split an amount across N shares without losing or inventing a cent — the
 * remainder is spread one cent at a time over the first shares.
 * Used when a basket-level discount has to be attributed to line items.
 */
export function allocate(amount: Cents, shares: number): Cents[] {
  if (!Number.isInteger(shares) || shares <= 0) {
    throw new MoneyError(`allocate: shares must be a positive integer, got ${shares}`)
  }
  const base = Math.trunc(amount / shares)
  const remainder = amount - base * shares
  const step = remainder >= 0 ? 1 : -1
  let left = Math.abs(remainder)
  return Array.from({ length: shares }, () => {
    const extra = left > 0 ? step : 0
    if (left > 0) left--
    return cents(base + extra)
  })
}

/**
 * Proportional allocation, used to attribute a basket discount to lines by their
 * value. Guarantees the parts sum exactly to `amount`: the largest line absorbs
 * the rounding remainder.
 */
export function allocateProportionally(amount: Cents, weights: Cents[]): Cents[] {
  if (weights.length === 0) return []
  const total = weights.reduce<number>((sum, w) => sum + w, 0)
  if (total <= 0) return allocate(amount, weights.length)

  const parts = weights.map((w) => Math.floor((amount * w) / total))
  const distributed = parts.reduce((sum, p) => sum + p, 0)
  let remainder = amount - distributed

  // Hand the leftover cents to the largest weights first, so the visible price
  // of the biggest line is the one that absorbs the rounding.
  const order = weights
    .map((w, index) => ({ w, index }))
    .sort((a, b) => b.w - a.w)
    .map((entry) => entry.index)

  let cursor = 0
  while (remainder > 0 && order.length > 0) {
    const target = order[cursor % order.length]
    if (target !== undefined) {
      parts[target] = (parts[target] ?? 0) + 1
      remainder--
    }
    cursor++
  }
  return parts.map((p) => cents(p))
}
