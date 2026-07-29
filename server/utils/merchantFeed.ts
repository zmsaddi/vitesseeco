/**
 * Shared Google Merchant feed builder (U-K1) — one generator, one feed per
 * language. Titles/descriptions localized with FR fallback; product links
 * carry the locale prefix so Merchant sends shoppers to the right language.
 *
 * Country targeting happens in Merchant Center when registering each feed:
 *   fr feed → FR + BE(fr-BE) + LU · nl feed → NL + BE(nl-BE)
 *   de feed → DE · es feed → ES
 */
import { createClient } from '@sanity/client'

const SITE = 'https://vitesse-eco.fr'

export type FeedLocale = 'fr' | 'nl' | 'de' | 'es' | 'en'

const PREFIX: Record<FeedLocale, string> = { fr: '', nl: '/nl', de: '/de', es: '/es', en: '/en' }

const PRODUCT_TYPE_LABELS: Record<FeedLocale, Record<string, string>> = {
  fr: { bike: 'Vélos électriques', spare_part: 'Pièces détachées', accessory: 'Accessoires', kids_car: 'Véhicules enfants', other: 'Autres' },
  nl: { bike: 'Elektrische fietsen', spare_part: 'Onderdelen', accessory: 'Accessoires', kids_car: 'Kindervoertuigen', other: 'Overig' },
  de: { bike: 'E-Bikes', spare_part: 'Ersatzteile', accessory: 'Zubehör', kids_car: 'Kinderfahrzeuge', other: 'Sonstiges' },
  es: { bike: 'Bicicletas eléctricas', spare_part: 'Piezas de repuesto', accessory: 'Accesorios', kids_car: 'Vehículos infantiles', other: 'Otros' },
  en: { bike: 'Electric bikes', spare_part: 'Spare parts', accessory: 'Accessories', kids_car: 'Kids vehicles', other: 'Other' },
}

/**
 * Google's own product taxonomy.
 *
 * Merchant Center infers a category when this is absent, and it infers badly
 * for fatbikes — landing them under generic "Bicycles" alongside children's
 * toys. Stating it puts the offer in the auction it belongs to.
 */
const GOOGLE_CATEGORY: Record<string, string> = {
  bike: 'Sporting Goods > Outdoor Recreation > Cycling > Bicycles',
  spare_part: 'Sporting Goods > Outdoor Recreation > Cycling > Bicycle Parts',
  accessory: 'Sporting Goods > Outdoor Recreation > Cycling > Bicycle Accessories',
  kids_car: 'Toys & Games > Toys > Riding Toys',
  other: 'Sporting Goods > Outdoor Recreation > Cycling',
}

/**
 * Delivery we actually offer, per feed.
 *
 * Shopping shows a shipping figure whether or not we supply one — omitting it
 * lets Google estimate, and an estimate that is higher than our real price
 * makes the offer look worse than it is. Free own-fleet delivery is a genuine
 * advantage and belongs in the ad.
 */
const SHIPPING: Record<FeedLocale, Array<{ country: string; price: string; service?: string }>> = {
  fr: [{ country: 'FR', price: '0.00 EUR', service: 'Livraison Vitesse Eco' }],
  nl: [{ country: 'NL', price: '0.00 EUR', service: 'Bezorging Vitesse Eco' }],
  de: [{ country: 'DE', price: '0.00 EUR', service: 'Lieferung Vitesse Eco' }],
  es: [{ country: 'ES', price: '0.00 EUR', service: 'Entrega Vitesse Eco' }],
  en: [{ country: 'FR', price: '0.00 EUR', service: 'Vitesse Eco delivery' }],
}

const CHANNEL_DESC: Record<FeedLocale, string> = {
  fr: 'Vélos électriques, pièces et accessoires — Vitesse Eco, Poitiers',
  nl: 'Elektrische fietsen, onderdelen en accessoires — Vitesse Eco, Poitiers (FR)',
  de: 'E-Bikes, Ersatzteile und Zubehör — Vitesse Eco, Poitiers (FR)',
  es: 'Bicicletas eléctricas, piezas y accesorios — Vitesse Eco, Poitiers (FR)',
  en: 'Electric bikes, parts and accessories — Vitesse Eco, Poitiers (FR)',
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function buildMerchantFeed(locale: FeedLocale): Promise<string> {
  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  interface FeedProduct {
    sku: string | null
    gtin: string | null
    slug: string | null
    name: string | null
    description: string | null
    price: number | null
    compareAtPrice: number | null
    stock: number | null
    productType: string | null
    brand: string | null
    color: string | null
    modelFamily: string | null
    image: string | null
    images: string[] | null
    motor: string | null
    battery: string | null
    range: string | null
    weight: number | null
  }

  const products = await client.fetch<FeedProduct[]>(
    `*[_type == "product" && isAvailable == true && defined(slug.current) && defined(price) && price > 0]{
      sku,
      gtin,
      "slug": slug.current,
      "name": coalesce(name[$locale], name.fr),
      "description": coalesce(shortDescription[$locale], shortDescription.fr, description[$locale], description.fr),
      price,
      compareAtPrice,
      stock,
      productType,
      "brand": coalesce(brand->name[$locale], brand->name.fr, brand->name),
      "color": coalesce(color[$locale], color.fr),
      modelFamily,
      "image": images[0].asset->url,
      "images": images[1..9].asset->url,
      "motor": specifications.motor,
      "battery": specifications.battery,
      "range": coalesce(specifications.range[$locale], specifications.range.fr),
      "weight": specifications.weight
    }`,
    { locale }
  )

  const prefix = PREFIX[locale]
  const typeLabels = PRODUCT_TYPE_LABELS[locale]

  const items = products
    .filter((p) => p.slug && p.name && p.image)
    .map((p) => {
      const id = p.sku || p.slug
      const availability = (p.stock ?? 0) > 0 ? 'in_stock' : 'out_of_stock'
      const productType = typeLabels[p.productType ?? ''] ?? ''
      const googleCategory = GOOGLE_CATEGORY[p.productType ?? 'other'] ?? GOOGLE_CATEGORY.other

      // Shopping matches a query against the description, so a line repeated
      // across six colours describes none of them. Built from the product's own
      // attributes, it says what this offer actually is.
      const specs = [p.motor, p.battery, p.range].filter(Boolean).join(' · ')
      const description = [
        p.description?.trim(),
        specs,
        p.color ? `${p.color}.` : '',
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 5000) || String(p.name)

      // A strike-through price is only honest when it is genuinely higher, and
      // Merchant Center rejects a sale price that is not below the list price.
      const onSale = p.compareAtPrice != null && p.compareAtPrice > (p.price as number)
      const listPrice = onSale ? (p.compareAtPrice as number) : (p.price as number)
      const salePrice = onSale ? (p.price as number) : null

      const extraImages = (p.images ?? [])
        .filter(Boolean)
        .slice(0, 10)
        .map((url) => `\n    <g:additional_image_link>${esc(url)}</g:additional_image_link>`)
        .join('')

      const shipping = (SHIPPING[locale] ?? [])
        .map(
          (entry) =>
            `\n    <g:shipping>\n      <g:country>${entry.country}</g:country>` +
            (entry.service ? `\n      <g:service>${esc(entry.service)}</g:service>` : '') +
            `\n      <g:price>${entry.price}</g:price>\n    </g:shipping>`
        )
        .join('')

      return `  <item>
    <g:id>${esc(id)}</g:id>
    <g:title>${esc(p.name)}</g:title>
    <g:description>${esc(description)}</g:description>
    <g:link>${SITE}${prefix}/produits/${esc(p.slug)}</g:link>
    <g:image_link>${esc(p.image)}</g:image_link>${extraImages}
    <g:availability>${availability}</g:availability>
    <g:price>${listPrice.toFixed(2)} EUR</g:price>${salePrice !== null ? `
    <g:sale_price>${salePrice.toFixed(2)} EUR</g:sale_price>` : ''}
    <g:condition>new</g:condition>${p.gtin ? `
    <g:gtin>${esc(p.gtin)}</g:gtin>` : p.sku ? `
    <g:mpn>${esc(p.sku)}</g:mpn>` : `
    <g:identifier_exists>no</g:identifier_exists>`}${p.brand ? `
    <g:brand>${esc(p.brand)}</g:brand>` : ''}${p.color ? `
    <g:color>${esc(p.color)}</g:color>` : ''}${p.modelFamily ? `
    <g:item_group_id>${esc(p.modelFamily)}</g:item_group_id>` : ''}
    <g:google_product_category>${esc(googleCategory)}</g:google_product_category>${productType ? `
    <g:product_type>${esc(productType)}</g:product_type>` : ''}${p.weight ? `
    <g:shipping_weight>${p.weight} kg</g:shipping_weight>` : ''}${shipping}
  </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Vitesse Eco</title>
  <link>${SITE}${prefix}</link>
  <description>${esc(CHANNEL_DESC[locale])}</description>
${items}
</channel>
</rss>`
}
