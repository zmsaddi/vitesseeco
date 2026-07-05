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
    stock: number | null
    productType: string | null
    brand: string | null
    color: string | null
    modelFamily: string | null
    image: string | null
  }

  const products = await client.fetch<FeedProduct[]>(
    `*[_type == "product" && isAvailable == true && defined(slug.current) && defined(price) && price > 0]{
      sku,
      gtin,
      "slug": slug.current,
      "name": coalesce(name[$locale], name.fr),
      "description": coalesce(shortDescription[$locale], shortDescription.fr, name[$locale], name.fr),
      price,
      stock,
      productType,
      "brand": coalesce(brand->name[$locale], brand->name.fr, brand->name),
      "color": coalesce(color[$locale], color.fr),
      modelFamily,
      "image": images[0].asset->url
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
      return `  <item>
    <g:id>${esc(id)}</g:id>
    <g:title>${esc(p.name)}</g:title>
    <g:description>${esc(p.description || p.name)}</g:description>
    <g:link>${SITE}${prefix}/produits/${esc(p.slug)}</g:link>
    <g:image_link>${esc(p.image)}</g:image_link>
    <g:availability>${availability}</g:availability>
    <g:price>${(p.price as number).toFixed(2)} EUR</g:price>
    <g:condition>new</g:condition>${p.gtin ? `
    <g:gtin>${esc(p.gtin)}</g:gtin>` : `
    <g:identifier_exists>no</g:identifier_exists>`}${p.brand ? `
    <g:brand>${esc(p.brand)}</g:brand>` : ''}${p.color ? `
    <g:color>${esc(p.color)}</g:color>` : ''}${p.modelFamily ? `
    <g:item_group_id>${esc(p.modelFamily)}</g:item_group_id>` : ''}${productType ? `
    <g:product_type>${esc(productType)}</g:product_type>` : ''}
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
