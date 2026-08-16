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
 * This mode exists for the candidate test rig ONLY, and activation is a
 * CONTRACT, not a flag: the explicit CANDIDATE_TEST_RIG sentinel must be set,
 * the site URL and the database must both be loopback, and Vercel is refused
 * outright as defense-in-depth. All of it is enforced at RUNTIME, on the
 * first catalogue read — building with CATALOG_SOURCE set is inert; serving
 * with it is what the guard stops. The contract is a pure function below so
 * the unit suite proves every refusal without booting anything.
 */
import type { SanityClient } from '@sanity/client'
import { isLoopbackUrl } from '../../shared/loopback-url.mjs'
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

/**
 * The environment facts the activation contract reads. The index signature is
 * what lets a raw process.env pass without a cast — only the five named keys
 * are ever consulted.
 */
export interface FixtureRigEnv {
  CANDIDATE_TEST_RIG?: string
  NUXT_PUBLIC_SITE_URL?: string
  DATABASE_URL?: string
  VERCEL?: string
  VERCEL_ENV?: string
  [key: string]: string | undefined
}

/**
 * Why this environment may NOT serve the fixture catalogue — empty means it may.
 *
 * The rules, in the order a reader should learn them:
 *  - Vercel is where production and its previews deploy; the fixture never
 *    serves there, whatever else is set. Defense-in-depth, not the main gate.
 *  - CANDIDATE_TEST_RIG=1 is the explicit human statement "this process is a
 *    test rig". No sentinel, no fixture — a copied .env cannot activate it by
 *    accident, and no hosting provider's name is load-bearing.
 *  - The site URL and the database must be loopback. A candidate rig serves
 *    127.0.0.1 and owns a disposable local database; anything public in
 *    either slot means this is not a candidate rig, whatever it claims.
 *
 * Deliberately NOT consulted: NODE_ENV (the candidate is itself a
 * production-shaped build), branch names, and CI variables.
 */
export function fixtureActivationProblems(env: FixtureRigEnv): string[] {
  const problems: string[] = []
  if (env.VERCEL || env.VERCEL_ENV) {
    problems.push('this process is running on Vercel — the fixture catalogue never serves a deployment')
  }
  if (env.CANDIDATE_TEST_RIG !== '1') {
    problems.push('CANDIDATE_TEST_RIG=1 is not set — the explicit candidate-rig sentinel is required')
  }
  if (!isLoopbackUrl(env.NUXT_PUBLIC_SITE_URL)) {
    problems.push(
      `NUXT_PUBLIC_SITE_URL is ${env.NUXT_PUBLIC_SITE_URL ? 'not a loopback URL' : 'not set'} — a candidate rig serves localhost/127.0.0.1/::1, never a public host`
    )
  }
  if (env.DATABASE_URL && !isLoopbackUrl(env.DATABASE_URL)) {
    problems.push('DATABASE_URL is not loopback — a candidate rig owns a disposable local database')
  }
  return problems
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
  // The fixture must be impossible to ship. The whole contract is checked
  // here, on first catalogue read, and every unmet term is named at once.
  const problems = fixtureActivationProblems(process.env)
  if (problems.length > 0) {
    throw new Error(
      'CATALOG_SOURCE=fixture refuses to activate:\n' +
        problems.map((problem) => `  - ${problem}`).join('\n') +
        '\nThe fixture catalogue exists for the local/CI candidate test rig only — ' +
        'unset CATALOG_SOURCE to serve the real catalogue, or complete the rig ' +
        '(see docs/testing/BROWSER_GATES.md).'
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
