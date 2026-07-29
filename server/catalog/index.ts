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
import type { LocaleCode } from '../../shared/locales'
import { cachedFetch } from './client'
import {
  parseBrand,
  parseCategory,
  parseProductDetail,
  parseProductSummary,
  parsePromo,
  parseShippingMethod,
} from './parse'
import {
  BRANDS_QUERY,
  CATEGORIES_QUERY,
  PRODUCT_BY_SLUG_QUERY,
  PROMO_BY_CODE_QUERY,
  SHIPPING_METHODS_QUERY,
  SIBLINGS_QUERY,
  SORT_ORDERS,
  buildListQuery,
} from './queries'
import type {
  Brand,
  Category,
  Paginated,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  PromoDefinition,
  ShippingMethod,
} from './types'

const MAX_PER_PAGE = 48

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
  const availability = await availabilityFor(ids)

  let items = documents
    .map((document) => parseProductSummary(document, { locale: query.locale, availability }))
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

export async function getProduct(slug: string, locale: LocaleCode): Promise<ProductDetail> {
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
  const availability = await availabilityFor(ids)

  const siblings = siblingDocuments
    .map((entry) => parseProductSummary(entry, { locale, availability }))
    .filter((entry): entry is ProductSummary => entry !== null)

  const product = parseProductDetail(document, { locale, availability }, siblings)
  if (!product) {
    throw new AppError(ERROR_CODES.NOT_FOUND, {
      internal: `product "${slug}" exists but could not be parsed`,
    })
  }
  return product
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
export async function shippingMethodsFor(
  destination: { country: string; postalCode?: string },
  locale: LocaleCode
): Promise<ShippingMethod[]> {
  const documents = await cachedFetch<unknown[]>('shipping', SHIPPING_METHODS_QUERY, {}, 300_000)
  const country = destination.country.toUpperCase()
  const postal = (destination.postalCode ?? '').replace(/\s/g, '').toUpperCase()

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
  Brand,
  Category,
  Paginated,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  PromoDefinition,
  ShippingMethod,
}
