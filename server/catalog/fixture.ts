/**
 * The fixture catalogue — a deterministic stand-in for Sanity.
 *
 * `CATALOG_SOURCE=fixture` makes `sanity()` hand back this client instead of a
 * network one. Everything downstream is untouched: the same GROQ constants are
 * dispatched here against the committed documents in fixture-catalogue.json,
 * which are stored in the PROJECTED shape the real queries return, so the whole
 * parse.ts validation pipeline still runs over them. Pricing, stock, markets
 * and orders never learn where the documents came from — which is the point:
 * a release gate must be able to walk the shop against a catalogue that cannot
 * drift, vanish, or need a secret.
 *
 * This mode exists for the candidate test rig ONLY. Two guards enforce that:
 * it throws outright on Vercel (the platform production and previews deploy
 * to), and it warns unconditionally on activation so a log from any
 * environment says loudly what it is serving.
 */
import type { SanityClient } from '@sanity/client'
import raw from './fixture-catalogue.json'
import {
  ALL_PRODUCT_SLUGS_QUERY,
  ARTICLES_QUERY,
  ARTICLE_BY_SLUG_QUERY,
  ARTICLE_SLUGS_QUERY,
  BRANDS_QUERY,
  CATEGORIES_QUERY,
  FAQ_QUERY,
  FEED_PRODUCTS_QUERY,
  MARKET_PRICING_QUERY,
  PRODUCTS_BY_IDS_QUERY,
  PRODUCT_BY_SLUG_QUERY,
  PROMO_BY_CODE_QUERY,
  SELLING_TERMS_QUERY,
  SHIPPING_METHODS_QUERY,
  SIBLINGS_QUERY,
} from './queries'

export function fixtureCatalogueEnabled(): boolean {
  return process.env.CATALOG_SOURCE === 'fixture'
}

/** The projected fields this dispatcher filters and sorts on. */
interface FixtureProduct {
  _id: string
  slug: string
  sortOrder: number
  _createdAt: string
  _updatedAt: string
  name: Record<string, string>
  price: number
  productType: string
  sku: string | null
  modelFamily: string | null
  brand: { slug: string } | null
  category: { slug: string } | null
}

const data = raw as unknown as {
  products: FixtureProduct[]
  categories: Array<{ sortOrder: number }>
  brands: Array<{ name: string }>
  shippingMethods: Array<{
    code: string
    sortOrder: number
    price: number
    freeAbove: number | null
    zones: string[]
    postalCodePrefixes: string[]
  }>
  promos: Array<{ code: string }>
  articles: Array<{ slug: string; publishedAt: string; _updatedAt: string }>
  faqs: Array<{ sortOrder: number }>
  marketPricing: unknown
  inventory: Record<string, { sku: string; onHand: number }>
}

function byNumber<T>(pick: (entry: T) => number): (a: T, b: T) => number {
  return (a, b) => pick(a) - pick(b)
}

/** relevance = coalesce(sortOrder, 0) asc, name.fr asc — same as SORT_ORDERS. */
function relevance(a: FixtureProduct, b: FixtureProduct): number {
  return a.sortOrder - b.sortOrder || (a.name.fr ?? '').localeCompare(b.name.fr ?? '')
}

function sortedProducts(query: string): FixtureProduct[] {
  const products = [...data.products]
  if (query.includes('order(price asc)')) return products.sort(byNumber((p) => p.price))
  if (query.includes('order(price desc)')) return products.sort(byNumber((p) => -p.price))
  if (query.includes('order(_createdAt desc)')) {
    return products.sort((a, b) => b._createdAt.localeCompare(a._createdAt))
  }
  return products.sort(relevance)
}

/**
 * The listing filter, re-applied in JS.
 *
 * buildListQuery only binds a parameter when its clause is in the query, so the
 * presence of a param IS the filter list — mirroring the GROQ without parsing
 * it. `match` is approximated as a case-insensitive substring test, which is
 * looser than GROQ's token-prefix match but deterministic for a catalogue this
 * size, and the difference cannot hide a defect a browser test looks for.
 */
function filteredProducts(params: Record<string, unknown>): (p: FixtureProduct) => boolean {
  const search =
    typeof params.search === 'string' ? params.search.replace(/\*+$/, '').toLowerCase() : null
  return (product) => {
    if (params.productType && product.productType !== params.productType) return false
    if (params.categorySlug && product.category?.slug !== params.categorySlug) return false
    if (params.brandSlug && product.brand?.slug !== params.brandSlug) return false
    if (search) {
      const haystack = [...Object.values(product.name), product.sku ?? '']
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  }
}

function resolve(query: string, params: Record<string, unknown>): unknown {
  // Fixed-string queries first: imported constants compare by identity.
  switch (query) {
    case PRODUCT_BY_SLUG_QUERY:
      return data.products.find((p) => p.slug === params.slug) ?? null
    case PRODUCTS_BY_IDS_QUERY: {
      const ids = Array.isArray(params.ids) ? params.ids : []
      return data.products.filter((p) => ids.includes(p._id))
    }
    case SIBLINGS_QUERY:
      return data.products
        .filter(
          (p) =>
            p.modelFamily !== null &&
            p.modelFamily === params.modelFamily &&
            p.slug !== params.slug
        )
        .sort(byNumber((p) => p.sortOrder))
    case ALL_PRODUCT_SLUGS_QUERY:
      return [...data.products]
        .sort(byNumber((p) => p.sortOrder))
        .map((p) => ({ slug: p.slug, _updatedAt: p._updatedAt }))
    case FEED_PRODUCTS_QUERY:
      return [...data.products].sort(byNumber((p) => p.sortOrder))
    case SELLING_TERMS_QUERY:
      return {
        assembly: null,
        shipping: data.shippingMethods
          .filter((m) => m.code !== 'pickup')
          .map((m) => ({
            code: m.code,
            zones: m.zones,
            postalCodePrefixes: m.postalCodePrefixes,
            price: m.price,
            freeAbove: m.freeAbove,
          })),
      }
    case CATEGORIES_QUERY:
      return [...data.categories].sort(byNumber((c) => c.sortOrder))
    case BRANDS_QUERY:
      return [...data.brands].sort((a, b) => a.name.localeCompare(b.name))
    case SHIPPING_METHODS_QUERY:
      return [...data.shippingMethods].sort(byNumber((m) => m.sortOrder))
    case PROMO_BY_CODE_QUERY:
      return data.promos.find((p) => p.code.toUpperCase() === params.code) ?? null
    case MARKET_PRICING_QUERY:
      return data.marketPricing
    case ARTICLES_QUERY:
      return [...data.articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    case ARTICLE_BY_SLUG_QUERY:
      return data.articles.find((a) => a.slug === params.slug) ?? null
    case ARTICLE_SLUGS_QUERY:
      return [...data.articles]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .map((a) => ({ slug: a.slug, _updatedAt: a._updatedAt }))
    case FAQ_QUERY:
      return [...data.faqs].sort(byNumber((f) => f.sortOrder))
  }

  // The two dynamic shapes buildListQuery produces.
  if (query.startsWith('count(*[')) {
    return data.products.filter(filteredProducts(params)).length
  }
  if (query.includes('[$offset...$end]')) {
    const offset = typeof params.offset === 'number' ? params.offset : 0
    const end = typeof params.end === 'number' ? params.end : offset + 24
    return sortedProducts(query).filter(filteredProducts(params)).slice(offset, end)
  }

  // A query this dispatcher does not know is a gap in the fixture, and a gap
  // that answered [] would let a gate pass over an untested page. Fail loudly.
  throw new Error(
    `[catalog:fixture] unhandled GROQ query — extend server/catalog/fixture.ts:\n${query.slice(0, 200)}`
  )
}

export function createFixtureClient(): SanityClient {
  /**
   * The fixture must be impossible to ship. Vercel is where production and
   * every preview deploy; a candidate rig never runs there. Refusing to boot
   * beats any amount of discipline.
   */
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error(
      'CATALOG_SOURCE=fixture refuses to run on Vercel. The fixture catalogue exists ' +
        'for the local/CI candidate test rig only — unset CATALOG_SOURCE to serve the real catalogue.'
    )
  }
  console.warn(
    '[catalog] CATALOG_SOURCE=fixture — serving the DETERMINISTIC TEST CATALOGUE, not Sanity. ' +
      'Candidate test rigs only; never run production like this.'
  )

  const fake = {
    fetch: async <T>(query: string, params: Record<string, unknown> = {}): Promise<T> =>
      resolve(query, params) as T,
  }

  // Anything beyond fetch — patch, create, delete, listen — is a write or a
  // live connection, and the fixture is read-only by design.
  return new Proxy(fake, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof typeof target]
      if (typeof prop === 'symbol') return undefined
      return () => {
        throw new Error(
          `[catalog:fixture] SanityClient.${prop} is unavailable in fixture mode — the fixture catalogue is read-only`
        )
      }
    },
  }) as unknown as SanityClient
}
