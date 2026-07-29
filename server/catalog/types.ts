/**
 * The catalogue as the rest of the system sees it.
 *
 * These are not Sanity's shapes. Everything that leaves this layer has already
 * been validated, resolved into one language, and converted into cents — so no
 * caller ever has to think about a missing translation, a null price, or which
 * document store the data came from. Replacing Sanity later would change one
 * directory and nothing else.
 */
import type { Cents } from '../../shared/money'
import type { LocaleCode } from '../../shared/locales'

export type ProductType = 'bike' | 'spare_part' | 'accessory' | 'kids_car' | 'other'

export interface ProductImage {
  url: string
  alt: string
  width: number
  height: number
  /** Tiny inline preview so a card can paint before the image arrives. */
  lqip: string | null
}

export interface ProductSummary {
  id: string
  slug: string
  name: string
  /** null when the product has no photograph yet. */
  image: ProductImage | null
  price: Cents
  /** Only present when it is genuinely higher than `price`. */
  compareAtPrice: Cents | null
  productType: ProductType
  brand: { slug: string; name: string } | null
  category: { slug: string; name: string } | null
  color: string | null
  colorHex: string | null
  modelFamily: string | null
  isNew: boolean
  isFeatured: boolean
  /**
   * Sellable quantity, read from Postgres — never from the catalogue. The
   * document store cannot decrement anything atomically, so it does not get to
   * hold a number that decides whether a sale is possible.
   */
  available: number
}

export interface ProductSpecifications {
  motor: string | null
  battery: string | null
  tireSize: string | null
  range: string | null
  brakeType: string | null
  maxSpeed: number | null
  weight: number | null
  chargeTime: string | null
  maxLoad: number | null
  dimensions: string | null
  suspension: string | null
  frame: string | null
  gears: string | null
}

export interface ProductDetail extends ProductSummary {
  sku: string | null
  gtin: string | null
  shortDescription: string | null
  description: string | null
  warranty: string | null
  highlights: string[]
  specifications: ProductSpecifications
  images: ProductImage[]
  videoUrl: string | null
  seo: { title: string | null; description: string | null }
  /** Other colours of the same model. Empty when the product has no family. */
  siblings: ProductSummary[]
}

export interface Category {
  id: string
  slug: string
  name: string
  description: string | null
  image: ProductImage | null
}

export interface Brand {
  id: string
  slug: string
  name: string
  logo: ProductImage | null
}

export interface ShippingMethod {
  code: string
  name: string
  description: string | null
  price: Cents
  /** Free above this basket value, when set. */
  freeAbove: Cents | null
  estimatedDays: string | null
  countries: string[]
  /**
   * Postal prefixes this method serves. Empty means the whole country.
   * This is how own-fleet delivery is scoped to Poitiers and the Benelux.
   */
  postalPrefixes: string[]
  sortOrder: number
}

export interface PromoDefinition {
  code: string
  discountType: 'percentage' | 'fixed'
  /** Percent (1-100) for `percentage`, cents for `fixed`. */
  value: number
  minOrderValue: Cents | null
  maxUses: number | null
  validFrom: Date | null
  validUntil: Date | null
  isActive: boolean
}

export interface ProductQuery {
  locale: LocaleCode
  productType?: ProductType
  categorySlug?: string
  brandSlug?: string
  search?: string
  /** Hide anything with no sellable quantity. */
  inStockOnly?: boolean
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest'
  page?: number
  perPage?: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}
