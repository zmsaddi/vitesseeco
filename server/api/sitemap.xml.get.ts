import { createClient } from '@sanity/client'

export default defineEventHandler(async (event) => {
  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  const products = await client.fetch('*[_type == "product" && isAvailable == true]{ "slug": slug.current }')
  const baseUrl = 'https://vitesse-eco.fr'

  // Escape dynamic values to prevent XSS in XML
  function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  }

  const locales = [
    { prefix: '', hreflang: 'fr' },
    { prefix: '/en', hreflang: 'en' },
    { prefix: '/es', hreflang: 'es' },
    { prefix: '/nl', hreflang: 'nl' },
    { prefix: '/de', hreflang: 'de' },
    { prefix: '/ar', hreflang: 'ar' },
  ]
  const now = new Date().toISOString().split('T')[0]

  const staticPages = ['', '/produits', '/a-propos', '/contact', '/mentions-legales', '/politique-confidentialite', '/cgv']

  let urls = ''

  for (const locale of locales) {
    for (const page of staticPages) {
      const loc = `${baseUrl}${locale.prefix}${page}`
      const alternates = locales.map(l =>
        `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${baseUrl}${l.prefix}${page}"/>`
      ).join('\n')
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${page}"/>`
      urls += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${page === '' ? 'daily' : 'weekly'}</changefreq>\n    <priority>${page === '' ? '1.0' : page === '/produits' ? '0.9' : '0.7'}</priority>\n${alternates}\n${xDefault}\n  </url>\n`
    }
    for (const p of products) {
      const slug = escapeXml(p.slug)
      const loc = `${baseUrl}${locale.prefix}/produits/${slug}`
      const alternates = locales.map(l =>
        `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${baseUrl}${l.prefix}/produits/${slug}"/>`
      ).join('\n')
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/produits/${slug}"/>`
      urls += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n${alternates}\n${xDefault}\n  </url>\n`
    }
  }

  setResponseHeader(event, 'content-type', 'application/xml')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}</urlset>`
})
