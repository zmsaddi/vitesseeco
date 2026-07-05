/**
 * Google Merchant Center product feed (RSS 2.0 + g: namespace).
 *
 * Register this URL in Merchant Center → Products → Feeds:
 *   https://vitesse-eco.fr/feeds/google-merchant.xml
 *
 * System B mapping: each color is its own product (own g:id), and
 * modelFamily becomes g:item_group_id so Google groups the colors as
 * variants of one model — exactly the Merchant variants model.
 *
 * No GTIN/MPN data exists in the catalog → identifier_exists=no.
 */
import { createClient } from '@sanity/client'

const SITE = 'https://vitesse-eco.fr'

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  bike: 'Vélos électriques',
  spare_part: 'Pièces détachées',
  accessory: 'Accessoires',
  kids_car: 'Véhicules enfants',
  other: 'Autres',
}

export default defineEventHandler(async (event) => {
  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  interface FeedProduct {
    sku: string | null
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

  const products = await client.fetch<FeedProduct[]>(`
    *[_type == "product" && isAvailable == true && defined(slug.current) && defined(price) && price > 0]{
      sku,
      "slug": slug.current,
      "name": coalesce(name.fr, name.en),
      "description": coalesce(shortDescription.fr, shortDescription.en, name.fr),
      price,
      stock,
      productType,
      "brand": coalesce(brand->name.fr, brand->name),
      "color": coalesce(color.fr, color.en),
      modelFamily,
      "image": images[0].asset->url
    }
  `)

  const items = products
    .filter((p) => p.slug && p.name && p.image)
    .map((p) => {
      const id = p.sku || p.slug
      const availability = (p.stock ?? 0) > 0 ? 'in_stock' : 'out_of_stock'
      const productType = PRODUCT_TYPE_LABELS[p.productType ?? ''] ?? ''
      return `  <item>
    <g:id>${esc(id)}</g:id>
    <g:title>${esc(p.name)}</g:title>
    <g:description>${esc(p.description || p.name)}</g:description>
    <g:link>${SITE}/produits/${esc(p.slug)}</g:link>
    <g:image_link>${esc(p.image)}</g:image_link>
    <g:availability>${availability}</g:availability>
    <g:price>${(p.price as number).toFixed(2)} EUR</g:price>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>${p.brand ? `
    <g:brand>${esc(p.brand)}</g:brand>` : ''}${p.color ? `
    <g:color>${esc(p.color)}</g:color>` : ''}${p.modelFamily ? `
    <g:item_group_id>${esc(p.modelFamily)}</g:item_group_id>` : ''}${productType ? `
    <g:product_type>${esc(productType)}</g:product_type>` : ''}
  </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Vitesse Eco</title>
  <link>${SITE}</link>
  <description>Vélos électriques, pièces et accessoires — Vitesse Eco, Poitiers</description>
${items}
</channel>
</rss>`

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return xml
})
