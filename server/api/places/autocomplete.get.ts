import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 30, windowMs: 60_000 })

  const query = getQuery(event)
  const input = query.input as string

  if (!input || input.length < 3) {
    return { predictions: [] }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NUXT_PUBLIC_GOOGLE_PLACES_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, message: 'Places API not configured' })

  try {
    const res = await $fetch<any>(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json', {
        query: {
          input,
          key: apiKey,
          types: 'address',
          components: 'country:fr|country:be|country:lu|country:de|country:nl',
          language: 'fr',
        },
      }
    )

    return { predictions: res.predictions || [] }
  } catch (e: any) {
    console.error('Places API error:', e.message)
    return { predictions: [] }
  }
})
