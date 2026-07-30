/**
 * The error model.
 *
 * Every failure the system can produce is one of these codes. Handlers throw
 * `AppError`; a single boundary turns it into an HTTP response and a log line.
 * Two rules make this worth having:
 *
 *  - The message sent to the browser is chosen deliberately per code, so an
 *    internal detail cannot leak by someone forwarding `err.message`.
 *  - Codes are stable identifiers the client can branch on, so the UI never
 *    parses prose to decide what to show.
 */

export const ERROR_CODES = {
  // 400 — the request itself is wrong
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNSUPPORTED_COUNTRY: 'UNSUPPORTED_COUNTRY',
  UNKNOWN_SHIPPING_METHOD: 'UNKNOWN_SHIPPING_METHOD',
  UNKNOWN_PAYMENT_METHOD: 'UNKNOWN_PAYMENT_METHOD',
  CART_EMPTY: 'CART_EMPTY',

  // 401 / 403 — who you are, and what that lets you do
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  CSRF_REJECTED: 'CSRF_REJECTED',
  CAPTCHA_REQUIRED: 'CAPTCHA_REQUIRED',
  CAPTCHA_FAILED: 'CAPTCHA_FAILED',

  // 404
  NOT_FOUND: 'NOT_FOUND',

  // 409 — the world moved while the customer was deciding
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  PRICE_CHANGED: 'PRICE_CHANGED',
  PROMO_EXHAUSTED: 'PROMO_EXHAUSTED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  ALREADY_PROCESSED: 'ALREADY_PROCESSED',

  // 429
  RATE_LIMITED: 'RATE_LIMITED',

  // 5xx
  INTERNAL: 'INTERNAL',
  PAYMENT_PROVIDER_ERROR: 'PAYMENT_PROVIDER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNSUPPORTED_COUNTRY: 400,
  UNKNOWN_SHIPPING_METHOD: 400,
  UNKNOWN_PAYMENT_METHOD: 400,
  CART_EMPTY: 400,
  NOT_AUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  CSRF_REJECTED: 403,
  CAPTCHA_REQUIRED: 403,
  CAPTCHA_FAILED: 403,
  NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  PRICE_CHANGED: 409,
  PROMO_EXHAUSTED: 409,
  INVALID_STATE_TRANSITION: 409,
  ALREADY_PROCESSED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  PAYMENT_PROVIDER_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
}

/**
 * The i18n key the client renders. Never the raw message — that is for logs.
 */
const MESSAGE_KEY: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'errors.validation_failed',
  UNSUPPORTED_COUNTRY: 'errors.unsupported_country',
  UNKNOWN_SHIPPING_METHOD: 'errors.unknown_shipping_method',
  UNKNOWN_PAYMENT_METHOD: 'errors.unknown_payment_method',
  CART_EMPTY: 'errors.cart_empty',
  NOT_AUTHENTICATED: 'errors.not_authenticated',
  SESSION_EXPIRED: 'errors.session_expired',
  INVALID_CREDENTIALS: 'errors.invalid_credentials',
  FORBIDDEN: 'errors.forbidden',
  CSRF_REJECTED: 'errors.csrf_rejected',
  CAPTCHA_REQUIRED: 'errors.captcha_required',
  CAPTCHA_FAILED: 'errors.captcha_failed',
  NOT_FOUND: 'errors.not_found',
  OUT_OF_STOCK: 'errors.out_of_stock',
  PRICE_CHANGED: 'errors.price_changed',
  PROMO_EXHAUSTED: 'errors.promo_exhausted',
  INVALID_STATE_TRANSITION: 'errors.invalid_state_transition',
  ALREADY_PROCESSED: 'errors.already_processed',
  RATE_LIMITED: 'errors.rate_limited',
  INTERNAL: 'errors.internal',
  PAYMENT_PROVIDER_ERROR: 'errors.payment_provider',
  SERVICE_UNAVAILABLE: 'errors.service_unavailable',
}

/**
 * Codes whose `details` may be shown to the customer, because the customer is
 * the one who has to act on them ("only 2 left", "this line changed price").
 * Every other code sends its details to the log and nothing to the browser.
 */
const DETAILS_ARE_PUBLIC = new Set<ErrorCode>([
  ERROR_CODES.VALIDATION_FAILED,
  ERROR_CODES.OUT_OF_STOCK,
  ERROR_CODES.PRICE_CHANGED,
  ERROR_CODES.UNSUPPORTED_COUNTRY,
  ERROR_CODES.RATE_LIMITED,
])

export interface AppErrorOptions {
  /** Structured data for the client. Only forwarded for codes listed above. */
  details?: unknown
  /** Never leaves the server. For the log line. */
  internal?: string
  cause?: unknown
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly messageKey: string
  readonly details?: unknown
  readonly internal?: string

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.internal ?? code, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.code = code
    this.status = STATUS[code]
    this.messageKey = MESSAGE_KEY[code]
    this.details = options.details
    this.internal = options.internal
  }

  /** The exact shape sent to the browser. Nothing else is ever serialised. */
  toPublic(): { code: ErrorCode; messageKey: string; details?: unknown } {
    const payload: { code: ErrorCode; messageKey: string; details?: unknown } = {
      code: this.code,
      messageKey: this.messageKey,
    }
    if (this.details !== undefined && DETAILS_ARE_PUBLIC.has(this.code)) {
      payload.details = this.details
    }
    return payload
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError
}

/**
 * Convert anything thrown into an AppError. An unrecognised throw becomes a
 * generic 500 whose real message is kept internal — so a database error string
 * can never reach a customer.
 */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value
  const internal = value instanceof Error ? `${value.name}: ${value.message}` : String(value)
  return new AppError(ERROR_CODES.INTERNAL, { internal, cause: value })
}

