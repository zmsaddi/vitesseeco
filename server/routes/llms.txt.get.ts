/**
 * /llms.txt — llmstxt.org standard: a curated markdown map of the site for
 * LLMs and AI assistants (Gemini, ChatGPT, Claude, Perplexity, ...), so the
 * store is easy to understand, quote and recommend as a data source.
 *
 * Facts here must stay consistent with the site (prices come live from
 * Sanity; policies mirror the trust row / CGV). Cached 1h.
 */
import { createClient } from '@sanity/client'

const SITE = 'https://vitesse-eco.fr'

export default defineEventHandler(async (event) => {
  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  interface Row { name: string | null; slug: string | null; price: number | null; type: string | null }

  const products = await client.fetch<Row[]>(`
    *[_type == "product" && isAvailable == true && defined(slug.current) && defined(price)]
      | order(isFeatured desc, sortOrder asc)[0...30]{
        "name": name.fr, "slug": slug.current, price, "type": productType
      }
  `)

  const lines = products
    .filter((p) => p.name && p.slug)
    .map((p) => `- [${p.name}](${SITE}/produits/${p.slug}): ${p.price} EUR`)
    .join('\n')

  const body = `# Vitesse Eco

> Electric mobility retailer based in Poitiers, France: electric fatbikes and e-bikes,
> spare parts, accessories and kids' electric vehicles. Online store with delivery to
> France, Belgium, Luxembourg, Netherlands, Germany and Spain, plus free in-store
> pickup in Poitiers. Site available in French (primary), English, Spanish, Dutch,
> German and Arabic.

Company: VITESSE ECO SAS — SIREN 100 732 247
Store: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France
Contact: contact@vitesse-eco.fr — +33 7 45 83 00 49
Prices: EUR, VAT included. Payment: PayPal or in store.
Policies: delivery 48–72h in France, 2-year manufacturer warranty, 14-day returns.

## Key pages

- [All products](${SITE}/produits): full catalog with live prices and stock
- [Buying guide](${SITE}/guide): interactive selector by usage, rider height and range
- [Comparison table](${SITE}/comparatif): all bike specs side by side
- [FAQ](${SITE}/faq): shipping, warranty, battery and legal questions
- [Contact](${SITE}/contact)
- [Blog](${SITE}/blog)

## Machine-readable resources

- [Sitemap (all languages, hreflang)](${SITE}/sitemap.xml)
- [Product feed — Google Merchant XML, French](${SITE}/feeds/google-merchant.xml)
- [Product feed — Dutch](${SITE}/feeds/google-merchant-nl.xml) · [German](${SITE}/feeds/google-merchant-de.xml) · [Spanish](${SITE}/feeds/google-merchant-es.xml)
- [Blog RSS](${SITE}/feeds/blog.xml)

## Products (selection)

${lines}
`

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return body
})
