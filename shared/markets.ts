/**
 * Markets — which price a visitor sees, and why.
 *
 * The rule this file exists to hold: **the price is a function of the URL, never
 * of the visitor's IP address.**
 *
 * Three separate things break the moment a price depends on who is asking:
 *
 *  - Google Shopping. The crawler fetches the landing page named in the feed and
 *    compares the price it finds with the price the feed declared. A page that
 *    answers differently depending on where the request came from gives the
 *    crawler an arbitrary one; the item is disapproved for a price mismatch, and
 *    a shop that keeps doing it loses the account.
 *  - Caching. A page whose price varies per visitor cannot be served from one
 *    cached copy, so every product view becomes an origin request.
 *  - EU Regulation 2018/302. Sending a visitor to a different country version
 *    because of their IP is not permitted without their explicit consent, and a
 *    customer must stay free to buy on any version at that version's terms.
 *
 * So a market is *addressed*: `/nl/…` — and later vitesse-eco.nl — is the Dutch
 * market and shows Dutch prices to everyone who opens it, crawler or customer.
 * The visitor's own country is used for exactly one thing: offering them a
 * switch they are free to decline.
 *
 * The price displayed is the price charged. Where the parcel goes does not
 * change that — it bears only on how the VAT inside it is later declared, which
 * is a question for invoicing and OSS registration and is not decided here.
 */
import { DEFAULT_LOCALE, ROUTING_MODE, type LocaleCode, type RoutingMode } from './locales'
import {
  adjustByPercent,
  cents,
  roundToEuro,
  toCharmPrice,
  type Cents,
} from './money'

export interface MarketDefinition {
  /** ISO 3166-1 alpha-2. */
  country: string
  /** The site version that addresses this market. */
  locale: LocaleCode
  /**
   * Standard VAT rate in basis points (20.00% = 2000). This is law rather than a
   * business decision, so it lives in code and changes by deploy.
   */
  vatRateBp: number
  /**
   * True when this is the country a locale's URLs price for.
   *
   * France, the Netherlands, Germany and Spain each own a locale. Belgium and
   * Luxembourg read the French pages, so today they are priced with France — a
   * market with no address of its own cannot have a price of its own, because
   * there would be no URL for the feed to point at.
   */
  primary: boolean
  /**
   * Country domain that would address this market directly. Declared ahead of
   * use so a Belgian price becomes possible the day the domain exists, without
   * touching anything but this table.
   */
  domain?: string
}

export const DEFAULT_MARKET_COUNTRY = 'FR'

/** VAT rates as of July 2026. */
export const MARKETS: readonly MarketDefinition[] = [
  { country: 'FR', locale: 'fr', vatRateBp: 2000, primary: true, domain: 'vitesse-eco.fr' },
  { country: 'BE', locale: 'fr', vatRateBp: 2100, primary: false, domain: 'vitesse-eco.be' },
  { country: 'LU', locale: 'fr', vatRateBp: 1700, primary: false },
  { country: 'NL', locale: 'nl', vatRateBp: 2100, primary: true, domain: 'vitesse-eco.nl' },
  { country: 'DE', locale: 'de', vatRateBp: 1900, primary: true, domain: 'vitesse-eco.de' },
  { country: 'ES', locale: 'es', vatRateBp: 2100, primary: true, domain: 'vitesse-eco.es' },
] as const

/**
 * The markets a URL can actually reach today.
 *
 * The table above declares every market we intend to serve, including ones that
 * have no address yet. Those must not be offered for pricing: a price set for a
 * market no URL resolves to is a number the owner types, saves, and never sees
 * again — no page can show it and no feed can point at it.
 *
 * Under prefix routing that means the four locales with a country of their own.
 * Under domain routing it also means every market whose domain is live, which is
 * how Belgium joins the moment vitesse-eco.be exists.
 */
export function servableMarkets(mode: RoutingMode = ROUTING_MODE): MarketDefinition[] {
  return MARKETS.filter((m) => m.primary || (mode === 'domain' && !!m.domain))
}

export function isServableMarket(country: unknown, mode: RoutingMode = ROUTING_MODE): boolean {
  if (typeof country !== 'string') return false
  const upper = country.trim().toUpperCase()
  return servableMarkets(mode).some((m) => m.country === upper)
}

/**
 * Territories inside a market we do not sell to at all.
 *
 * A market is a country in the price list, but a country is not always one
 * shipping reality. The Canaries, Ceuta and Melilla sit outside the EU customs
 * and VAT union — a parcel there is an export declaration, different VAT and a
 * different cost — and the Balearics are a ferry crossing away from the price
 * the mainland pays. The owner's decision is not to sell to any of them.
 *
 * This is a property of the DESTINATION, not of any one shipping method, which
 * is why it lives here rather than in a method's postcode prefixes. Those are
 * global to a method: adding Spanish prefixes to store collection, the one
 * method offered everywhere, would have removed collection from France.
 *
 * Matched on the leading digits of the postcode.
 */
export const UNSERVED_POSTAL_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  // 07 Illes Balears · 35 Las Palmas · 38 Santa Cruz de Tenerife · 51 Ceuta · 52 Melilla
  ES: ['07', '35', '38', '51', '52'],
}

/**
 * Whether we sell to this address at all.
 *
 * An unknown postcode is servable: the checkout asks again with the real one
 * before anything is priced or charged, and refusing early would block the
 * customer before they have finished typing.
 */
export function isServableDestination(country: unknown, postalCode?: string | null): boolean {
  if (typeof country !== 'string') return false
  const excluded = UNSERVED_POSTAL_PREFIXES[country.trim().toUpperCase()]
  if (!excluded) return true
  const postal = (postalCode ?? '').replace(/\s/g, '').toUpperCase()
  if (!postal) return true
  return !excluded.some((prefix) => postal.startsWith(prefix))
}

const BY_COUNTRY = new Map<string, MarketDefinition>(MARKETS.map((m) => [m.country, m]))

export function isMarketCountry(value: unknown): boolean {
  return typeof value === 'string' && BY_COUNTRY.has(value.trim().toUpperCase())
}

export function getMarket(country: string | undefined | null): MarketDefinition | null {
  if (!country) return null
  return BY_COUNTRY.get(country.trim().toUpperCase()) ?? null
}

export function defaultMarket(): MarketDefinition {
  const found = BY_COUNTRY.get(DEFAULT_MARKET_COUNTRY)
  if (!found) throw new Error('markets: the default market is not declared')
  return found
}

/**
 * The market a locale's URLs are priced for.
 *
 * English and Arabic have no country of their own — they are bridge languages
 * for visitors the other five do not reach — so they carry the default market's
 * prices rather than inventing a sixth price list.
 */
export function marketForLocale(locale: LocaleCode): MarketDefinition {
  return MARKETS.find((m) => m.primary && m.locale === locale) ?? defaultMarket()
}

/** The market a country domain addresses, when domains are actually in use. */
export function marketForHost(
  host: string | undefined,
  mode: RoutingMode = ROUTING_MODE
): MarketDefinition | null {
  if (!host || mode !== 'domain') return null
  const clean = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '')
  return MARKETS.find((m) => m.domain && m.domain.toLowerCase() === clean) ?? null
}

/**
 * Decide which price list applies to a request.
 *
 * The host wins where it is meaningful — vitesse-eco.be serves French pages but
 * Belgian prices, which no locale can express — and otherwise the locale in the
 * URL decides. Nothing else is consulted, and in particular the market is never
 * read from a request field: a page and the basket it fills must not be able to
 * disagree about what something costs.
 */
export function resolveMarket(
  signals: { host?: string | undefined; locale?: LocaleCode | undefined },
  mode: RoutingMode = ROUTING_MODE
): MarketDefinition {
  return marketForHost(signals.host, mode) ?? marketForLocale(signals.locale ?? DEFAULT_LOCALE)
}

/**
 * The market a visitor's own country would suggest.
 *
 * Only ever a suggestion: acting on it without asking is the automatic
 * redirection Regulation 2018/302 forbids. Returns null when we do not serve
 * their country, so the caller offers nothing rather than something wrong.
 */
export function marketForVisitorCountry(country: string | undefined): MarketDefinition | null {
  const market = getMarket(country)
  // A market with no address of its own cannot be offered — there is nowhere to
  // send them. Belgium is suggested France's pages, which is where it is priced.
  if (market && !market.primary) return marketForLocale(market.locale)
  return market
}

export type PriceRounding = 'exact' | 'euro' | 'charm'

/**
 * A catalogue-wide adjustment for one market, authored by the owner.
 *
 * It exists because pricing 147 products in four markets by hand is not a job
 * anyone does twice. The rule sets the shape of a market's prices; a product
 * that needs its own figure overrides it outright.
 */
export interface MarketPriceRule {
  country: string
  /** Applied to the base price. 0 leaves it alone; -1.5 makes it 1.5% cheaper. */
  adjustmentPercent: number
  rounding: PriceRounding
}

function applyRounding(amount: Cents, rounding: PriceRounding): Cents {
  if (rounding === 'euro') return roundToEuro(amount)
  if (rounding === 'charm') return toCharmPrice(amount)
  return amount
}

/**
 * What a base price becomes in a market.
 *
 * With no rule the base price stands, so a market the owner has not thought
 * about sells at the price they actually typed rather than at one this file
 * invented.
 */
export function marketPrice(base: Cents, rule: MarketPriceRule | null | undefined): Cents {
  if (!rule) return base
  return applyRounding(adjustByPercent(base, rule.adjustmentPercent), rule.rounding)
}

/**
 * The price that leaves the same money in the till after VAT.
 *
 * France charges 20% and Germany 19%, so an identical shelf price earns about
 * 0.8% more in Germany and about 0.8% less in the Netherlands. This is the
 * figure that cancels that out — offered in the panel as a suggestion the owner
 * can take or ignore, never applied on its own.
 */
export function vatNeutralPrice(
  base: Cents,
  from: MarketDefinition,
  to: MarketDefinition
): Cents {
  return cents(Math.round((base * (10_000 + to.vatRateBp)) / (10_000 + from.vatRateBp)))
}
