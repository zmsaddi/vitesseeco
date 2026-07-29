/**
 * Locale routing.
 *
 * Reads the manifest in shared/locales.ts and does the only thing that manifest
 * cannot do by itself: act on a request. Switching the site from path prefixes
 * to country domains is a constant in that file — this middleware then starts
 * redirecting or serving accordingly, with no page or link touched.
 *
 * Two rules keep this honest for search engines:
 *
 *  - A URL that already states its locale is NEVER redirected. Sending a
 *    crawler somewhere other than what it asked for hides content and makes
 *    hreflang a lie.
 *  - Detection produces a SUGGESTION, handed to the page in a header. The page
 *    may offer a banner; nothing redirects a human who did not ask.
 */
import { defineEventHandler, getCookie, getRequestHeader, sendRedirect, setResponseHeader } from 'h3'
import {
  ROUTING_MODE,
  detectLocale,
  localeForHost,
  localizedUrl,
  resolvePath,
} from '../../shared/locales'
import { marketForVisitorCountry, resolveMarket } from '../../shared/markets'
import { edgeCountry } from '../security/request'

/** Set when a visitor picks a language, so the choice survives the next visit. */
export const LOCALE_COOKIE = 'vs_locale'

export default defineEventHandler(async (event) => {
  const path = event.path ?? '/'

  // Assets, API routes and the like have no locale and must not be redirected.
  if (path.startsWith('/api/') || path.startsWith('/_') || path.includes('.')) return

  const host = getRequestHeader(event, 'host')

  // A country domain that is configured to forward rather than serve: send it
  // to the canonical URL once, permanently, so link equity lands in one place.
  if (ROUTING_MODE === 'redirect') {
    const hostLocale = localeForHost(host, 'redirect')
    if (hostLocale) {
      const { path: bare } = resolvePath(path, host, 'redirect')
      return sendRedirect(event, localizedUrl(bare, hostLocale.code, 'redirect'), 301)
    }
  }

  // Which locale this URL actually serves — the market is priced off the page
  // the visitor is on, never off where they happen to be sitting.
  const { locale: served } = resolvePath(path, host, ROUTING_MODE)

  const detection = detectLocale(
    {
      ...(host ? { host } : {}),
      pathname: path,
      ...(getCookie(event, LOCALE_COOKIE) ? { cookieLocale: getCookie(event, LOCALE_COOKIE) } : {}),
      ...(getRequestHeader(event, 'accept-language')
        ? { acceptLanguage: getRequestHeader(event, 'accept-language') }
        : {}),
      ...(edgeCountry(event) ? { country: edgeCountry(event) } : {}),
    },
    ROUTING_MODE
  )

  // Handed to the page rather than acted on. A visitor who landed on the French
  // home page from Amsterdam gets a Dutch banner, not a redirect.
  //
  // The market matters as much as the language here: the Dutch pages carry Dutch
  // prices, so this is the one moment a visitor is told that a version priced
  // for their country exists. Acting on it for them is what Regulation 2018/302
  // forbids, so it is put in front of them and left there.
  if (!detection.explicit) {
    setResponseHeader(event, 'X-Suggested-Locale', detection.locale)
    event.context.suggestedLocale = detection.locale

    const current = resolveMarket({ ...(host ? { host } : {}), locale: served.code }, ROUTING_MODE)
    const suggested = marketForVisitorCountry(edgeCountry(event))
    if (suggested && suggested.country !== current.country) {
      event.context.suggestedMarket = suggested.country
    }
  }

  // Any response that varies by these must say so, or a shared cache will serve
  // one visitor's language to the next.
  setResponseHeader(event, 'Vary', 'Accept-Language, Cookie')
})

declare module 'h3' {
  interface H3EventContext {
    /** Language this visitor would probably prefer. A suggestion, never acted on. */
    suggestedLocale?: string
    /** Market whose prices are meant for their country, when it is not this one. */
    suggestedMarket?: string
  }
}
