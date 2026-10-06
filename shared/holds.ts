/**
 * How long an online order holds its units before it is paid.
 *
 * Owned by server/services/stock.ts, which takes every online hold for this
 * long, and here so the checkout page reads the same number rather than a copy:
 * a purchase key older than the hold names an attempt whose units may be
 * someone else's by now, so the page lets it go instead of replaying it. Kept
 * apart from shared/schemas.ts, whose validators would bring their library
 * into the page with the constant.
 */
export const ONLINE_HOLD_MS = 30 * 60 * 1000
