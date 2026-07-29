/**
 * The Google Merchant Center feed.
 *
 * One generator, one feed per market. Two rules govern everything here, and both
 * are enforced by suspension rather than by a warning email:
 *
 *  - **The price in the feed must equal the price on the page Google crawls.**
 *    So a feed is built for a MARKET, quotes that market's price list, and links
 *    to that market's URL. The `/nl` feed quotes Dutch prices and links to
 *    `/nl/produits/…`, where a crawler finds the same figure. The price is
 *    computed by the same `priceInMarket` the product page uses, not by a second
 *    implementation that could drift.
 *  - **Never advertise delivery we would refuse at the till.** Shipping is read
 *    from the same `shippingMethod` documents the checkout uses, including their
 *    postal-code scoping — free delivery in France is department 86 only, and
 *    claiming it nationwide is Misrepresentation.
 *
 * Availability comes from Postgres, because that is where stock lives. A feed
 * that says `in_stock` for something the checkout will refuse wastes the click
 * and earns a disapproval.
 */
import { createError, setResponseHeader, type H3Event } from 'h3'
import { sanity } from '../catalog/client'
import { FEED_PRODUCTS_QUERY, SELLING_TERMS_QUERY } from '../catalog/queries'
import { priceInMarket, parseMarketRules, translate } from '../catalog/parse'
import { MARKET_PRICING_QUERY } from '../catalog/queries'
import { db } from '../db/client'
import { readAvailability } from '../services/stock'
import { toDecimalString, fromEuros, add, type Cents } from '../../shared/money'
import { localizedUrl, type LocaleCode } from '../../shared/locales'
import { marketForLocale } from '../../shared/markets'

export type FeedLocale = Extract<LocaleCode, 'fr' | 'nl' | 'de' | 'es' | 'en'>

export const FEED_LOCALES: readonly FeedLocale[] = ['fr', 'nl', 'de', 'es'] as const

const PRODUCT_TYPE_LABELS: Record<FeedLocale, Record<string, string>> = {
  fr: { bike: 'Vélos électriques', spare_part: 'Pièces détachées', accessory: 'Accessoires', kids_car: 'Véhicules enfants', other: 'Autres' },
  nl: { bike: 'Elektrische fietsen', spare_part: 'Onderdelen', accessory: 'Accessoires', kids_car: 'Kindervoertuigen', other: 'Overig' },
  de: { bike: 'E-Bikes', spare_part: 'Ersatzteile', accessory: 'Zubehör', kids_car: 'Kinderfahrzeuge', other: 'Sonstiges' },
  es: { bike: 'Bicicletas eléctricas', spare_part: 'Piezas de repuesto', accessory: 'Accesorios', kids_car: 'Vehículos infantiles', other: 'Otros' },
  en: { bike: 'Electric bikes', spare_part: 'Spare parts', accessory: 'Accessories', kids_car: 'Kids vehicles', other: 'Other' },
}

/**
 * Google's own taxonomy.
 *
 * Merchant Center infers a category when this is absent, and it infers badly for
 * fatbikes — landing them under generic bicycles beside children's toys. Stating
 * it puts the offer in the auction it belongs to.
 */
const GOOGLE_CATEGORY: Record<string, string> = {
  bike: 'Sporting Goods > Outdoor Recreation > Cycling > Bicycles',
  spare_part: 'Sporting Goods > Outdoor Recreation > Cycling > Bicycle Parts',
  accessory: 'Sporting Goods > Outdoor Recreation > Cycling > Bicycle Accessories',
  kids_car: 'Toys & Games > Toys > Riding Toys',
  other: 'Sporting Goods > Outdoor Recreation > Cycling',
}

/** Suffix that tells a shopper which of the two offers they are looking at. */
const ASSEMBLED_LABEL: Record<FeedLocale, string> = {
  fr: 'Livrée montée',
  nl: 'Rijklaar geleverd',
  de: 'Montiert geliefert',
  es: 'Entregada montada',
  en: 'Delivered assembled',
}

const CHANNEL_DESC: Record<FeedLocale, string> = {
  fr: 'Vélos électriques, pièces et accessoires — Vitesse Eco, Poitiers',
  nl: 'Elektrische fietsen, onderdelen en accessoires — Vitesse Eco, Poitiers (FR)',
  de: 'E-Bikes, Ersatzteile und Zubehör — Vitesse Eco, Poitiers (FR)',
  es: 'Bicicletas eléctricas, piezas y accesorios — Vitesse Eco, Poitiers (FR)',
  en: 'Electric bikes, parts and accessories — Vitesse Eco, Poitiers (FR)',
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface Localized {
  [locale: string]: string | null | undefined
}

interface FeedProduct {
  _id: string
  slug: string | null
  name: Localized | null
  shortDescription: Localized | null
  description: Localized | null
  price: number | null
  compareAtPrice: number | null
  pricesByCountry: Array<{ country: string; price: number; compareAtPrice?: number | null }> | null
  productType: string | null
  color: Localized | null
  modelFamily: string | null
  sku: string | null
  gtin: string | null
  gtinAssembled: string | null
  manufacturerMpn: string | null
  brand: { slug: string; name: Localized | string | null } | null
  images: Array<{ url: string | null } | null> | null
}

interface SellingTerms {
  assembly: { isOffered: boolean | null; feeEuros: number | null } | null
  shipping: Array<{
    code: string
    zones: string[] | null
    postalCodePrefixes: string[] | null
    price: number | null
    freeAbove: number | null
  }> | null
}

interface ShippingRule {
  country: string
  price: number
  postalPrefixes: string[]
}

/**
 * Delivery we would actually perform, derived from the live shipping table.
 *
 * Pickup is excluded on purpose: collection at our own shop is not delivery, and
 * offering it as a shipping rate advertises nationwide service we do not run.
 */
function deliverableShipping(terms: SellingTerms): ShippingRule[] {
  const rules: ShippingRule[] = []
  for (const method of terms.shipping ?? []) {
    for (const country of method.zones ?? []) {
      rules.push({
        country: country.toUpperCase(),
        price: method.price ?? 0,
        postalPrefixes: (method.postalCodePrefixes ?? []).map((p) => p.replace(/\s/g, '').toUpperCase()),
      })
    }
  }
  return rules
}

/**
 * Product identifiers, which are ADDITIVE rather than alternatives.
 *
 * Google reads `identifier_exists: no` as "no GTIN, no MPN and no brand" — it is
 * meant for handmade goods, art and pre-1970 books. Emitting it beside a brand
 * is a contradiction on every line, and on models where other merchants publish
 * a barcode it turns a warning into a disapproval.
 *
 * The MPN is the MANUFACTURER's part number. Our own SKU is a code we invented,
 * and Google's spec is explicit that only a manufacturer may assign one, so the
 * SKU is never sent here.
 */
function identifiers(product: {
  gtin: string | null
  manufacturerMpn: string | null
  brand: string | null
}): string {
  const parts: string[] = []
  if (product.gtin) parts.push(`\n    <g:gtin>${esc(product.gtin)}</g:gtin>`)
  if (product.manufacturerMpn) parts.push(`\n    <g:mpn>${esc(product.manufacturerMpn)}</g:mpn>`)
  if (product.brand) parts.push(`\n    <g:brand>${esc(product.brand)}</g:brand>`)

  // Only a genuinely unidentifiable product may say so.
  if (parts.length === 0) return `\n    <g:identifier_exists>no</g:identifier_exists>`
  return parts.join('')
}

function brandName(product: FeedProduct, locale: FeedLocale): string | null {
  const raw = product.brand?.name
  if (!raw) return null
  if (typeof raw === 'string') return raw
  return translate(raw, locale)
}

export interface FeedStats {
  offers: number
  products: number
  withGtin: number
  withMpn: number
  unidentified: number
  countriesServed: string[]
}

export interface BuiltFeed {
  xml: string
  stats: FeedStats
}

export async function buildMerchantFeed(locale: FeedLocale): Promise<BuiltFeed> {
  const client = sanity()

  const [products, terms, ruleDocuments] = await Promise.all([
    client.fetch<FeedProduct[]>(FEED_PRODUCTS_QUERY),
    client.fetch<SellingTerms>(SELLING_TERMS_QUERY),
    client.fetch<unknown>(MARKET_PRICING_QUERY),
  ])

  // The market whose prices this feed quotes, and whose URLs it links to. They
  // must be the same market, or Google compares two different numbers.
  const market = marketForLocale(locale)
  const priceRule = parseMarketRules(ruleDocuments).get(market.country) ?? null

  const availability = await readAvailability(db(), products.map((p) => p._id))
  const shippingRules = deliverableShipping(terms)
  const typeLabels = PRODUCT_TYPE_LABELS[locale]

  /**
   * Assembly is a SECOND offer with its own barcode and its own price — the
   * distributor numbers it separately for exactly that reason. It is emitted
   * only when the shop genuinely offers it, because a listing the checkout
   * cannot fulfil is the misrepresentation that suspends an account.
   */
  const assemblyOffered = terms.assembly?.isOffered === true && (terms.assembly.feeEuros ?? 0) >= 0
  const assemblyFee = fromEuros(terms.assembly?.feeEuros ?? 0)

  const shippingXml = shippingRules
    .map(
      (rule) =>
        `\n    <g:shipping>\n      <g:country>${rule.country}</g:country>` +
        rule.postalPrefixes.map((prefix) => `\n      <g:postal_code>${esc(prefix)}*</g:postal_code>`).join('') +
        `\n      <g:price>${rule.price.toFixed(2)} EUR</g:price>\n    </g:shipping>`
    )
    .join('')

  const stats: FeedStats = {
    offers: 0,
    products: 0,
    withGtin: 0,
    withMpn: 0,
    unidentified: 0,
    countriesServed: [...new Set(shippingRules.map((rule) => rule.country))].sort(),
  }

  const items = products
    .flatMap((product) => {
      const name = translate(product.name, locale)
      const image = (product.images ?? []).find((entry) => entry?.url)?.url ?? null

      // A product with no name, no slug, no image or no price cannot be listed;
      // sending it anyway earns a disapproval that counts against the account.
      if (!product.slug || !name || !image || product.price == null || product.price <= 0) return []

      stats.products += 1

      const { price, compareAtPrice } = priceInMarket(
        { price: product.price, compareAtPrice: product.compareAtPrice, pricesByCountry: product.pricesByCountry },
        market,
        priceRule
      )

      const id = product.sku || product.slug
      const available = availability.get(product._id)?.available ?? 0
      const brand = brandName(product, locale)
      const colour = translate(product.color, locale)
      const googleCategory = GOOGLE_CATEGORY[product.productType ?? 'other'] ?? GOOGLE_CATEGORY.other
      const productType = typeLabels[product.productType ?? ''] ?? ''

      // Shopping matches a query against the description, so one line repeated
      // across six colours describes none of them. Built from this product's own
      // attributes, it says what this offer actually is.
      const body = translate(product.shortDescription, locale) ?? translate(product.description, locale) ?? ''
      const description = [body.trim(), colour ? `${colour}.` : ''].filter(Boolean).join(' ').slice(0, 5000) || name

      const extraImages = (product.images ?? [])
        .slice(1, 11)
        .map((entry) => entry?.url)
        .filter((url): url is string => Boolean(url))
        .map((url) => `\n    <g:additional_image_link>${esc(url)}</g:additional_image_link>`)
        .join('')

      // Merchant Center rejects a sale price that is not below the list price,
      // so the pair is only emitted when the discount is genuine.
      const onSale = compareAtPrice !== null && compareAtPrice > price
      const listPrice = onSale ? compareAtPrice : price
      const salePrice = onSale ? price : null

      if (product.gtin) stats.withGtin += 1
      if (product.manufacturerMpn) stats.withMpn += 1
      if (!product.gtin && !product.manufacturerMpn && !brand) stats.unidentified += 1

      const offer = (variant: {
        idSuffix: string
        titleSuffix: string
        gtin: string | null
        listPrice: Cents
        salePrice: Cents | null
      }): string => {
        stats.offers += 1
        return `  <item>
    <g:id>${esc(id)}${variant.idSuffix}</g:id>
    <g:title>${esc(name)}${variant.titleSuffix}</g:title>
    <g:description>${esc(description)}</g:description>
    <g:link>${esc(localizedUrl(`/produits/${product.slug}`, locale))}</g:link>
    <g:image_link>${esc(image)}</g:image_link>${extraImages}
    <g:availability>${available > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
    <g:price>${toDecimalString(variant.listPrice)} EUR</g:price>${
      variant.salePrice !== null ? `\n    <g:sale_price>${toDecimalString(variant.salePrice)} EUR</g:sale_price>` : ''
    }
    <g:condition>new</g:condition>${identifiers({ gtin: variant.gtin, manufacturerMpn: product.manufacturerMpn, brand })}${
      colour ? `\n    <g:color>${esc(colour)}</g:color>` : ''
    }${product.modelFamily ? `\n    <g:item_group_id>${esc(product.modelFamily)}</g:item_group_id>` : ''}
    <g:google_product_category>${esc(googleCategory)}</g:google_product_category>${
      productType ? `\n    <g:product_type>${esc(productType)}</g:product_type>` : ''
    }${shippingXml}
  </item>`
      }

      const offers = [
        offer({ idSuffix: '', titleSuffix: '', gtin: product.gtin, listPrice, salePrice }),
      ]

      // Only when the shop can actually deliver it ready to ride, AND the
      // distributor gave that configuration its own barcode.
      if (assemblyOffered && product.gtinAssembled) {
        offers.push(
          offer({
            idSuffix: '-MONTE',
            titleSuffix: ` — ${ASSEMBLED_LABEL[locale]}`,
            gtin: product.gtinAssembled,
            listPrice: add(listPrice, assemblyFee),
            salePrice: salePrice === null ? null : add(salePrice, assemblyFee),
          })
        )
      }

      return offers
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Vitesse Eco</title>
  <link>${esc(localizedUrl('/', locale))}</link>
  <description>${esc(CHANNEL_DESC[locale])}</description>
${items}
</channel>
</rss>`

  return { xml, stats }
}

/**
 * A feed is only safe to publish if it is plausibly complete.
 *
 * This is the failure mode that costs the most and announces itself the least:
 * if the catalogue read returns an empty list — a revoked token, a renamed
 * dataset, a transient upstream error that resolves to `[]` rather than
 * throwing — the builder above happily produces *valid XML containing no
 * products*. Merchant Center reads that as the merchant having withdrawn their
 * entire catalogue and delists everything, and getting back in takes days.
 *
 * So an empty or implausibly small feed is refused. Google treats 503 as
 * "try again later" and keeps serving the last good feed, which is exactly the
 * behaviour wanted while something is broken.
 */
const MINIMUM_PLAUSIBLE_OFFERS = 5

export async function serveMerchantFeed(
  event: H3Event,
  locale: FeedLocale
): Promise<string> {
  let built: BuiltFeed
  try {
    built = await buildMerchantFeed(locale)
  } catch (error) {
    // Never let an upstream 401 or 500 reach Google as-is: an auth error on our
    // side is not a statement about the feed's validity.
    console.error(`[feed:${locale}] build failed`, error)
    throw createError({
      statusCode: 503,
      statusMessage: 'FEED_TEMPORARILY_UNAVAILABLE',
    })
  }

  if (built.stats.offers < MINIMUM_PLAUSIBLE_OFFERS) {
    console.error(
      `[feed:${locale}] refusing to publish ${built.stats.offers} offer(s) — ` +
        'the catalogue read looks broken, and an empty feed delists everything'
    )
    throw createError({ statusCode: 503, statusMessage: 'FEED_INCOMPLETE' })
  }

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  // Merchant fetches on a schedule measured in hours, so an hour of cache costs
  // nothing and spares the catalogue 147 reads per crawl.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  console.info(`[feed:${locale}] ${built.stats.offers} offers, ${built.stats.withGtin} with EAN`)
  return built.xml
}
