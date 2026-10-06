/**
 * What a link-sale handover form must hold before a customer signs it and the
 * server numbers an invoice from it.
 *
 * Shared because two sides judge the same fields. The route refuses what breaks
 * these rules; the page refuses to put the device in the customer's hands until
 * the form keeps them. Judged only by the server, a mistyped country or date was
 * found AFTER the customer had signed — and correcting it voided the signature,
 * so a customer who had already left had to come back and sign again.
 */

/** The longest each field may be: what fits the invoice, the receipt and Stripe's own limits. */
export const HANDOVER_LIMITS = {
  frameNumber: 40,
  name: 120,
  line1: 200,
  postalCode: 20,
  city: 80,
} as const

/** No control characters: these strings end up on a legal document and a PDF. */
export const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/

/** Non-empty once trimmed, within its limit, and printable. */
export function isHandoverText(value: string, max: number): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= max && !CONTROL_CHARACTERS.test(trimmed)
}

/** ISO 3166-1 alpha-2, in either case — the server upper-cases it. */
export function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value.trim().toUpperCase())
}

/** A day in the shop's zone, as YYYY-MM-DD: a server in UTC must not date a late sale the day before. */
export function parisDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(at)
}

/**
 * A handover happens after the payment and not in the future. Compared as
 * YYYY-MM-DD strings, which sort as the days they name — no Date, so no zone.
 */
export function isHandoverDay(day: string, paidOn: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= paidOn && day <= today
}
