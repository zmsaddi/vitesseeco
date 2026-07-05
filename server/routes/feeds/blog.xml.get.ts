/**
 * Blog RSS 2.0 feed (U-S0b) — distribution to feed readers, news
 * aggregators and yet another crawlable resource for search/AI engines.
 * French (primary language) content.
 */
import { createClient } from '@sanity/client'

const SITE = 'https://vitesse-eco.fr'

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default defineEventHandler(async (event) => {
  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  interface Row {
    title: string | null
    slug: string | null
    excerpt: string | null
    publishedAt: string | null
  }

  const articles = await client.fetch<Row[]>(
    `*[_type == "article" && isPublished == true && defined(slug.current)]
      | order(publishedAt desc)[0...50]{
        "title": title.fr, "slug": slug.current, "excerpt": excerpt.fr, publishedAt
      }`
  )

  const items = articles
    .filter((a) => a.title && a.slug)
    .map((a) => `  <item>
    <title>${esc(a.title)}</title>
    <link>${SITE}/blog/${esc(a.slug)}</link>
    <guid isPermaLink="true">${SITE}/blog/${esc(a.slug)}</guid>${a.excerpt ? `
    <description>${esc(a.excerpt)}</description>` : ''}${a.publishedAt ? `
    <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>` : ''}
  </item>`)
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Vitesse Eco — Blog</title>
  <link>${SITE}/blog</link>
  <description>Conseils, guides et actualités vélo électrique — Vitesse Eco</description>
  <language>fr</language>
${items}
</channel>
</rss>`

  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return xml
})
