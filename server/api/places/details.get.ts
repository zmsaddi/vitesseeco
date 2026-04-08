import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 20, windowMs: 60_000 })

  const query = getQuery(event)
  const placeId = query.place_id as string

  if (!placeId) throw createError({ statusCode: 400, message: 'place_id required' })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, message: 'Places API not configured' })

  const res = await $fetch<any>(
    `https://maps.googleapis.com/maps/api/place/details/json`, {
      query: {
        place_id: placeId,
        key: apiKey,
        fields: 'address_components,formatted_address',
        language: 'fr',
      },
    }
  )

  if (!res.result?.address_components) {
    return { address: null }
  }

  const components = res.result.address_components
  const get = (type: string) => components.find((c: any) => c.types.includes(type))

  const streetNumber = get('street_number')?.long_name || ''
  const route = get('route')?.long_name || ''
  const city = get('locality')?.long_name || get('administrative_area_level_2')?.long_name || ''
  const postalCode = get('postal_code')?.long_name || ''
  const country = get('country')?.short_name || 'FR'

  return {
    address: `${streetNumber} ${route}`.trim(),
    city,
    postalCode,
    country,
    formatted: res.result.formatted_address,
  }
})
