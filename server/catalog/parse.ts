/**
 * The catalogue boundary.
 *
 * A document store enforces its schema in the editor, not in the data. A
 * product really can come back with a null price, a missing slug or a
 * translation nobody filled in — the previous build lost its entire sitemap to
 * exactly that, one article saved without a slug taking down every URL.
 *
 * So nothing is trusted here. Documents are parsed; anything that cannot become
 * a valid product is dropped with a warning rather than allowed to travel
 * onward as half an object. One bad row must never cost a page.
 */
import { z } from 'zod'
import { DEFAULT_LOCALE, type LocaleCode } from '../../shared/locales'
import { fromEuros, type Cents } from '../../shared/money'
import type {
  Brand,
  Category,
  ProductDetail,
  ProductImage,
  ProductSpecifications,
  ProductSummary,
  ProductType,
  PromoDefinition,
  ShippingMethod,
} from './types'

/** A field the editor translates. Any locale may be absent. */
const localized = z.record(z.string(), z.string().nullable().optional()).nullable().optional()
type Localized = z.infer<typeof localized>

const imageSchema = z
  .object({
    url: z.string().url(),
    alt: z.string().nullable().optional(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    lqip: z.string().nullable().optional(),
  })
  .nullable()
  .optional()

const PRODUCT_TYPES = ['bike', 'spare_part', 'accessory', 'kids_car', 'other'] as const

const rawProductSchema = z.object({
  _id: z.string().min(1),
  slug: z.string().min(1),
  name: localized,
  // Authored in euros. Converted to cents here and never seen as a float again.
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().nullable().optional(),
  productType: z.string().nullable().optional(),
  color: localized,
  colorHex: z.string().nullable().optional(),
  modelFamily: z.string().nullable().optional(),
  isNew: z.boolean().nullable().optional(),
  isFeatured: z.boolean().nullable().optional(),
  brand: z.object({ slug: z.string(), name: localized }).nullable().optional(),
  category: z.object({ slug: z.string(), name: localized }).nullable().optional(),
  image: imageSchema,
})

const rawProductDetailSchema = rawProductSchema.extend({
  sku: z.string().nullable().optional(),
  gtin: z.string().nullable().optional(),
  shortDescription: localized,
  description: localized,
  warranty: localized,
  highlights: z.array(localized).nullable().optional(),
  images: z.array(imageSchema).nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  seo: z.object({ title: localized, description: localized }).nullable().optional(),
  specifications: z
    .object({
      motor: z.string().nullable().optional(),
      battery: z.string().nullable().optional(),
      tireSize: z.string().nullable().optional(),
      range: localized,
      brakeType: localized,
      maxSpeed: z.number().nullable().optional(),
      weight: z.number().nullable().optional(),
      chargeTime: localized,
      maxLoad: z.number().nullable().optional(),
      dimensions: z.string().nullable().optional(),
      suspension: localized,
      frame: localized,
      gears: localized,
    })
    .nullable()
    .optional(),
})

/**
 * Resolve a translated field.
 *
 * Falls back to the default locale, then to any locale that has content: a
 * German visitor is better served a French product name than an empty heading.
 */
export function translate(field: Localized, locale: LocaleCode): string | null {
  if (!field) return null
  const requested = field[locale]
  if (requested && requested.trim()) return requested.trim()

  const fallback = field[DEFAULT_LOCALE]
  if (fallback && fallback.trim()) return fallback.trim()

  for (const value of Object.values(field)) {
    if (value && value.trim()) return value.trim()
  }
  return null
}

function toImage(raw: z.infer<typeof imageSchema>, fallbackAlt: string): ProductImage | null {
  if (!raw?.url) return null
  return {
    url: raw.url,
    alt: raw.alt?.trim() || fallbackAlt,
    width: raw.width ?? 1200,
    height: raw.height ?? 1200,
    lqip: raw.lqip ?? null,
  }
}

function toProductType(value: string | null | undefined): ProductType {
  return (PRODUCT_TYPES as readonly string[]).includes(value ?? '') ? (value as ProductType) : 'other'
}

/**
 * A strike-through price is only shown when it is genuinely higher. A
 * mis-keyed value must not advertise a discount that does not exist.
 */
function toCompareAtPrice(compareAt: number | null | undefined, price: Cents): Cents | null {
  if (compareAt == null) return null
  const asCents = fromEuros(compareAt)
  return asCents > price ? asCents : null
}

export interface ParseContext {
  locale: LocaleCode
  /** Sellable quantities from Postgres, keyed by product id. */
  availability: Map<string, number>
}

function warn(document: unknown, error: z.ZodError): void {
  const id = (document as { _id?: string })?._id ?? 'unknown'
  const problems = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  // Loud enough to fix, quiet enough not to take the page down with it.
  console.warn(`[catalog] dropping malformed document ${id} — ${problems}`)
}

export function parseProductSummary(document: unknown, context: ParseContext): ProductSummary | null {
  const parsed = rawProductSchema.safeParse(document)
  if (!parsed.success) {
    warn(document, parsed.error)
    return null
  }

  const raw = parsed.data
  const name = translate(raw.name, context.locale)
  // A product with no name in any language cannot be sold or listed.
  if (!name) {
    console.warn(`[catalog] dropping ${raw._id} — no name in any locale`)
    return null
  }

  const price = fromEuros(raw.price)
  const brandName = raw.brand ? translate(raw.brand.name, context.locale) : null
  const categoryName = raw.category ? translate(raw.category.name, context.locale) : null

  return {
    id: raw._id,
    slug: raw.slug,
    name,
    image: toImage(raw.image, name),
    price,
    compareAtPrice: toCompareAtPrice(raw.compareAtPrice, price),
    productType: toProductType(raw.productType),
    brand: raw.brand && brandName ? { slug: raw.brand.slug, name: brandName } : null,
    category: raw.category && categoryName ? { slug: raw.category.slug, name: categoryName } : null,
    color: translate(raw.color, context.locale),
    colorHex: raw.colorHex ?? null,
    modelFamily: raw.modelFamily ?? null,
    isNew: raw.isNew ?? false,
    isFeatured: raw.isFeatured ?? false,
    available: context.availability.get(raw._id) ?? 0,
  }
}

export function parseProductDetail(
  document: unknown,
  context: ParseContext,
  siblings: ProductSummary[]
): ProductDetail | null {
  const summary = parseProductSummary(document, context)
  if (!summary) return null

  const parsed = rawProductDetailSchema.safeParse(document)
  if (!parsed.success) {
    warn(document, parsed.error)
    return null
  }
  const raw = parsed.data
  const specs = raw.specifications

  const specifications: ProductSpecifications = {
    motor: specs?.motor ?? null,
    battery: specs?.battery ?? null,
    tireSize: specs?.tireSize ?? null,
    range: translate(specs?.range, context.locale),
    brakeType: translate(specs?.brakeType, context.locale),
    maxSpeed: specs?.maxSpeed ?? null,
    weight: specs?.weight ?? null,
    chargeTime: translate(specs?.chargeTime, context.locale),
    maxLoad: specs?.maxLoad ?? null,
    dimensions: specs?.dimensions ?? null,
    suspension: translate(specs?.suspension, context.locale),
    frame: translate(specs?.frame, context.locale),
    gears: translate(specs?.gears, context.locale),
  }

  return {
    ...summary,
    sku: raw.sku ?? null,
    gtin: raw.gtin ?? null,
    shortDescription: translate(raw.shortDescription, context.locale),
    description: translate(raw.description, context.locale),
    warranty: translate(raw.warranty, context.locale),
    highlights: (raw.highlights ?? [])
      .map((entry) => translate(entry, context.locale))
      .filter((entry): entry is string => Boolean(entry)),
    specifications,
    images: (raw.images ?? [])
      .map((image) => toImage(image, summary.name))
      .filter((image): image is ProductImage => image !== null),
    videoUrl: raw.videoUrl ?? null,
    seo: {
      title: translate(raw.seo?.title, context.locale),
      description: translate(raw.seo?.description, context.locale),
    },
    siblings,
  }
}

const rawCategorySchema = z.object({
  _id: z.string().min(1),
  slug: z.string().min(1),
  name: localized,
  description: localized,
  image: imageSchema,
})

export function parseCategory(document: unknown, locale: LocaleCode): Category | null {
  const parsed = rawCategorySchema.safeParse(document)
  if (!parsed.success) {
    warn(document, parsed.error)
    return null
  }
  const name = translate(parsed.data.name, locale)
  if (!name) return null
  return {
    id: parsed.data._id,
    slug: parsed.data.slug,
    name,
    description: translate(parsed.data.description, locale),
    image: toImage(parsed.data.image, name),
  }
}

const rawBrandSchema = z.object({
  _id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  logo: imageSchema,
})

export function parseBrand(document: unknown): Brand | null {
  const parsed = rawBrandSchema.safeParse(document)
  if (!parsed.success) {
    warn(document, parsed.error)
    return null
  }
  return {
    id: parsed.data._id,
    slug: parsed.data.slug,
    name: parsed.data.name,
    logo: toImage(parsed.data.logo, parsed.data.name),
  }
}

const rawShippingSchema = z.object({
  code: z.string().min(1),
  name: localized,
  description: localized,
  price: z.number().nonnegative(),
  freeAbove: z.number().nonnegative().nullable().optional(),
  estimatedDays: z.string().nullable().optional(),
  zones: z.array(z.string()).nullable().optional(),
  postalCodePrefixes: z.array(z.string()).nullable().optional(),
  sortOrder: z.number().nullable().optional(),
})

export function parseShippingMethod(document: unknown, locale: LocaleCode): ShippingMethod | null {
  const parsed = rawShippingSchema.safeParse(document)
  if (!parsed.success) {
    warn(document, parsed.error)
    return null
  }
  const raw = parsed.data
  const name = translate(raw.name, locale)
  if (!name) return null

  return {
    code: raw.code,
    name,
    description: translate(raw.description, locale),
    price: fromEuros(raw.price),
    freeAbove: raw.freeAbove == null ? null : fromEuros(raw.freeAbove),
    estimatedDays: raw.estimatedDays ?? null,
    countries: (raw.zones ?? []).map((zone) => zone.toUpperCase()),
    postalPrefixes: (raw.postalCodePrefixes ?? []).map((prefix) =>
      prefix.replace(/\s/g, '').toUpperCase()
    ),
    sortOrder: raw.sortOrder ?? 0,
  }
}

const rawPromoSchema = z.object({
  code: z.string().min(1),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().nonnegative().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
})

export function parsePromo(document: unknown): PromoDefinition | null {
  const parsed = rawPromoSchema.safeParse(document)
  if (!parsed.success) {
    warn(document, parsed.error)
    return null
  }
  const raw = parsed.data

  // A percentage above 100 would make the basket negative. The order total is
  // clamped anyway, but a nonsensical definition should never get that far.
  if (raw.discountType === 'percentage' && raw.discountValue > 100) {
    console.warn(`[catalog] promo ${raw.code} declares ${raw.discountValue}% — ignoring`)
    return null
  }

  return {
    code: raw.code.trim().toUpperCase(),
    discountType: raw.discountType,
    value: raw.discountType === 'fixed' ? fromEuros(raw.discountValue) : raw.discountValue,
    minOrderValue: raw.minOrderAmount == null ? null : fromEuros(raw.minOrderAmount),
    maxUses: raw.maxUses ?? null,
    validFrom: raw.validFrom ? new Date(raw.validFrom) : null,
    validUntil: raw.validUntil ? new Date(raw.validUntil) : null,
    isActive: raw.isActive ?? false,
  }
}
