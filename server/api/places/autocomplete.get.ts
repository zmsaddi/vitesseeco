import { rateLimit } from '~/server/utils/rateLimit'

/**
 * Address / city autocomplete with a NO-KEY fallback chain (2026-07-06):
 * the Google Places call was silently failing in production (key
 * restriction), leaving street + city suggestions dead for customers.
 *
 *   1. Google Places (when GOOGLE_PLACES_API_KEY works) — unchanged shape.
 *   2. FR fallback: BAN (api-adresse.data.gouv.fr) — the official French
 *      address base, free, no key, includes city+postcode inline.
 *   3. Other countries: Photon (photon.komoot.io, OSM) — free, no key,
 *      post-filtered by country code.
 *
 * Fallback predictions carry `inline: { address, city, postalCode }` so the
 * client can fill everything WITHOUT a /details round-trip.
 */

interface Prediction {
  place_id: string
  description: string
  structured_formatting?: { main_text: string }
  inline?: { address: string; city: string; postalCode: string }
}

const PHOTON_LANG: Record<string, string> = { fr: 'fr', de: 'de', nl: 'nl', es: 'es', be: 'fr', lu: 'fr' }

async function googlePredictions(input: string, country: string, types: string): Promise<Prediction[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return []
  try {
    const res = await $fetch<{ status?: string; predictions?: Prediction[] }>(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json', {
        query: {
          input,
          key: apiKey,
          types,
          components: `country:${country}`,
          language: PHOTON_LANG[country] || 'fr',
        },
        timeout: 4000,
      }
    )
    return res.predictions || []
  } catch {
    return []
  }
}

/** France — BAN. `type`: 'housenumber'/'street' for addresses, 'municipality' for cities. */
async function banPredictions(input: string, mode: string, postal?: string): Promise<Prediction[]> {
  try {
    const res = await $fetch<any>('https://api-adresse.data.gouv.fr/search/', {
      query: {
        q: input,
        limit: 6,
        autocomplete: 1,
        ...(mode === 'cities' ? { type: 'municipality' } : {}),
        ...(postal && mode !== 'cities' ? { postcode: postal } : {}),
      },
      timeout: 4000,
    })
    return (res?.features || []).map((f: any, i: number): Prediction => {
      const p = f.properties || {}
      const street = mode === 'cities' ? p.city || p.name : p.name || p.street || ''
      return {
        place_id: `ban:${i}`,
        description: p.label || street,
        structured_formatting: { main_text: street },
        inline: { address: mode === 'cities' ? '' : street, city: p.city || p.name || '', postalCode: p.postcode || '' },
      }
    })
  } catch {
    return []
  }
}

/** Rest of Europe — Photon (OSM), post-filtered to the requested country. */
async function photonPredictions(input: string, country: string, mode: string): Promise<Prediction[]> {
  try {
    const res = await $fetch<any>('https://photon.komoot.io/api/', {
      query: { q: input, limit: 10, lang: PHOTON_LANG[country] || 'fr' },
      timeout: 4000,
    })
    const cc = country.toUpperCase()
    const feats = (res?.features || []).filter((f: any) => (f.properties?.countrycode || '').toUpperCase() === cc)
    const wanted = mode === 'cities'
      ? feats.filter((f: any) => ['city', 'town', 'village', 'municipality'].includes(f.properties?.type))
      : feats.filter((f: any) => ['house', 'street'].includes(f.properties?.type) || f.properties?.street || f.properties?.housenumber)
    return wanted.slice(0, 6).map((f: any, i: number): Prediction => {
      const p = f.properties || {}
      const street = mode === 'cities'
        ? (p.name || '')
        : [p.housenumber, p.street || p.name].filter(Boolean).join(' ')
      const city = p.city || p.town || p.village || (mode === 'cities' ? p.name : '') || ''
      const label = [street, p.postcode, city].filter(Boolean).join(', ')
      return {
        place_id: `photon:${i}`,
        description: mode === 'cities' ? [p.name, p.postcode].filter(Boolean).join(', ') : label,
        structured_formatting: { main_text: street || p.name || '' },
        inline: { address: mode === 'cities' ? '' : street, city, postalCode: p.postcode || '' },
      }
    })
  } catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 30, windowMs: 60_000 })

  const query = getQuery(event)
  const input = query.input as string
  const country = (query.country as string || 'fr').toLowerCase().trim()
  const mode = query.mode === 'cities' ? 'cities' : 'address'
  const postal = typeof query.postal === 'string' ? query.postal.slice(0, 10) : undefined
  const types = mode === 'cities' ? '(cities)' : 'address'

  if (!input || input.length < (mode === 'cities' ? 2 : 3)) {
    return { predictions: [] }
  }

  let predictions = await googlePredictions(input, country, types)

  if (!predictions.length) {
    predictions = country === 'fr'
      ? await banPredictions(input, mode, postal)
      : await photonPredictions(input, country, mode)
  }

  return { predictions }
})
