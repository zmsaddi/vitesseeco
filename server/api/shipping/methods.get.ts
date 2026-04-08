import { createClient } from '@sanity/client'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const zone = (query.zone as string || 'FR').toUpperCase()

  const config = useRuntimeConfig()
  const client = createClient({
    projectId: config.public.sanityProjectId || '2jvnjf0c',
    dataset: config.public.sanityDataset || 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  const methods = await client.fetch(
    `*[_type == "shippingMethod" && isActive == true && $zone in zones] | order(sortOrder asc) {
      code, name, description, estimatedDays, price, freeAbove, zones
    }`,
    { zone }
  )

  return { methods, zone }
})
