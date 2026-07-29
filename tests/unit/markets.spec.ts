import { describe, expect, it } from 'vitest'
import {
  MARKETS,
  defaultMarket,
  getMarket,
  isMarketCountry,
  marketForHost,
  marketForLocale,
  marketForVisitorCountry,
  marketPrice,
  resolveMarket,
  vatNeutralPrice,
  type MarketPriceRule,
} from '../../shared/markets'
import { cents, fromEuros, vatIncludedIn, type Cents } from '../../shared/money'

const rule = (over: Partial<MarketPriceRule> = {}): MarketPriceRule => ({
  country: 'NL',
  adjustmentPercent: 0,
  rounding: 'exact',
  ...over,
})

describe('the market table', () => {
  it('declares exactly one primary market per selling locale', () => {
    const primaries = MARKETS.filter((m) => m.primary).map((m) => m.locale)
    expect(new Set(primaries).size).toBe(primaries.length)
  })

  it('has no duplicate countries', () => {
    const countries = MARKETS.map((m) => m.country)
    expect(new Set(countries).size).toBe(countries.length)
  })

  it('states a plausible VAT rate for every market', () => {
    for (const market of MARKETS) {
      expect(market.vatRateBp).toBeGreaterThan(1000)
      expect(market.vatRateBp).toBeLessThan(3000)
    }
  })

  it('recognises the countries it serves and nothing else', () => {
    expect(isMarketCountry('nl')).toBe(true)
    expect(isMarketCountry('  de  ')).toBe(true)
    expect(isMarketCountry('US')).toBe(false)
    expect(isMarketCountry(undefined)).toBe(false)
  })
})

describe('resolving which price list applies', () => {
  it('prices a locale for its own country', () => {
    expect(marketForLocale('nl').country).toBe('NL')
    expect(marketForLocale('de').country).toBe('DE')
    expect(marketForLocale('es').country).toBe('ES')
    expect(marketForLocale('fr').country).toBe('FR')
  })

  it('prices the bridge languages with the default market', () => {
    // English and Arabic address no country, so inventing a sixth price list
    // for them would mean quoting a figure no feed could ever match.
    expect(marketForLocale('en').country).toBe('FR')
    expect(marketForLocale('ar').country).toBe('FR')
  })

  it('ignores country domains while the site routes by prefix', () => {
    expect(marketForHost('vitesse-eco.nl', 'prefix')).toBeNull()
    expect(resolveMarket({ host: 'vitesse-eco.nl', locale: 'fr' }, 'prefix').country).toBe('FR')
  })

  it('lets a country domain outrank the locale once domains are live', () => {
    // Belgium reads the French pages but is its own market — the only case a
    // locale cannot express, and the reason the host is consulted first.
    expect(resolveMarket({ host: 'vitesse-eco.be', locale: 'fr' }, 'domain').country).toBe('BE')
    expect(resolveMarket({ host: 'www.vitesse-eco.nl:443', locale: 'fr' }, 'domain').country).toBe('NL')
  })

  it('falls back to the default market for an unknown host', () => {
    expect(resolveMarket({ host: 'staging.vercel.app', locale: 'fr' }, 'domain').country).toBe('FR')
  })

  it('falls back to the default market when nothing is known', () => {
    expect(resolveMarket({}).country).toBe(defaultMarket().country)
  })
})

describe('suggesting a market from the visitor country', () => {
  it('suggests the market itself when it has an address of its own', () => {
    expect(marketForVisitorCountry('NL')?.country).toBe('NL')
  })

  it('sends a Belgian to the pages Belgium is actually priced on', () => {
    // BE has no URL of its own yet, so offering it would be offering nowhere.
    expect(marketForVisitorCountry('BE')?.country).toBe('FR')
  })

  it('suggests nothing for a country we do not serve', () => {
    expect(marketForVisitorCountry('US')).toBeNull()
    expect(marketForVisitorCountry(undefined)).toBeNull()
  })
})

describe('applying a market rule to a price', () => {
  const base = fromEuros(1000)

  it('leaves the base price alone when there is no rule', () => {
    // A market nobody has thought about sells at the price the owner typed,
    // not at one this code invented.
    expect(marketPrice(base, null)).toBe(base)
    expect(marketPrice(base, undefined)).toBe(base)
  })

  it('moves a price up and down by percent', () => {
    expect(marketPrice(base, rule({ adjustmentPercent: 5 }))).toBe(fromEuros(1050))
    expect(marketPrice(base, rule({ adjustmentPercent: -2 }))).toBe(fromEuros(980))
  })

  it('rounds to the nearest euro when asked', () => {
    expect(marketPrice(fromEuros(1008.33), rule({ rounding: 'euro' }))).toBe(fromEuros(1008))
    expect(marketPrice(fromEuros(1008.73), rule({ rounding: 'euro' }))).toBe(fromEuros(1009))
  })

  it('produces a .99 price when asked', () => {
    expect(marketPrice(fromEuros(1008.33), rule({ rounding: 'charm' }))).toBe(fromEuros(1007.99))
    expect(marketPrice(fromEuros(0.2), rule({ rounding: 'charm' }))).toBe(cents(0))
  })

  it('never returns a fractional cent', () => {
    for (const percent of [0.83, -0.83, 1.5, 7.77, -3.33]) {
      const result = marketPrice(fromEuros(1249.99), rule({ adjustmentPercent: percent }))
      expect(Number.isInteger(result)).toBe(true)
    }
  })
})

describe('the VAT-neutral suggestion', () => {
  const fr = getMarket('FR')!
  const de = getMarket('DE')!
  const nl = getMarket('NL')!

  it('is the same price in the same market', () => {
    const base = fromEuros(1000)
    expect(vatNeutralPrice(base, fr, fr)).toBe(base)
  })

  it('is lower where VAT is lower', () => {
    // Germany charges 19% against France's 20%, so the same money in the till
    // means a slightly cheaper shelf price.
    expect(vatNeutralPrice(fromEuros(1200), fr, de)).toBe(fromEuros(1190))
  })

  it('is higher where VAT is higher', () => {
    expect(vatNeutralPrice(fromEuros(1200), fr, nl)).toBe(fromEuros(1210))
  })

  it('leaves the same net amount behind, to the cent', () => {
    const base = fromEuros(1249.99)
    const converted = vatNeutralPrice(base, fr, nl)
    const netHere = (base - vatIncludedIn(base, fr.vatRateBp)) as Cents
    const netThere = (converted - vatIncludedIn(converted, nl.vatRateBp)) as Cents
    expect(Math.abs(netHere - netThere)).toBeLessThanOrEqual(1)
  })
})

describe('VAT contained in a gross price', () => {
  it('extracts rather than adds', () => {
    // 1200 € including 20% is 1000 € plus 200 € of VAT — not 1200 plus 240.
    expect(vatIncludedIn(fromEuros(1200), 2000)).toBe(fromEuros(200))
    expect(vatIncludedIn(fromEuros(1210), 2100)).toBe(fromEuros(210))
  })

  it('is never more than the amount it came from', () => {
    for (const gross of [1, 99, 100_000, 124_999]) {
      const amount = cents(gross)
      expect(vatIncludedIn(amount, 2100)).toBeLessThanOrEqual(amount)
    }
  })

  it('is zero at a zero rate', () => {
    expect(vatIncludedIn(fromEuros(1200), 0)).toBe(0)
  })

  it('refuses a rate that is not a whole basis point', () => {
    expect(() => vatIncludedIn(fromEuros(100), 20.5)).toThrow()
    expect(() => vatIncludedIn(fromEuros(100), -1)).toThrow()
  })
})
