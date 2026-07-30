/**
 * The sitemap.
 *
 * Every URL and every alternate is generated from the locales manifest, so the
 * sitemap, the canonical tags and the router can never disagree — and moving a
 * market onto its own domain rewrites this file's output without editing it.
 *
 * Entries with no slug are dropped rather than allowed to fail: one article
 * saved without one took the whole sitemap down in the previous build, which
 * cost every URL its indexing rather than one.
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { LOCALES, alternatesFor, localizedUrl, DEFAULT_LOCALE } from '../../shared/locales'
import { listAllProductSlugs } from '../catalog'

/**
 * Pages that exist in every language regardless of the catalogue.
 *
 * Only paths that are actually SERVED belong here. Submitting a URL that
 * returns nothing is a soft 404, and Google counts them against the whole site
 * — this list previously advertised six pages the rebuild does not have. A test
 * asserts every entry resolves to a real page file, so the list cannot drift
 * ahead of the app again.
 */
export const STATIC_PATHS = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/produits', priority: '0.9', changefreq: 'daily' },
  { path: '/a-propos', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/faq', priority: '0.6', changefreq: 'monthly' },
  { path: '/cgv', priority: '0.3', changefreq: 'yearly' },
  { path: '/mentions-legales', priority: '0.3', changefreq: 'yearly' },
  { path: '/politique-confidentialite', priority: '0.3', changefreq: 'yearly' },
  { path: '/retractation', priority: '0.3', changefreq: 'yearly' },
  { path: '/impressum', priority: '0.3', changefreq: 'yearly' },
  { path: '/batteries', priority: '0.3', changefreq: 'yearly' },
] as const

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function urlEntry(path: string, priority: string, changefreq: string, lastmod: string): string {
  const alternates = alternatesFor(path)
    .map(
      (alternate) =>
        `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeXml(alternate.href)}"/>`
    )
    .join('\n')

  // One <url> per locale, each declaring the full set of alternates — which is
  // what Google requires for a bidirectional hreflang cluster.
  return LOCALES.map((locale) => {
    const loc = escapeXml(localizedUrl(path, locale.code))
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${locale.code === DEFAULT_LOCALE ? priority : String(Math.max(0.1, Number(priority) - 0.1))}</priority>`,
      alternates,
      '  </url>',
    ].join('\n')
  }).join('\n')
}

export default defineEventHandler(async (event) => {
  const lastmod = new Date().toISOString().slice(0, 10)
  const entries: string[] = []

  for (const page of STATIC_PATHS) {
    entries.push(urlEntry(page.path, page.priority, page.changefreq, lastmod))
  }

  // The catalogue is fetched defensively: a sitemap missing its products is
  // recoverable, a sitemap that 500s is not.
  try {
    // EVERY product, not the first page. This asked for 48 of 147, so two
    // thirds of the catalogue was never submitted to Google at all.
    const products = await listAllProductSlugs()

    for (const product of products) {
      // Each product carries its own last-edited date rather than today's:
      // a lastmod that changes daily for a page that has not changed teaches a
      // crawler to ignore the field.
      entries.push(
        urlEntry(`/produits/${product.slug}`, '0.8', 'weekly', product.updatedAt || lastmod)
      )
    }
  } catch (error) {
    console.error('[sitemap] catalogue unavailable, serving static pages only', error)
  }

  // Category filter URLs are deliberately absent. They are query-string views of
  // the listing page and canonicalise back to it, so submitting them asks Google
  // to crawl duplicates of a page already in the sitemap.

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries.join('\n'),
    '</urlset>',
  ].join('\n')
})
