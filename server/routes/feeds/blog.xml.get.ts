/**
 * The blog as RSS.
 *
 * Cheap to serve and the thing a reader, an aggregator or an AI crawler looks
 * for when it wants to follow a shop rather than re-crawl it. Advertised from
 * the document head, because a feed nobody can discover is a file nobody reads.
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { listArticles } from '../../catalog'
import { localizedUrl, DEFAULT_LOCALE } from '../../../shared/locales'
import { ORGANISATION, SITE_URL } from '../../../shared/organisation'

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')

  const articles = await listArticles(DEFAULT_LOCALE).catch(() => [])

  const items = articles
    .map((article) => {
      const url = localizedUrl(`/blog/${article.slug}`, DEFAULT_LOCALE)
      return `    <item>
      <title>${esc(article.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>${
        article.publishedAt ? `\n      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>` : ''
      }${article.excerpt ? `\n      <description>${esc(article.excerpt)}</description>` : ''}
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(ORGANISATION.name)}</title>
    <link>${SITE_URL}/blog</link>
    <description>Guides and advice on electric bikes, from the shop that delivers them.</description>
    <language>fr</language>
    <atom:link href="${SITE_URL}/feeds/blog.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`
})
