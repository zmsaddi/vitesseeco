import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 30, windowMs: 60_000 })

  const query = getQuery(event)
  const input = query.input as string
  const countries = (query.countries as string || 'fr').split(',').map(c => c.trim())

  if (!input || input.length < 3) {
    return { predictions: [] }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || useRuntimeConfig().public.googlePlacesApiKey
  if (!apiKey) throw createError({ statusCode: 500, message: 'Places API not configured' })

  const components = countries.map(c => `country:${c}`).join('|')

  const res = await $fetch<any>(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json`, {
      query: {
        input,
        key: apiKey,
        types: 'address',
        components,
        language: 'fr',
      },
    }
  )

  return { predictions: res.predictions || [] }
})
