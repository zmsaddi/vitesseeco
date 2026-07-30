/**
 * GROQ projections.
 *
 * Kept apart from the service so the shape a query returns and the shape the
 * parser expects can be read side by side. Every projection is explicit — never
 * `...` — so a field added in the Studio cannot silently start travelling to
 * the browser, and a field removed shows up as a parse warning rather than as
 * `undefined` three layers away.
 *
 * `stock` is deliberately absent from every projection here. Sellable quantity
 * comes from Postgres; the catalogue does not get to answer that question.
 */

/** Only published, purchasable products. Drafts are never for sale. */
export const AVAILABLE = `_type == "product" && isAvailable == true && defined(slug.current)`

const IMAGE = `{
  "url": asset->url,
  "alt": coalesce(altText, ""),
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height,
  "lqip": asset->metadata.lqip
}`

/**
 * Per-market overrides. Projected on both product shapes because the price on a
 * listing card and the price on the product page must come from the same field
 * — a customer who sees one figure in a grid and another after clicking has
 * been misled, whichever one is charged.
 */
const PRICES_BY_COUNTRY = `pricesByCountry[]{ country, price, compareAtPrice }`

export const PRODUCT_SUMMARY = `{
  _id,
  "slug": slug.current,
  name,
  price,
  compareAtPrice,
  "pricesByCountry": ${PRICES_BY_COUNTRY},
  productType,
  color,
  colorHex,
  modelFamily,
  isNew,
  isFeatured,
  "brand": brand->{ "slug": slug.current, name },
  "category": category->{ "slug": slug.current, name },
  "image": images[0] ${IMAGE}
}`

export const PRODUCT_DETAIL = `{
  _id,
  "slug": slug.current,
  name,
  price,
  compareAtPrice,
  "pricesByCountry": ${PRICES_BY_COUNTRY},
  productType,
  color,
  colorHex,
  modelFamily,
  isNew,
  isFeatured,
  sku,
  gtin,
  gtinAssembled,
  manufacturerMpn,
  shortDescription,
  description,
  warranty,
  highlights,
  videoUrl,
  specifications,
  seo,
  "brand": brand->{ "slug": slug.current, name },
  "category": category->{ "slug": slug.current, name },
  "image": images[0] ${IMAGE},
  "images": images[] ${IMAGE}
}`

export const CATEGORY = `{
  _id,
  "slug": slug.current,
  name,
  description,
  "image": image ${IMAGE}
}`

export const BRAND = `{
  _id,
  "slug": slug.current,
  name,
  "logo": logo ${IMAGE}
}`

export const SHIPPING_METHOD = `{
  code,
  name,
  description,
  price,
  freeAbove,
  estimatedDays,
  zones,
  postalCodePrefixes,
  sortOrder
}`

/**
 * Everything a Merchant Center feed needs, in one pass.
 *
 * Separate from the page projections because a feed reads all 147 products at
 * once and needs the identifiers, while a listing card needs none of them.
 */
export const FEED_PRODUCT = `{
  _id,
  "slug": slug.current,
  name,
  shortDescription,
  description,
  price,
  compareAtPrice,
  "pricesByCountry": pricesByCountry[]{ country, price, compareAtPrice },
  productType,
  color,
  modelFamily,
  sku,
  gtin,
  gtinAssembled,
  manufacturerMpn,
  "brand": brand->{ "slug": slug.current, name },
  "category": category->{ "slug": slug.current, name },
  "images": images[] ${IMAGE}
}`

export const FEED_PRODUCTS_QUERY = `
  *[${AVAILABLE}] | order(coalesce(sortOrder, 0) asc) ${FEED_PRODUCT}
`

/**
 * The assembly service and the shipping table, which together decide what a
 * feed is allowed to advertise. Read as one document so a feed build cannot see
 * half of it.
 */
export const SELLING_TERMS_QUERY = `{
  "assembly": *[_type == "siteSettings"][0].assembly{ isOffered, feeEuros, label },
  "shipping": *[_type == "shippingMethod" && isActive == true && code != "pickup"]{
    code, zones, postalCodePrefixes, price, freeAbove
  }
}`

/**
 * Editorial content: articles and FAQ entries.
 *
 * Both were in the Studio and queried by nothing, so seven blog posts and
 * twenty-two answers existed in the dataset and on no page.
 */
export const ARTICLE_SUMMARY = `{
  _id,
  "slug": slug.current,
  title,
  excerpt,
  publishedAt,
  author,
  "image": featuredImage ${IMAGE},
  _updatedAt
}`

export const ARTICLE_DETAIL = `{
  _id,
  "slug": slug.current,
  title,
  excerpt,
  content,
  publishedAt,
  author,
  "image": featuredImage ${IMAGE},
  seo,
  "relatedProducts": relatedProducts[]-> ${PRODUCT_SUMMARY},
  _updatedAt
}`

/** Published, and not post-dated: a scheduled article is not live yet. */
const ARTICLE_LIVE = `_type == "article" && isPublished == true && defined(slug.current) && publishedAt <= now()`

export const ARTICLES_QUERY = `
  *[${ARTICLE_LIVE}] | order(publishedAt desc) [0...50] ${ARTICLE_SUMMARY}
`

export const ARTICLE_BY_SLUG_QUERY = `
  *[${ARTICLE_LIVE} && slug.current == $slug][0] ${ARTICLE_DETAIL}
`

export const ARTICLE_SLUGS_QUERY = `
  *[${ARTICLE_LIVE}] | order(publishedAt desc) { "slug": slug.current, _updatedAt }
`

export const FAQ_QUERY = `
  *[_type == "faq" && isPublished == true] | order(coalesce(sortOrder, 0) asc) {
    _id, question, answer, category
  }
`

export const PROMO = `{
  code,
  discountType,
  discountValue,
  minOrderAmount,
  maxUses,
  validFrom,
  validUntil,
  isActive
}`

/**
 * Other colours of the same model.
 *
 * `defined(modelFamily)` is load-bearing: GROQ treats `null == null` as true,
 * so without it every product with no family would list every other
 * family-less product as one of its colours.
 */
export const SIBLINGS_QUERY = `
  *[${AVAILABLE}
    && defined(modelFamily)
    && modelFamily == $modelFamily
    && slug.current != $slug
  ] | order(coalesce(sortOrder, 0) asc) ${PRODUCT_SUMMARY}
`

export const PRODUCT_BY_SLUG_QUERY = `
  *[${AVAILABLE} && slug.current == $slug][0] ${PRODUCT_DETAIL}
`

/** Exactly the products a basket refers to, in one round trip. */
export const PRODUCTS_BY_IDS_QUERY = `
  *[${AVAILABLE} && _id in $ids] ${PRODUCT_SUMMARY}
`

/**
 * Every sellable slug, for the sitemap.
 *
 * Deliberately not the listing query: that one paginates, and a sitemap that
 * submits the first page only leaves the rest of the catalogue invisible to
 * Google. Two fields per row, so asking for all of them costs almost nothing.
 */
export const ALL_PRODUCT_SLUGS_QUERY = `
  *[${AVAILABLE}] | order(coalesce(sortOrder, 0) asc) { "slug": slug.current, _updatedAt }
`

export const CATEGORIES_QUERY = `
  *[_type == "category" && defined(slug.current)] | order(coalesce(sortOrder, 0) asc) ${CATEGORY}
`

export const BRANDS_QUERY = `
  *[_type == "brand" && defined(slug.current)] | order(name asc) ${BRAND}
`

export const SHIPPING_METHODS_QUERY = `
  *[_type == "shippingMethod" && isActive == true] | order(coalesce(sortOrder, 0) asc) ${SHIPPING_METHOD}
`

export const PROMO_BY_CODE_QUERY = `
  *[_type == "promoCode" && upper(code) == $code][0] ${PROMO}
`

/**
 * The catalogue-wide price adjustment per market.
 *
 * One document, read once and cached for as long as the shipping table, because
 * it changes about as often — and a missing document simply means every market
 * sells at the base price.
 */
export const MARKET_PRICING_QUERY = `
  *[_type == "siteSettings"][0].marketPricing[]{ country, adjustmentPercent, rounding }
`

export interface ListFilters {
  productType?: string
  categorySlug?: string
  brandSlug?: string
  search?: string
}

/**
 * Build the filtered listing query.
 *
 * Every value is bound as a parameter — user input is never concatenated into
 * GROQ, so a search term cannot alter the query it appears in.
 */
export function buildListQuery(filters: ListFilters, order: string): {
  query: string
  countQuery: string
} {
  const clauses = [AVAILABLE]

  if (filters.productType) clauses.push('productType == $productType')
  if (filters.categorySlug) clauses.push('category->slug.current == $categorySlug')
  if (filters.brandSlug) clauses.push('brand->slug.current == $brandSlug')
  if (filters.search) {
    // Match the name in any language, plus SKU, so a customer reading a label
    // off the frame finds the product.
    clauses.push(
      '(name.fr match $search || name.en match $search || name.nl match $search || ' +
        'name.de match $search || name.es match $search || sku match $search)'
    )
  }

  const filter = clauses.join(' && ')
  return {
    query: `*[${filter}] | order(${order}) [$offset...$end] ${PRODUCT_SUMMARY}`,
    countQuery: `count(*[${filter}])`,
  }
}

export const SORT_ORDERS: Record<string, string> = {
  relevance: 'coalesce(sortOrder, 0) asc, name.fr asc',
  price_asc: 'price asc',
  price_desc: 'price desc',
  newest: '_createdAt desc',
}
