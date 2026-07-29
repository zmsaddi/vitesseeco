/**
 * Response security headers.
 *
 * The Content-Security-Policy is nonce-based. That matters more than the rest
 * put together: with `unsafe-inline` a single injected `<script>` runs, and
 * every other defence is decoration. With a per-response nonce, injected markup
 * is inert even if it reaches the page, because the attacker cannot know the
 * nonce — it is generated after their input was stored.
 */
import { setResponseHeader, type H3Event } from 'h3'
import { randomToken } from './crypto'

/** Where the page is allowed to talk to. Every entry needs a reason. */
const CONNECT_SOURCES = [
  "'self'",
  'https://api.stripe.com', // payment session updates
  'https://cdn.sanity.io', // catalogue images
  'https://challenges.cloudflare.com', // CAPTCHA verification round trip
]

const FRAME_SOURCES = [
  'https://js.stripe.com', // embedded payment form
  'https://hooks.stripe.com', // 3-D Secure challenge
  'https://challenges.cloudflare.com', // the CAPTCHA renders in an iframe
]

const SCRIPT_SOURCES = ['https://js.stripe.com', 'https://challenges.cloudflare.com']

const IMAGE_SOURCES = ["'self'", 'data:', 'blob:', 'https://cdn.sanity.io']

export const NONCE_KEY = 'cspNonce'

/** One nonce per response, stored on the event so the renderer can stamp it. */
export function issueNonce(event: H3Event): string {
  const existing = event.context[NONCE_KEY] as string | undefined
  if (existing) return existing
  const nonce = randomToken(16)
  event.context[NONCE_KEY] = nonce
  return nonce
}

export function applySecurityHeaders(event: H3Event): void {
  const nonce = issueNonce(event)
  const isProduction = process.env.NODE_ENV === 'production'

  const policy = [
    `default-src 'self'`,
    // Styles still need 'unsafe-inline': Vue writes inline style attributes for
    // transitions and dynamic bindings. This is a far smaller exposure than
    // inline script, which is what the nonce closes.
    `style-src 'self' 'unsafe-inline'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${SCRIPT_SOURCES.join(' ')}`,
    `img-src ${IMAGE_SOURCES.join(' ')}`,
    `font-src 'self' data:`,
    `connect-src ${CONNECT_SOURCES.join(' ')}`,
    `frame-src ${FRAME_SOURCES.join(' ')}`,
    // Nobody may frame us: this is the header that stops clickjacking a
    // one-click payment button.
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ')

  setResponseHeader(event, 'Content-Security-Policy', policy)
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(
    event,
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com"), interest-cohort=()'
  )
  setResponseHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')
  setResponseHeader(event, 'Cross-Origin-Resource-Policy', 'same-site')

  if (isProduction) {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
}

/**
 * Headers for API responses: never cached, never sniffed, never framed.
 * A cached authenticated response served to the next visitor is a data leak,
 * and shared caches are exactly where that happens.
 */
export function applyApiHeaders(event: H3Event): void {
  setResponseHeader(event, 'Cache-Control', 'no-store, private')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
}
