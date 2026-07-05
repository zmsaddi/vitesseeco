/** Google Merchant feed — German. Register for DE. */
import { buildMerchantFeed } from '~/server/utils/merchantFeed'

export default defineEventHandler(async (event) => {
  const xml = await buildMerchantFeed('de')
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return xml
})
