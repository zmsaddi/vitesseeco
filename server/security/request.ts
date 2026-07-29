/**
 * Who is asking, and may they.
 *
 * Two questions with the same root problem: almost everything a browser sends
 * can be set by whoever is attacking us. The few headers that cannot be forged
 * from another origin are the ones worth trusting, and this module is where
 * that judgement lives so no handler has to make it again.
 */
import { getRequestHeader, type H3Event } from 'h3'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { PRIMARY_DOMAIN, LOCALES } from '../../shared/locales'

/**
 * The caller's IP.
 *
 * `x-forwarded-for` is a list the client can prepend to, so the leftmost entry
 * is attacker-controlled. Only the hop appended by our own edge is meaningful:
 * on Vercel that is `x-real-ip`, otherwise the LAST entry of the chain.
 * Trusting the first entry — as the previous build did — makes every per-IP
 * limit bypassable with one header.
 */
export function clientIp(event: H3Event): string {
  const realIp = getRequestHeader(event, 'x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  if (forwarded) {
    const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean)
    const last = hops[hops.length - 1]
    if (last) return last
  }

  return event.node.req.socket?.remoteAddress ?? 'unknown'
}

/** Route path without the query string, which the caller controls. */
export function routeKey(event: H3Event): string {
  const path = event.path ?? '/'
  const queryStart = path.indexOf('?')
  return queryStart === -1 ? path : path.slice(0, queryStart)
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Hosts a state-changing request is allowed to originate from. */
function allowedOrigins(): Set<string> {
  const origins = new Set<string>([PRIMARY_DOMAIN])
  for (const locale of LOCALES) {
    if (locale.domain) origins.add(locale.domain)
  }
  const configured = process.env.PUBLIC_SITE_HOST
  if (configured) origins.add(configured.replace(/^https?:\/\//, ''))
  // Preview deployments and local development.
  if (process.env.VERCEL_URL) origins.add(process.env.VERCEL_URL)
  if (process.env.NODE_ENV !== 'production') {
    origins.add('localhost:3000')
    origins.add('127.0.0.1:3000')
  }
  return origins
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
}

/**
 * Reject a cross-site state change.
 *
 * Cookies are `SameSite=Lax`, which already blocks the classic cross-site POST.
 * This is the second lock, and it is the one that does not depend on the
 * browser's cookie policy being what we expect:
 *
 *  - `Sec-Fetch-Site` is set by the browser and cannot be overridden by script,
 *    so `cross-site` is a definitive no.
 *  - `Origin` is sent on every state-changing request and likewise cannot be
 *    spoofed from a page. An unrecognised origin is a definitive no.
 *
 * A request carrying neither is not from a browser form — it is a server or a
 * tool — and is allowed through, because CSRF requires a victim's browser. It
 * still has to present a valid session cookie to do anything.
 */
export function assertSameOrigin(event: H3Event): void {
  const method = (event.method ?? 'GET').toUpperCase()
  if (SAFE_METHODS.has(method)) return

  const fetchSite = getRequestHeader(event, 'sec-fetch-site')
  if (fetchSite === 'cross-site') {
    throw new AppError(ERROR_CODES.CSRF_REJECTED, {
      internal: `cross-site ${method} to ${routeKey(event)}`,
    })
  }

  const origin = getRequestHeader(event, 'origin')
  if (origin && origin !== 'null') {
    const allowed = allowedOrigins()
    const host = normalizeHost(origin)
    const permitted = [...allowed].some((entry) => normalizeHost(entry) === host)
    if (!permitted) {
      throw new AppError(ERROR_CODES.CSRF_REJECTED, {
        internal: `origin ${origin} is not allowed for ${routeKey(event)}`,
      })
    }
    return
  }

  // No Origin and not marked cross-site by the browser: same-origin navigation
  // or a non-browser client. The session cookie remains the real gate.
  if (fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none' || !fetchSite) {
    return
  }

  throw new AppError(ERROR_CODES.CSRF_REJECTED, {
    internal: `unrecognised sec-fetch-site "${fetchSite}" for ${routeKey(event)}`,
  })
}

/** Country supplied by the CDN edge. A hint for language only — never a permission. */
export function edgeCountry(event: H3Event): string | undefined {
  return (
    getRequestHeader(event, 'x-vercel-ip-country') ??
    getRequestHeader(event, 'cf-ipcountry') ??
    undefined
  )
}
