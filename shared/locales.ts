/**
 * The single source of truth for language, URL shape and country routing.
 *
 * URL building, hreflang, canonical tags, the sitemap, the language switcher and
 * locale detection all read from here. Nothing else may hardcode a prefix or a
 * domain, so moving a market onto its own country domain is a change to this
 * file and nothing else.
 */

export type LocaleCode = 'fr' | 'en' | 'nl' | 'de' | 'es' | 'ar'
export type Direction = 'ltr' | 'rtl'

/**
 * How a locale is addressed on the web.
 *
 * - `prefix`   one domain, `/de/...` path prefixes. The default locale has no prefix.
 * - `domain`   the locale is served from its own country domain.
 * - `redirect` the country domain exists but permanently redirects into the
 *              primary domain's prefixed path, so link equity stays in one place.
 */
export type RoutingMode = 'prefix' | 'domain' | 'redirect'

export interface LocaleDefinition {
  code: LocaleCode
  /** Value for the `hreflang` attribute and the `lang` attribute. */
  hreflang: string
  /** Endonym, shown in the language switcher. */
  label: string
  dir: Direction
  /** Path segment when routing by prefix. Empty for the default locale. */
  prefix: string
  /**
   * Country domain for this locale. Present does NOT mean active — `routingMode`
   * decides. Declaring it early lets the DNS and certificates be prepared while
   * the site still runs on prefixes.
   */
  domain?: string
  /**
   * Countries whose visitors should be offered this locale, used only as a
   * suggestion when the visitor has expressed no preference.
   */
  countries: string[]
  /** BCP-47 tag used for number and currency formatting. */
  formatLocale: string
}

export const DEFAULT_LOCALE: LocaleCode = 'fr'

export const PRIMARY_DOMAIN = 'vitesse-eco.fr'

/**
 * Switch the whole site between routing shapes.
 *
 * Today: `prefix`. When a country domain is ready, set this to `domain` (serve
 * that market from its own domain) or `redirect` (funnel it back into the
 * primary domain). Pages, links and SEO tags follow automatically.
 */
export const ROUTING_MODE: RoutingMode = 'prefix'

export const LOCALES: readonly LocaleDefinition[] = [
  {
    code: 'fr',
    hreflang: 'fr',
    label: 'Français',
    dir: 'ltr',
    prefix: '',
    domain: 'vitesse-eco.fr',
    countries: ['FR', 'BE', 'LU', 'CH', 'MC'],
    formatLocale: 'fr-FR',
  },
  {
    code: 'en',
    hreflang: 'en',
    label: 'English',
    dir: 'ltr',
    prefix: '/en',
    countries: ['GB', 'IE', 'US'],
    formatLocale: 'en-IE',
  },
  {
    code: 'nl',
    hreflang: 'nl',
    label: 'Nederlands',
    dir: 'ltr',
    prefix: '/nl',
    domain: 'vitesse-eco.nl',
    countries: ['NL', 'BE'],
    formatLocale: 'nl-NL',
  },
  {
    code: 'de',
    hreflang: 'de',
    label: 'Deutsch',
    dir: 'ltr',
    prefix: '/de',
    domain: 'vitesse-eco.de',
    countries: ['DE', 'AT', 'CH'],
    formatLocale: 'de-DE',
  },
  {
    code: 'es',
    hreflang: 'es',
    label: 'Español',
    dir: 'ltr',
    prefix: '/es',
    domain: 'vitesse-eco.es',
    countries: ['ES'],
    formatLocale: 'es-ES',
  },
  {
    code: 'ar',
    hreflang: 'ar',
    label: 'العربية',
    dir: 'rtl',
    prefix: '/ar',
    countries: [],
    formatLocale: 'ar',
  },
] as const

/**
 * Regional variants that share a locale's pages. Belgium reads either the French
 * or the Dutch pages, so both are declared explicitly rather than left to Google
 * to infer.
 */
export const REGIONAL_ALTERNATES: ReadonlyArray<{ hreflang: string; locale: LocaleCode }> = [
  { hreflang: 'fr-BE', locale: 'fr' },
  { hreflang: 'nl-BE', locale: 'nl' },
]

export const LOCALE_CODES: readonly LocaleCode[] = LOCALES.map((l) => l.code)

const BY_CODE = new Map<string, LocaleDefinition>(LOCALES.map((l) => [l.code, l]))

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && BY_CODE.has(value)
}

export function getLocale(code: LocaleCode): LocaleDefinition {
  const found = BY_CODE.get(code)
  if (!found) throw new Error(`Unknown locale: ${code}`)
  return found
}

export function defaultLocale(): LocaleDefinition {
  return getLocale(DEFAULT_LOCALE)
}

/** Locales that currently have a usable country domain, given the routing mode. */
export function domainRoutedLocales(mode: RoutingMode = ROUTING_MODE): LocaleDefinition[] {
  if (mode === 'prefix') return []
  return LOCALES.filter((l) => !!l.domain)
}

/**
 * Resolve the locale a hostname serves. Returns null when the host is not a
 * declared country domain, which is the normal case while routing by prefix.
 */
export function localeForHost(host: string | undefined, mode: RoutingMode = ROUTING_MODE): LocaleDefinition | null {
  if (!host || mode === 'prefix') return null
  const clean = normalizeHost(host)
  return LOCALES.find((l) => l.domain && normalizeHost(l.domain) === clean) ?? null
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '')
}

/**
 * Split a pathname into its locale and the locale-independent remainder.
 *
 * `/de/produits/v20` → { locale: de, path: '/produits/v20' }
 * `/produits/v20`    → { locale: fr, path: '/produits/v20' }
 *
 * `host` is consulted first so a country domain wins over a prefix, which keeps
 * `vitesse-eco.de/produits` correct without duplicating it as `/de/produits`.
 */
export function resolvePath(
  pathname: string,
  host?: string,
  mode: RoutingMode = ROUTING_MODE
): { locale: LocaleDefinition; path: string } {
  const path = normalizePath(pathname)

  const hostLocale = localeForHost(host, mode)
  if (hostLocale) return { locale: hostLocale, path: stripPrefix(path, hostLocale) }

  for (const locale of LOCALES) {
    if (!locale.prefix) continue
    if (path === locale.prefix || path.startsWith(`${locale.prefix}/`)) {
      return { locale, path: path.slice(locale.prefix.length) || '/' }
    }
  }
  return { locale: defaultLocale(), path }
}

function stripPrefix(path: string, locale: LocaleDefinition): string {
  if (!locale.prefix) return path
  if (path === locale.prefix) return '/'
  if (path.startsWith(`${locale.prefix}/`)) return path.slice(locale.prefix.length)
  return path
}

function normalizePath(pathname: string): string {
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  // A trailing slash on anything but the root produces a second URL for one page.
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') || '/' : '/'
}

/**
 * Build the path for a locale-independent path in a given locale.
 * Under domain routing the path carries no prefix — the host already says which
 * locale it is.
 */
export function localizedPath(path: string, locale: LocaleCode, mode: RoutingMode = ROUTING_MODE): string {
  const def = getLocale(locale)
  const clean = normalizePath(path)
  if (mode !== 'prefix' && def.domain) return clean
  if (!def.prefix) return clean
  return clean === '/' ? def.prefix : `${def.prefix}${clean}`
}

/**
 * Absolute URL for a page in a locale — the value used for canonical, hreflang
 * and the sitemap, so all three can never disagree.
 *
 * In `redirect` mode the country domain is deliberately NOT advertised: it only
 * forwards, and pointing search engines at a URL that 301s wastes the signal.
 */
export function localizedUrl(path: string, locale: LocaleCode, mode: RoutingMode = ROUTING_MODE): string {
  const def = getLocale(locale)
  const useOwnDomain = mode === 'domain' && !!def.domain
  const origin = `https://${useOwnDomain ? def.domain : PRIMARY_DOMAIN}`
  const localized = useOwnDomain ? normalizePath(path) : localizedPath(path, locale, 'prefix')
  return localized === '/' ? origin : `${origin}${localized}`
}

export interface AlternateLink {
  hreflang: string
  href: string
}

/**
 * The complete set of alternates for a page: one per locale, the declared
 * regional variants, and x-default pointing at the default locale.
 */
export function alternatesFor(path: string, mode: RoutingMode = ROUTING_MODE): AlternateLink[] {
  const links: AlternateLink[] = LOCALES.map((l) => ({
    hreflang: l.hreflang,
    href: localizedUrl(path, l.code, mode),
  }))
  for (const alt of REGIONAL_ALTERNATES) {
    links.push({ hreflang: alt.hreflang, href: localizedUrl(path, alt.locale, mode) })
  }
  links.push({ hreflang: 'x-default', href: localizedUrl(path, DEFAULT_LOCALE, mode) })
  return links
}

/**
 * Parse an Accept-Language header and pick the best supported locale.
 * Returns null when nothing matches, so the caller can fall through to the next
 * signal rather than being handed a wrong guess.
 */
export function negotiateLocale(acceptLanguage: string | undefined): LocaleCode | null {
  if (!acceptLanguage) return null

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.find((p) => p.trim().startsWith('q='))
      const q = qParam ? Number.parseFloat(qParam.split('=')[1] ?? '') : 1
      return { tag: (tag ?? '').trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 }
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of ranked) {
    if (tag === '*') return DEFAULT_LOCALE
    const base = tag.split('-')[0] ?? ''
    const match = LOCALES.find((l) => l.code === tag || l.code === base)
    if (match) return match.code
  }
  return null
}

/** Locale suggested by the visitor's country, used only when nothing stronger exists. */
export function localeForCountry(country: string | undefined): LocaleCode | null {
  if (!country) return null
  const upper = country.trim().toUpperCase()
  // Ordered by LOCALES, so a country listed by several locales resolves to the
  // one declared first — Belgium gets French, matching the primary market.
  return LOCALES.find((l) => l.countries.includes(upper))?.code ?? null
}

export interface DetectionSignals {
  host?: string
  pathname: string
  cookieLocale?: string
  acceptLanguage?: string
  country?: string
}

export interface DetectionResult {
  locale: LocaleCode
  /** Where the decision came from — surfaced so the UI knows whether to offer a switch. */
  source: 'url' | 'cookie' | 'accept-language' | 'country' | 'default'
  /**
   * True when the visitor is already on a URL that states its locale. Such a
   * request must never be redirected: doing so hides content from crawlers and
   * overrides a deliberate choice.
   */
  explicit: boolean
}

/**
 * Decide which locale to serve. The URL always wins; everything else is a
 * suggestion the visitor may decline.
 */
export function detectLocale(signals: DetectionSignals, mode: RoutingMode = ROUTING_MODE): DetectionResult {
  const hostLocale = localeForHost(signals.host, mode)
  if (hostLocale) return { locale: hostLocale.code, source: 'url', explicit: true }

  const path = normalizePath(signals.pathname)
  const prefixed = LOCALES.find(
    (l) => l.prefix && (path === l.prefix || path.startsWith(`${l.prefix}/`))
  )
  if (prefixed) return { locale: prefixed.code, source: 'url', explicit: true }

  if (isLocaleCode(signals.cookieLocale)) {
    return { locale: signals.cookieLocale, source: 'cookie', explicit: false }
  }

  const negotiated = negotiateLocale(signals.acceptLanguage)
  if (negotiated) return { locale: negotiated, source: 'accept-language', explicit: false }

  const byCountry = localeForCountry(signals.country)
  if (byCountry) return { locale: byCountry, source: 'country', explicit: false }

  return { locale: DEFAULT_LOCALE, source: 'default', explicit: false }
}
