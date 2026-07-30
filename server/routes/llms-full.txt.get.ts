/**
 * llms-full.txt — every product, one line each.
 *
 * The companion to llms.txt: that one describes the shop, this one lists what
 * is in it, so an assistant asked for a specific model can name the page rather
 * than guessing a URL. Names and links only — no prices, because a price quoted
 * from a cached file is a price we did not agree to.
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { listProducts } from '../catalog'
import { ORGANISATION, SITE_URL } from '../../shared/organisation'
import { DEFAULT_LOCALE } from '../../shared/locales'

/** Bounded: a file an assistant has to read whole should stay readable. */
const PAGE_SIZE = 48
const MAX_PAGES = 10

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')

  const rows: string[] = []
  let page = 1
  let totalPages = 1

  try {
    do {
      const result = await listProducts({ locale: DEFAULT_LOCALE, page, perPage: PAGE_SIZE })
      totalPages = result.totalPages
      for (const product of result.items) {
        const attributes = [
          product.brand?.name,
          product.color,
          product.available > 0 ? 'in stock' : 'out of stock',
        ].filter(Boolean)
        rows.push(`- ${product.name}${attributes.length ? ` (${attributes.join(', ')})` : ''} — ${SITE_URL}/produits/${product.slug}`)
      }
      page++
    } while (page <= totalPages && page <= MAX_PAGES)
  } catch (error) {
    console.error('[llms-full] catalogue unavailable', error)
  }

  return [
    `# ${ORGANISATION.name} — full product list`,
    '',
    `Generated from the live catalogue. ${rows.length} products.`,
    `Shop overview: ${SITE_URL}/llms.txt`,
    '',
    ...rows,
    '',
  ].join('\n')
})
