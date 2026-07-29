import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_CODES,
  alternatesFor,
  detectLocale,
  domainRoutedLocales,
  getLocale,
  isLocaleCode,
  localeForCountry,
  localeForHost,
  localizedPath,
  localizedUrl,
  negotiateLocale,
  resolvePath,
} from '../../shared/locales'

describe('manifest integrity', () => {
  it('declares every locale exactly once', () => {
    expect(new Set(LOCALE_CODES).size).toBe(LOCALES.length)
  })

  it('gives the default locale no prefix and every other locale a unique one', () => {
    expect(getLocale(DEFAULT_LOCALE).prefix).toBe('')
    const prefixes = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).map((l) => l.prefix)
    expect(prefixes.every((p) => p.startsWith('/') && p.length > 1)).toBe(true)
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })

  it('keeps country domains unique so a host can never be ambiguous', () => {
    const domains = LOCALES.map((l) => l.domain).filter(Boolean)
    expect(new Set(domains).size).toBe(domains.length)
  })

  it('marks Arabic as the only right-to-left locale', () => {
    expect(LOCALES.filter((l) => l.dir === 'rtl').map((l) => l.code)).toEqual(['ar'])
  })

  it('recognises its own codes and rejects anything else', () => {
    expect(isLocaleCode('de')).toBe(true)
    expect(isLocaleCode('it')).toBe(false)
    expect(isLocaleCode(undefined)).toBe(false)
  })
})

describe('resolvePath — prefix mode', () => {
  it('reads the locale out of the prefix', () => {
    expect(resolvePath('/de/produits/v20').locale.code).toBe('de')
    expect(resolvePath('/de/produits/v20').path).toBe('/produits/v20')
  })

  it('treats an unprefixed path as the default locale', () => {
    const resolved = resolvePath('/produits/v20')
    expect(resolved.locale.code).toBe(DEFAULT_LOCALE)
    expect(resolved.path).toBe('/produits/v20')
  })

  it('handles a bare locale root', () => {
    expect(resolvePath('/de')).toMatchObject({ path: '/' })
    expect(resolvePath('/de').locale.code).toBe('de')
  })

  it('does not mistake a page whose name starts like a prefix', () => {
    // "/design" must not be read as the "/de" prefix followed by "sign".
    const resolved = resolvePath('/design')
    expect(resolved.locale.code).toBe(DEFAULT_LOCALE)
    expect(resolved.path).toBe('/design')
  })

  it('normalises trailing slashes so one page has one URL', () => {
    expect(resolvePath('/de/produits/').path).toBe('/produits')
    expect(resolvePath('/').path).toBe('/')
  })
})

describe('resolvePath — domain mode', () => {
  it('lets the host decide, with no prefix in the path', () => {
    const resolved = resolvePath('/produits/v20', 'vitesse-eco.de', 'domain')
    expect(resolved.locale.code).toBe('de')
    expect(resolved.path).toBe('/produits/v20')
  })

  it('ignores www and a port', () => {
    expect(localeForHost('www.vitesse-eco.nl:3000', 'domain')?.code).toBe('nl')
  })

  it('ignores country domains entirely while routing by prefix', () => {
    expect(localeForHost('vitesse-eco.de', 'prefix')).toBeNull()
    expect(domainRoutedLocales('prefix')).toEqual([])
  })

  it('does not double up when a domain-routed path still carries its prefix', () => {
    expect(resolvePath('/de/produits', 'vitesse-eco.de', 'domain').path).toBe('/produits')
  })
})

describe('URL building', () => {
  it('builds prefixed paths today', () => {
    expect(localizedPath('/produits', 'de')).toBe('/de/produits')
    expect(localizedPath('/produits', 'fr')).toBe('/produits')
    expect(localizedPath('/', 'de')).toBe('/de')
  })

  it('drops the prefix once the locale has its own domain', () => {
    expect(localizedPath('/produits', 'de', 'domain')).toBe('/produits')
  })

  it('builds absolute URLs on the primary domain in prefix mode', () => {
    expect(localizedUrl('/produits', 'de')).toBe('https://vitesse-eco.fr/de/produits')
    expect(localizedUrl('/', 'fr')).toBe('https://vitesse-eco.fr')
  })

  it('moves to the country domain in domain mode', () => {
    expect(localizedUrl('/produits', 'de', 'domain')).toBe('https://vitesse-eco.de/produits')
    expect(localizedUrl('/', 'de', 'domain')).toBe('https://vitesse-eco.de')
  })

  it('keeps a locale without a domain on the primary host even in domain mode', () => {
    expect(localizedUrl('/produits', 'ar', 'domain')).toBe('https://vitesse-eco.fr/ar/produits')
  })

  it('never advertises a redirect-only domain to search engines', () => {
    expect(localizedUrl('/produits', 'de', 'redirect')).toBe('https://vitesse-eco.fr/de/produits')
  })
})

describe('alternates', () => {
  it('emits one link per locale plus regional variants and x-default', () => {
    const links = alternatesFor('/produits')
    expect(links).toHaveLength(LOCALES.length + 2 + 1)
    expect(links.filter((l) => l.hreflang === 'x-default')).toHaveLength(1)
    expect(links.find((l) => l.hreflang === 'x-default')?.href).toBe(
      localizedUrl('/produits', DEFAULT_LOCALE)
    )
  })

  it('declares both Belgian communities', () => {
    const links = alternatesFor('/produits')
    expect(links.find((l) => l.hreflang === 'fr-BE')?.href).toBe('https://vitesse-eco.fr/produits')
    expect(links.find((l) => l.hreflang === 'nl-BE')?.href).toBe('https://vitesse-eco.fr/nl/produits')
  })

  it('keeps canonical and alternates in step when the routing mode changes', () => {
    const links = alternatesFor('/produits', 'domain')
    expect(links.find((l) => l.hreflang === 'de')?.href).toBe(localizedUrl('/produits', 'de', 'domain'))
    expect(links.find((l) => l.hreflang === 'nl')?.href).toBe(localizedUrl('/produits', 'nl', 'domain'))
  })

  it('emits absolute https URLs everywhere', () => {
    for (const link of alternatesFor('/produits')) {
      expect(link.href.startsWith('https://')).toBe(true)
    }
  })
})

describe('negotiateLocale', () => {
  it('picks the highest-quality supported language', () => {
    expect(negotiateLocale('nl-NL,nl;q=0.9,en;q=0.8')).toBe('nl')
    expect(negotiateLocale('de-AT,de;q=0.9')).toBe('de')
    expect(negotiateLocale('en-US,en;q=0.9')).toBe('en')
  })

  it('respects quality ordering rather than header order', () => {
    expect(negotiateLocale('it;q=1.0,de;q=0.9,en;q=0.95')).toBe('en')
  })

  it('skips unsupported languages instead of guessing', () => {
    expect(negotiateLocale('it-IT,it;q=0.9')).toBeNull()
    expect(negotiateLocale('')).toBeNull()
    expect(negotiateLocale(undefined)).toBeNull()
  })

  it('treats a wildcard as the default locale', () => {
    expect(negotiateLocale('*')).toBe(DEFAULT_LOCALE)
  })

  it('ignores entries the visitor explicitly refused', () => {
    expect(negotiateLocale('de;q=0,en;q=0.5')).toBe('en')
  })
})

describe('localeForCountry', () => {
  it('maps target markets', () => {
    expect(localeForCountry('NL')).toBe('nl')
    expect(localeForCountry('DE')).toBe('de')
    expect(localeForCountry('ES')).toBe('es')
    expect(localeForCountry('fr')).toBe('fr')
  })

  it('sends Belgium to French, the primary market language', () => {
    expect(localeForCountry('BE')).toBe('fr')
  })

  it('returns null for countries we do not serve', () => {
    expect(localeForCountry('JP')).toBeNull()
    expect(localeForCountry(undefined)).toBeNull()
  })
})

describe('detectLocale', () => {
  it('lets an explicit URL win over every other signal', () => {
    const result = detectLocale({
      pathname: '/de/produits',
      cookieLocale: 'nl',
      acceptLanguage: 'es-ES',
      country: 'FR',
    })
    expect(result).toEqual({ locale: 'de', source: 'url', explicit: true })
  })

  it('lets a country domain win too', () => {
    const result = detectLocale(
      { host: 'vitesse-eco.nl', pathname: '/produits', acceptLanguage: 'de-DE' },
      'domain'
    )
    expect(result).toEqual({ locale: 'nl', source: 'url', explicit: true })
  })

  it('prefers a saved preference over the browser header', () => {
    const result = detectLocale({ pathname: '/', cookieLocale: 'ar', acceptLanguage: 'de-DE' })
    expect(result).toEqual({ locale: 'ar', source: 'cookie', explicit: false })
  })

  it('falls through cookie → accept-language → country → default', () => {
    expect(detectLocale({ pathname: '/', acceptLanguage: 'nl-NL' }).source).toBe('accept-language')
    expect(detectLocale({ pathname: '/', country: 'DE' }).source).toBe('country')
    expect(detectLocale({ pathname: '/' })).toEqual({
      locale: DEFAULT_LOCALE,
      source: 'default',
      explicit: false,
    })
  })

  it('ignores a corrupt cookie rather than trusting it', () => {
    const result = detectLocale({ pathname: '/', cookieLocale: 'zz', acceptLanguage: 'de-DE' })
    expect(result.locale).toBe('de')
  })

  it('marks non-URL decisions as suggestions, never as explicit', () => {
    // A suggestion may show a banner; it must never trigger a redirect, which
    // would hide content from crawlers and override a deliberate choice.
    for (const signals of [
      { pathname: '/', cookieLocale: 'nl' },
      { pathname: '/', acceptLanguage: 'nl' },
      { pathname: '/', country: 'NL' },
      { pathname: '/' },
    ]) {
      expect(detectLocale(signals).explicit).toBe(false)
    }
  })
})
