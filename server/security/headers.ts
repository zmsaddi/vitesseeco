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
  'https://www.google.com', // Google Customer Reviews opt-in dialog
]

// Host entries are the CSP2 fallback only — under strict-dynamic a CSP3
// browser ignores them and trusts what a nonce'd script loads.
const SCRIPT_SOURCES = [
  'https://js.stripe.com',
  'https://challenges.cloudflare.com',
  'https://apis.google.com', // Google Customer Reviews platform.js
  'https://www.gstatic.com', // its children
]

const IMAGE_SOURCES = ["'self'", 'data:', 'blob:', 'https://cdn.sanity.io', 'https://www.gstatic.com']

export const NONCE_KEY = 'cspNonce'

/** One nonce per response, stored on the event so the renderer can stamp it. */
export function issueNonce(event: H3Event): string {
  const existing = event.context[NONCE_KEY] as string | undefined
  if (existing) return existing
  const nonce = randomToken(16)
  event.context[NONCE_KEY] = nonce
  return nonce
}

/**
 * Tags the browser checks against `script-src`.
 *
 * `<script>` is the obvious one. `<link rel="modulepreload">` is the one that is
 * easy to forget and just as fatal: it is fetched by the parser, not by a
 * trusted script, so `strict-dynamic` does not cover it and it needs the nonce
 * of its own.
 *
 * A tag that already carries a nonce is left alone rather than given a second
 * attribute, which browsers reject outright.
 */
const NONCEABLE = /<(script|link)\b(?![^>]*\snonce=)/gi

/**
 * Stamp the nonce onto everything the policy will otherwise refuse to run.
 *
 * This exists because `strict-dynamic` makes a CSP3 browser IGNORE `'self'` and
 * every host source in `script-src` — including js.stripe.com, listed right
 * there. Without this, the policy blocks Nuxt's own hydration bundle: the page
 * paints and then nothing works. No cart, no checkout, no payment form.
 */
export function stampNonce(markup: string, nonce: string): string {
  return markup.replace(NONCEABLE, `<$1 nonce="${nonce}"`)
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
 * Headers for API responses: never sniffed, never leaked in a referrer, and by
 * default never cached. A cached authenticated response served to the next
 * visitor is a data leak, and shared caches are exactly where that happens.
 *
 * `seconds` opts a route into a SHARED cache, and defineRoute only allows it on
 * a route whose access is 'public' — the safety is a property of the route
 * definition, checked in code and by an invariant, not a comment asking the
 * next person to be careful.
 *
 * `private` is dropped in that case and `s-maxage` used rather than `max-age`:
 * the CDN may hold the response, the browser is told to revalidate. Vary names
 * Accept-Language because content routes answer in the visitor's language, and
 * a shared cache with no Vary would serve the first caller's language to
 * everyone behind it.
 */
export function applyApiHeaders(event: H3Event, seconds = 0): void {
  if (seconds > 0) {
    setResponseHeader(
      event,
      'Cache-Control',
      `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`
    )
    setResponseHeader(event, 'Vary', 'Accept-Language')
  } else {
    setResponseHeader(event, 'Cache-Control', 'no-store, private')
  }
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
}
