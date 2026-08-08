/**
 * The catalogue service.
 *
 * The one place that joins editorial content to sellable quantity. Callers ask
 * for products; they never learn that the words came from a document store and
 * the numbers from Postgres.
 */
import { db } from '../db/client'
import { readAvailability } from '../services/stock'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { DEFAULT_LOCALE, type LocaleCode } from '../../shared/locales'
import {
  isServableDestination,
  marketForLocale,
  type MarketDefinition,
  type MarketPriceRule,
} from '../../shared/markets'
import { cachedFetch } from './client'
import {
  parseArticle,
  parseArticleDetail,
  parseBrand,
  parseCategory,
  parseFaq,
  parseMarketRules,
  parseProductDetail,
  parseProductSummary,
  parsePromo,
  parseShippingMethod,
} from './parse'
import type { ParseContext } from './parse'
import {
  ALL_PRODUCT_SLUGS_QUERY,
  ARTICLES_QUERY,
  ARTICLE_BY_SLUG_QUERY,
  ARTICLE_SLUGS_QUERY,
  BRANDS_QUERY,
  FAQ_QUERY,
  CATEGORIES_QUERY,
  MARKET_PRICING_QUERY,
  PRODUCTS_BY_IDS_QUERY,
  PRODUCT_BY_SLUG_QUERY,
  PROMO_BY_CODE_QUERY,
  SHIPPING_METHODS_QUERY,
  SIBLINGS_QUERY,
  SORT_ORDERS,
  buildListQuery,
} from './queries'
import type {
  Article,
  ArticleDetail,
  Brand,
  Category,
  FaqEntry,
  Paginated,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  PromoDefinition,
  ShippingMethod,
} from './types'

const MAX_PER_PAGE = 48

/**
 * The owner's per-market adjustments, cached as long as the shipping table
 * because it changes about as often. A missing document simply means every
 * market sells at the base price.
 */
async function marketRules(): Promise<Map<string, MarketPriceRule>> {
  const documents = await cachedFetch<unknown>('market-pricing', MARKET_PRICING_QUERY, {}, 300_000)
  return parseMarketRules(documents)
}

/**
 * Assemble the pricing half of a parse context.
 *
 * When no market is given the locale decides, which is the whole design: the
 * URL a page was requested at determines its prices, so a crawler and a customer
 * opening the same address are quoted the same figure.
 */
async function pricingFor(
  locale: LocaleCode,
  market?: MarketDefinition
): Promise<Pick<ParseContext, 'market' | 'priceRule'>> {
  const resolved = market ?? marketForLocale(locale)
  const rules = await marketRules()
  return { market: resolved, priceRule: rules.get(resolved.country) ?? null }
}

/** Availability for a set of products, defaulting to zero for anything unknown. */
async function availabilityFor(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map()

  const rows = await readAvailability(db(), productIds)
  const result = new Map<string, number>()
  for (const id of productIds) {
    result.set(id, rows.get(id)?.available ?? 0)
  }
  return result
}

export async function listProducts(query: ProductQuery): Promise<Paginated<ProductSummary>> {
  const page = Math.max(1, query.page ?? 1)
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, query.perPage ?? 24))
  const offset = (page - 1) * perPage

  const order = SORT_ORDERS[query.sort ?? 'relevance'] ?? SORT_ORDERS.relevance
  const filters = {
    productType: query.productType,
    categorySlug: query.categorySlug,
    brandSlug: query.brandSlug,
    search: query.search,
  }
  const built = buildListQuery(filters, order as string)

  const params: Record<string, unknown> = {
    offset,
    end: offset + perPage,
    ...(filters.productType ? { productType: filters.productType } : {}),
    ...(filters.categorySlug ? { categorySlug: filters.categorySlug } : {}),
    ...(filters.brandSlug ? { brandSlug: filters.brandSlug } : {}),
    // GROQ `match` wants a wildcard to behave like a prefix search.
    ...(filters.search ? { search: `${filters.search}*` } : {}),
  }

  const cacheKey = `list:${JSON.stringify({ filters, order, offset, perPage })}`
  const [documents, total] = await Promise.all([
    cachedFetch<unknown[]>(cacheKey, built.query, params),
    cachedFetch<number>(`${cacheKey}:count`, built.countQuery, params),
  ])

  const ids = documents
    .map((document) => (document as { _id?: string })?._id)
    .filter((id): id is string => typeof id === 'string')
  const [availability, pricing] = await Promise.all([
    availabilityFor(ids),
    pricingFor(query.locale, query.market),
  ])

  let items = documents
    .map((document) => parseProductSummary(document, { locale: query.locale, availability, ...pricing }))
    .filter((product): product is ProductSummary => product !== null)

  // Filtering on stock happens here rather than in GROQ, because the numbers
  // live in Postgres. The count above is therefore the catalogue count; the
  // page is what is actually buyable.
  if (query.inStockOnly) {
    items = items.filter((product) => product.available > 0)
  }

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

/**
 * Products by id, for pricing a basket.
 *
 * Anything absent from the result is not purchasable — retired, unpublished, or
 * never real — and the caller is expected to treat that as a rejected line
 * rather than a zero-priced one.
 */
export async function getProductsByIds(
  productIds: string[],
  locale: LocaleCode,
  market?: MarketDefinition
): Promise<Map<string, ProductSummary>> {
  const unique = [...new Set(productIds)]
  if (unique.length === 0) return new Map()

  const documents = await cachedFetch<unknown[]>(
    `by-ids:${unique.slice().sort().join(',')}`,
    PRODUCTS_BY_IDS_QUERY,
    { ids: unique },
    30_000
  )
  const [availability, pricing] = await Promise.all([
    availabilityFor(unique),
    pricingFor(locale, market),
  ])

  const result = new Map<string, ProductSummary>()
  for (const document of documents) {
    const product = parseProductSummary(document, { locale, availability, ...pricing })
    if (product) result.set(product.id, product)
  }
  return result
}

export async function getProduct(
  slug: string,
  locale: LocaleCode,
  market?: MarketDefinition
): Promise<ProductDetail> {
  const document = await cachedFetch<unknown>(`product:${slug}`, PRODUCT_BY_SLUG_QUERY, { slug })

  if (!document) {
    // A 404 rather than an empty page: an unknown product URL must tell search
    // engines it is gone, not return 200 with nothing on it.
    throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `no published product for slug "${slug}"` })
  }

  const raw = document as { _id?: string; modelFamily?: string | null }
  const family = raw.modelFamily ?? null

  const siblingDocuments = family
    ? await cachedFetch<unknown[]>(`siblings:${family}:${slug}`, SIBLINGS_QUERY, {
        modelFamily: family,
        slug,
      })
    : []

  const ids = [
    raw._id,
    ...siblingDocuments.map((entry) => (entry as { _id?: string })?._id),
  ].filter((id): id is string => typeof id === 'string')
  const [availability, pricing] = await Promise.all([
    availabilityFor(ids),
    pricingFor(locale, market),
  ])
  const context: ParseContext = { locale, availability, ...pricing }

  const siblings = siblingDocuments
    .map((entry) => parseProductSummary(entry, context))
    .filter((entry): entry is ProductSummary => entry !== null)

  const product = parseProductDetail(document, context, siblings)
  if (!product) {
    throw new AppError(ERROR_CODES.NOT_FOUND, {
      internal: `product "${slug}" exists but could not be parsed`,
    })
  }
  return product
}

/**
 * Slugs for every sellable product, with the date each was last edited.
 *
 * Used by the sitemap, which must cover the whole catalogue rather than the
 * first page of it.
 */
export async function listAllProductSlugs(): Promise<Array<{ slug: string; updatedAt: string }>> {
  const rows = await cachedFetch<Array<{ slug?: string; _updatedAt?: string }>>(
    'all-product-slugs',
    ALL_PRODUCT_SLUGS_QUERY,
    {},
    300_000
  )
  return rows
    .filter((row): row is { slug: string; _updatedAt?: string } => Boolean(row?.slug))
    .map((row) => ({ slug: row.slug, updatedAt: (row._updatedAt ?? '').slice(0, 10) }))
}

/** Published articles, newest first. */
export async function listArticles(locale: LocaleCode): Promise<Article[]> {
  const documents = await cachedFetch<unknown[]>('articles', ARTICLES_QUERY, {}, 300_000)
  return documents
    .map((document) => parseArticle(document, locale))
    .filter((entry): entry is Article => entry !== null)
}

export async function getArticle(slug: string, locale: LocaleCode): Promise<ArticleDetail> {
  const document = await cachedFetch<unknown>(`article:${slug}`, ARTICLE_BY_SLUG_QUERY, { slug }, 300_000)
  if (!document) {
    // A 404, not an empty page: an unknown article URL must say it is gone.
    throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `no published article "${slug}"` })
  }

  // Related products carry live prices and stock, so they go through the same
  // pricing path as anywhere else rather than being rendered from the document.
  const raw = document as { relatedProducts?: unknown[] }
  const related = raw.relatedProducts ?? []
  const ids = related
    .map((entry) => (entry as { _id?: string })?._id)
    .filter((id): id is string => typeof id === 'string')
  const [availability, pricing] = await Promise.all([availabilityFor(ids), pricingFor(locale)])
  const products = related
    .map((entry) => parseProductSummary(entry, { locale, availability, ...pricing }))
    .filter((entry): entry is ProductSummary => entry !== null)

  const article = parseArticleDetail(document, locale, products)
  if (!article) {
    throw new AppError(ERROR_CODES.NOT_FOUND, {
      internal: `article "${slug}" exists but could not be parsed`,
    })
  }
  return article
}

/** Slugs for the sitemap, with each article's own last-edited date. */
export async function listArticleSlugs(): Promise<Array<{ slug: string; updatedAt: string }>> {
  const rows = await cachedFetch<Array<{ slug?: string; _updatedAt?: string }>>(
    'article-slugs',
    ARTICLE_SLUGS_QUERY,
    {},
    300_000
  )
  return rows
    .filter((row): row is { slug: string; _updatedAt?: string } => Boolean(row?.slug))
    .map((row) => ({ slug: row.slug, updatedAt: (row._updatedAt ?? '').slice(0, 10) }))
}

export async function listFaqs(locale: LocaleCode): Promise<FaqEntry[]> {
  const documents = await cachedFetch<unknown[]>('faqs', FAQ_QUERY, {}, 300_000)
  return documents
    .map((document) => parseFaq(document, locale))
    .filter((entry): entry is FaqEntry => entry !== null)
}

export async function listCategories(locale: LocaleCode): Promise<Category[]> {
  const documents = await cachedFetch<unknown[]>('categories', CATEGORIES_QUERY, {}, 300_000)
  return documents
    .map((document) => parseCategory(document, locale))
    .filter((entry): entry is Category => entry !== null)
}

export async function listBrands(): Promise<Brand[]> {
  const documents = await cachedFetch<unknown[]>('brands', BRANDS_QUERY, {}, 300_000)
  return documents.map(parseBrand).filter((entry): entry is Brand => entry !== null)
}

/**
 * Shipping methods that actually serve a destination.
 *
 * Both tests are applied here, once. Quoting a method the order endpoint will
 * later refuse walks a customer all the way to payment before failing — which
 * is what the previous build did for every German and Spanish address.
 */
/**
 * Where the shop genuinely delivers, and what it charges there.
 *
 * Derived from the same  documents the checkout quotes and the
 * Merchant feed advertises, because a product page that claims a different
 * delivery footprint from the feed hands Google two answers for one product.
 * It claimed France, Belgium and the Netherlands from a hardcoded constant
 * while the feed advertised six countries — and never mentioned Spain at all.
 *
 * Collection is excluded: picking an order up in Poitiers is not delivery, and
 * listing it as a shipping rate advertises service the shop does not run.
 */
export async function deliveryCoverage(): Promise<
  Array<{ country: string; priceCents: number; postalPrefixes: string[] }>
> {
  const documents = await cachedFetch<unknown[]>('shipping', SHIPPING_METHODS_QUERY, {}, 300_000)
  const cheapest = new Map<string, { priceCents: number; postalPrefixes: string[] }>()

  for (const document of documents) {
    const method = parseShippingMethod(document, DEFAULT_LOCALE)
    if (!method || method.code === 'pickup') continue
    for (const country of method.countries) {
      const current = cheapest.get(country)
      // The cheapest option decides, and it brings its postal scoping with it.
      // Free delivery in France is department 86 only; stating the price without
      // the restriction advertises a nationwide service the till refuses.
      if (current === undefined || method.price < current.priceCents) {
        cheapest.set(country, { priceCents: method.price, postalPrefixes: method.postalPrefixes })
      }
    }
  }

  return [...cheapest.entries()]
    .map(([country, entry]) => ({ country, ...entry }))
    .sort((a, b) => a.country.localeCompare(b.country))
}

export async function shippingMethodsFor(
  destination: { country: string; postalCode?: string },
  locale: LocaleCode
): Promise<ShippingMethod[]> {
  const country = destination.country.toUpperCase()
  const postal = (destination.postalCode ?? '').replace(/\s/g, '').toUpperCase()

  // Somewhere we do not sell to at all gets nothing — not even collection.
  // Store collection is offered everywhere else because it has no destination,
  // and that made it the one way an order from the Canaries could still be
  // placed after every delivery method had correctly refused.
  if (!isServableDestination(country, postal)) return []

  const documents = await cachedFetch<unknown[]>('shipping', SHIPPING_METHODS_QUERY, {}, 300_000)

  return documents
    .map((document) => parseShippingMethod(document, locale))
    .filter((method): method is ShippingMethod => method !== null)
    .filter((method) => {
      // Pickup has no destination — it happens at our own shop.
      if (method.code === 'pickup') return true
      if (method.countries.length > 0 && !method.countries.includes(country)) return false
      if (method.postalPrefixes.length === 0) return true
      // With no postal code yet we cannot rule it out; the checkout re-quotes
      // with the real one before anything is charged.
      if (!postal) return true
      return method.postalPrefixes.some((prefix) => postal.startsWith(prefix))
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** A promotion definition. Whether it may still be used is decided in Postgres. */
export async function getPromo(code: string): Promise<PromoDefinition | null> {
  const normalized = code.trim().toUpperCase()
  const document = await cachedFetch<unknown>(
    `promo:${normalized}`,
    PROMO_BY_CODE_QUERY,
    { code: normalized },
    30_000
  )
  return document ? parsePromo(document) : null
}

export type {
  Article,
  ArticleDetail,
  Brand,
  Category,
  FaqEntry,
  Paginated,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  PromoDefinition,
  ShippingMethod,
}
