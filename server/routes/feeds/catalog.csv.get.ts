/**
 * Universal catalog CSV (U-S0c) — the lingua franca of marketplaces and
 * channel managers. This single URL plugs into Channable / Lengow /
 * Shoppingfeed / BaseLinker, which then push the catalog to Amazon, eBay,
 * bol.com, Cdiscount, Kaufland, TikTok Shop, etc.
 *
 * Column set follows the Google Shopping spec (the de-facto standard every
 * channel manager maps from). NOTE for marketplaces: Amazon/bol/Kaufland
 * REQUIRE GTIN/EAN codes — the catalog has none yet (identifier_exists=no);
 * the owner must source EANs from the supplier or GS1 before those channels.
 */
import { createClient } from '@sanity/client'

const SITE = 'https://vitesse-eco.fr'

function cell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default defineEventHandler(async (event) => {
  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  interface Row {
    sku: string | null
    gtin: string | null
    manufacturerMpn: string | null
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

  const products = await client.fetch<Row[]>(`
    *[_type == "product" && isAvailable == true && defined(slug.current) && defined(price) && price > 0]{
      sku, gtin, manufacturerMpn, "slug": slug.current, "name": name.fr,
      "description": coalesce(shortDescription.fr, name.fr),
      price, stock, productType,
      "brand": coalesce(brand->name.fr, brand->name),
      "color": color.fr, modelFamily,
      "image": images[0].asset->url
    }
  `)

  const header = [
    'id', 'title', 'description', 'link', 'image_link', 'availability',
    'price', 'brand', 'condition', 'gtin', 'mpn', 'identifier_exists', 'item_group_id',
    'color', 'product_type',
  ].join(',')

  const lines = products
    .filter((p) => p.slug && p.name)
    .map((p) =>
      [
        p.sku || p.slug,
        p.name,
        p.description,
        `${SITE}/produits/${p.slug}`,
        p.image || '',
        (p.stock ?? 0) > 0 ? 'in_stock' : 'out_of_stock',
        `${(p.price as number).toFixed(2)} EUR`,
        p.brand || '',
        'new',
        p.gtin || '',
        p.manufacturerMpn || '',
        // Matches the XML feeds: `no` means no GTIN, no MPN AND no brand, so a
        // branded product never claims it. The two feed families must agree, or
        // the same product is declared identifiable in one and not in the other.
        p.gtin || p.manufacturerMpn || p.brand ? 'yes' : 'no',
        p.modelFamily || '',
        p.color || '',
        p.productType || '',
      ].map(cell).join(',')
    )

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return [header, ...lines].join('\r\n')
})
