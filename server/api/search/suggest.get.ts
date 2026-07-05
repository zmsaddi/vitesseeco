/**
 * Instant-search suggestions for the header (U-P3).
 *
 * Word-prefix match on localized product names + brand names via GROQ
 * `match`. Small payload (6 rows max), CDN-cached, 60s edge cache — cheap
 * enough to fire on every keystroke past the client debounce.
 */
import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'

const LOCALES = ['fr', 'en', 'es', 'nl', 'de', 'ar']

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 60) : ''
  const locale = LOCALES.includes(query.locale as string) ? (query.locale as string) : 'fr'
  if (q.length < 2) return { products: [], total: 0 }

  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  interface SuggestRow {
    name: string | null
    slug: string | null
    price: number | null
    stock: number | null
    image: string | null
  }

  const pattern = `${q}*`
  const [products, total] = await Promise.all([
    client.fetch<SuggestRow[]>(
      `*[_type == "product" && isAvailable == true && defined(slug.current) && (
        coalesce(name[$locale], name.fr) match $p ||
        name.fr match $p ||
        brand->name match $p
      )] | order(isFeatured desc, name.fr asc)[0...6]{
        "name": coalesce(name[$locale], name.fr),
        "slug": slug.current,
        price,
        stock,
        "image": images[0].asset->url
      }`,
      { p: pattern, locale }
    ),
    client.fetch<number>(
      `count(*[_type == "product" && isAvailable == true && (
        coalesce(name[$locale], name.fr) match $p ||
        name.fr match $p ||
        brand->name match $p
      )])`,
      { p: pattern, locale }
    ),
  ])

  setHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=60')
  return { products, total: Number(total) }
})
