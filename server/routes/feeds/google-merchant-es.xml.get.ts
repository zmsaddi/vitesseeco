/**
 * Merchant Center feed for the es market.
 *
 * Register this URL in Merchant Center against the countries the es pages are
 * priced for. The feed quotes that market's price list and links to that
 * market's URLs, so the page Google crawls shows the figure the feed declared.
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { buildMerchantFeed } from '../../feeds/merchant'

export default defineEventHandler(async (event) => {
  const { xml } = await buildMerchantFeed('es')
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  // Merchant fetches on a schedule measured in hours, so an hour of cache costs
  // nothing and spares the catalogue 147 reads per crawl.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})
