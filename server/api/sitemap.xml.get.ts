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
  const locales = ['', '/en', '/es', '/nl', '/de']
  const now = new Date().toISOString().split('T')[0]

  const staticPages = ['', '/produits', '/a-propos', '/contact', '/mentions-legales', '/politique-confidentialite', '/cgv']

  let urls = ''

  for (const locale of locales) {
    for (const page of staticPages) {
      urls += `  <url><loc>${baseUrl}${locale}${page}</loc><lastmod>${now}</lastmod><changefreq>${page === '' ? 'daily' : 'weekly'}</changefreq><priority>${page === '' ? '1.0' : page === '/produits' ? '0.9' : '0.7'}</priority></url>\n`
    }
    for (const p of products) {
      urls += `  <url><loc>${baseUrl}${locale}/produits/${p.slug}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`
    }
  }

  setResponseHeader(event, 'content-type', 'application/xml')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`
})
