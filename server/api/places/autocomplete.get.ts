import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 30, windowMs: 60_000 })

  const query = getQuery(event)
  const input = query.input as string
  const country = (query.country as string || 'fr').toLowerCase().trim()
  // mode=cities → suggest localities instead of street addresses
  // (city-first flow in the checkout address form).
  const types = query.mode === 'cities' ? '(cities)' : 'address'

  if (!input || input.length < 3) {
    return { predictions: [] }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, message: 'Places API not configured' })

  try {
    const res = await $fetch<{ predictions?: Array<{ place_id: string; description: string; structured_formatting?: { main_text: string } }> }>(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json', {
        query: {
          input,
          key: apiKey,
          types,
          components: `country:${country}`,
          language: country === 'de' ? 'de' : country === 'nl' ? 'nl' : country === 'es' ? 'es' : 'fr',
        },
      }
    )

    return { predictions: res.predictions || [] }
  } catch {
    return { predictions: [] }
  }
})
