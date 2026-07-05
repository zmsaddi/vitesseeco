/**
 * IndexNow submission (U-S0b) — instant-indexing ping to Bing, Yandex,
 * Seznam, Naver and every IndexNow-federated engine. Admin-triggered from
 * the dashboard: collects every indexable URL (static pages + products +
 * articles × 6 locales, same universe as the sitemap) and submits them in
 * one batch to api.indexnow.org (which fans out to all partners).
 *
 * Key file: public/4f1c9a2e7b8d4d6f9e3a1b5c8d2f7a90.txt (protocol proof
 * of site ownership — must match INDEXNOW_KEY below).
 */
import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'
import { audit } from '~/server/utils/audit'

const SITE = 'https://vitesse-eco.fr'
const INDEXNOW_KEY = '4f1c9a2e7b8d4d6f9e3a1b5c8d2f7a90'
const PREFIXES = ['', '/en', '/es', '/nl', '/de', '/ar']
// Must stay in sync with the sitemap's staticPages list.
const STATIC_PAGES = ['', '/produits', '/guide', '/comparatif', '/blog', '/faq', '/a-propos', '/contact', '/mentions-legales', '/politique-confidentialite', '/cgv', '/retractation', '/impressum', '/batteries']

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 3, windowMs: 60_000 })
  const admin = await requireAdmin(event)

  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  const [productSlugs, articleSlugs, landingSlugs] = await Promise.all([
    client.fetch<string[]>(`*[_type == "product" && isAvailable == true && defined(slug.current)].slug.current`),
    client.fetch<string[]>(`*[_type == "article" && isPublished == true && defined(slug.current)].slug.current`),
    client.fetch<string[]>(`*[_type == "landingPage" && isPublished == true && defined(slug.current)].slug.current`),
  ])

  const urlList: string[] = []
  for (const prefix of PREFIXES) {
    for (const page of STATIC_PAGES) urlList.push(`${SITE}${prefix}${page}`)
    for (const s of productSlugs) urlList.push(`${SITE}${prefix}/produits/${s}`)
    for (const s of articleSlugs) urlList.push(`${SITE}${prefix}/blog/${s}`)
    for (const s of landingSlugs) urlList.push(`${SITE}${prefix}/p/${s}`)
  }

  // IndexNow caps a batch at 10 000 URLs — we are far below, but guard anyway.
  const batch = urlList.slice(0, 10_000)

  await $fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: {
      host: 'vitesse-eco.fr',
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: batch,
    },
  })

  await audit({
    actorType: 'admin',
    actorId: admin.email,
    action: 'seo.indexnow_submit',
    metadata: { urls: batch.length },
  })

  return { ok: true, submitted: batch.length }
})
