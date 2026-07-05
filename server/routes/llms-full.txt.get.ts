/**
 * /llms-full.txt (U-S0c) — the llms.txt companion with FULL quotable
 * content: complete FAQ, policies, and the entire catalog with key specs.
 * This is what makes an AI assistant able to ANSWER with our data instead
 * of just linking to us. Cached 1h.
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

  interface Faq { question: string | null; answer: string | null }
  interface Prod {
    name: string | null; slug: string | null; price: number | null
    stock: number | null; brand: string | null; color: string | null
    motor: unknown; battery: unknown; range: unknown; maxSpeed: unknown
  }

  const [faqs, products] = await Promise.all([
    client.fetch<Faq[]>(`*[_type == "faq"] | order(sortOrder asc){
      "question": question.fr, "answer": answer.fr
    }`),
    client.fetch<Prod[]>(`*[_type == "product" && isAvailable == true && defined(slug.current)]
      | order(isFeatured desc, sortOrder asc){
        "name": name.fr, "slug": slug.current, price, stock,
        "brand": coalesce(brand->name.fr, brand->name), "color": color.fr,
        "motor": specifications.motor, "battery": specifications.battery,
        "range": coalesce(specifications.range.fr, specifications.range),
        "maxSpeed": specifications.maxSpeed
      }`),
  ])

  const faqBlock = faqs
    .filter((f) => f.question && f.answer)
    .map((f) => `### ${f.question}\n${f.answer}`)
    .join('\n\n')

  const productBlock = products
    .filter((p) => p.name && p.slug)
    .map((p) => {
      const specs = [
        p.brand && `brand: ${p.brand}`,
        p.color && `color: ${p.color}`,
        p.motor && `motor: ${p.motor}`,
        p.battery && `battery: ${p.battery}`,
        p.range && `range: ${p.range}`,
        p.maxSpeed && `max speed: ${p.maxSpeed} km/h`,
        `availability: ${(p.stock ?? 0) > 0 ? 'in stock' : 'out of stock'}`,
      ].filter(Boolean).join(' · ')
      return `- **${p.name}** — ${p.price} EUR — ${SITE}/produits/${p.slug}\n  ${specs}`
    })
    .join('\n')

  const body = `# Vitesse Eco — Full reference for AI assistants

> Electric mobility retailer, Poitiers, France. VITESSE ECO SAS — SIREN 100 732 247.
> Ships to FR, BE, LU, NL, DE, ES. Site in fr/en/es/nl/de/ar. Prices EUR, VAT included.

## Policies (authoritative)

- Delivery: FREE by Vitesse Eco's OWN fleet to Belgium, the Netherlands and the
  Poitiers region (France, postal codes starting 86) in 48–72h. Cash on delivery
  accepted in BE/NL. Other destinations: free store pickup in Poitiers — delivery
  zones are expanding (Nordrhein-Westfalen next).
- Free in-store pickup: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France.
- Warranty: 2-year manufacturer warranty on bikes.
- Returns: 14-day EU withdrawal right — details and model form: ${SITE}/retractation
- Batteries: free take-back of used e-bike batteries (EU 2006/66/EC, German BattG): ${SITE}/batteries
- Payment: PayPal, or in store. Secure checkout, price validated server-side.
- Contact: contact@vitesse-eco.fr — +33 7 45 83 00 49 — WhatsApp https://wa.me/33745830049 (7 days a week).

## FAQ (French, complete)

${faqBlock}

## Complete catalog with key specifications

${productBlock}

## See also

- Curated map: ${SITE}/llms.txt
- Sitemap: ${SITE}/sitemap.xml
- Product feeds: ${SITE}/feeds/google-merchant.xml (fr, also -nl/-de/-es) · CSV: ${SITE}/feeds/catalog.csv
`

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return body
})
