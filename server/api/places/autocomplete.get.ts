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

/**
 * Photon supports exactly four languages: default, de, en and fr. Asking it for
 * anything else is a 400 with an empty result, not a graceful fallback — which
 * is why Spanish address suggestions returned nothing from the day this was
 * written. Dutch was spared only because the Netherlands is served by PDOK
 * before Photon is reached.
 *
 * Spain and the Netherlands therefore map to English, which Photon does speak.
 */
const PHOTON_LANG: Record<string, string> = {
  fr: 'fr',
  de: 'de',
  nl: 'en',
  es: 'en',
  be: 'fr',
  lu: 'fr',
}

/** Anything not listed above still has to be a language Photon accepts. */
const PHOTON_FALLBACK_LANG = 'en'

/**
 * EU house-number conventions (owner 2026-07-06: "Rue du Maine 15" lost
 * the 15). FR/LU write the number FIRST ("15 rue X", incl. 15bis/ter);
 * BE/NL/DE/ES write it AFTER ("Hoofdstraat 15a", "Calle Mayor, 15").
 * Customers type either — extract the number wherever it sits so the
 * providers match, and re-attach it when they return a street-only hit.
 */
const NO_SUFFIX = String.raw`\d+(?:\s?(?:bis|ter|quater)\b|[a-z])?`
function splitHouseNumber(streetInput: string): { houseNo: string | null; street: string } {
  const s = streetInput.trim()
  const lead = s.match(new RegExp(`^(${NO_SUFFIX})[\\s,]+(\\S.*)$`, 'i'))
  if (lead) return { houseNo: lead[1].trim(), street: lead[2].trim() }
  const trail = s.match(new RegExp(`^(.*\\S)[\\s,]+(${NO_SUFFIX})$`, 'i'))
  if (trail) return { houseNo: trail[2].trim(), street: trail[1].trim() }
  return { houseNo: null, street: s }
}

/** Local display convention: number leads in FR/LU, trails elsewhere. */
function attachHouseNo(street: string, houseNo: string | null, country: string): string {
  if (!houseNo || !street || /\d/.test(street)) return street
  return country === 'fr' || country === 'lu' ? `${houseNo} ${street}` : `${street} ${houseNo}`
}

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
          language: PHOTON_LANG[country] || PHOTON_FALLBACK_LANG,
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
async function banPredictions(input: string, mode: string, postal?: string, houseNo?: string | null): Promise<Prediction[]> {
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
      let street = mode === 'cities' ? p.city || p.name : p.name || p.street || ''
      let description = p.label || street
      // Street-only hit but the customer typed a number → keep their number.
      if (mode !== 'cities' && !p.housenumber && houseNo) {
        street = attachHouseNo(street, houseNo, 'fr')
        description = [street, p.postcode, p.city].filter(Boolean).join(' ')
      }
      return {
        place_id: `ban:${i}`,
        description,
        structured_formatting: { main_text: street },
        inline: { address: mode === 'cities' ? '' : street, city: p.city || p.name || '', postalCode: p.postcode || '' },
      }
    })
  } catch {
    return []
  }
}

/**
 * Netherlands — PDOK Locatieserver (official Dutch geocoder, free, no key).
 * Supports the NL "unique code" convention: postcode + house number alone
 * IS a full address ("1012AB 15" → street + city resolved).
 */
async function pdokPredictions(input: string, mode: string, postal?: string, houseNo?: string | null, street?: string): Promise<Prediction[]> {
  try {
    const pc = (postal || '').replace(/\s/g, '').toUpperCase()
    // PDOK matches whole tokens, so "Amst" found nothing and only the complete
    // "Amsterdam" worked — which defeats the point of a suggestion box. A
    // trailing wildcard turns it into the prefix search a customer expects.
    // Addresses do not need it: the postcode already narrows those.
    const cityQuery = input.trim().endsWith('*') ? input.trim() : `${input.trim()}*`
    const q = mode === 'cities'
      ? cityQuery
      : [pc, street, houseNo].filter(Boolean).join(' ') || input
    const res = await $fetch<any>('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free', {
      query: { q, rows: 6, fq: mode === 'cities' ? 'type:woonplaats' : 'type:adres' },
      timeout: 4000,
    })
    const docs = res?.response?.docs || []
    return docs.map((d: any, i: number): Prediction => {
      const line = mode === 'cities'
        ? (d.woonplaatsnaam || '')
        : [d.straatnaam, d.huis_nlt].filter(Boolean).join(' ')
      return {
        place_id: `pdok:${i}`,
        description: d.weergavenaam || line,
        structured_formatting: { main_text: line },
        inline: { address: mode === 'cities' ? '' : line, city: d.woonplaatsnaam || '', postalCode: d.postcode || '' },
      }
    })
  } catch {
    return []
  }
}

/** Rest of Europe — Photon (OSM), post-filtered to the requested country. */
async function photonPredictions(input: string, country: string, mode: string, houseNo?: string | null): Promise<Prediction[]> {
  try {
    const res = await $fetch<any>('https://photon.komoot.io/api/', {
      query: { q: input, limit: 10, lang: PHOTON_LANG[country] || PHOTON_FALLBACK_LANG },
      timeout: 4000,
    })
    const cc = country.toUpperCase()
    const feats = (res?.features || []).filter((f: any) => (f.properties?.countrycode || '').toUpperCase() === cc)
    const wanted = mode === 'cities'
      ? feats.filter((f: any) => ['city', 'town', 'village', 'municipality'].includes(f.properties?.type))
      : feats.filter((f: any) => ['house', 'street'].includes(f.properties?.type) || f.properties?.street || f.properties?.housenumber)
    return wanted.slice(0, 6).map((f: any, i: number): Prediction => {
      const p = f.properties || {}
      let street = mode === 'cities'
        ? (p.name || '')
        : (p.housenumber
            ? attachHouseNo(p.street || p.name || '', p.housenumber, country)
            // Street-only hit but the customer typed a number → keep it,
            // in the local convention (BE/NL/DE/ES trail, FR/LU lead).
            : attachHouseNo(p.street || p.name || '', houseNo || null, country))
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

  // NL "unique code" path may be as short as one digit ("15" + postcode).
  const minLen = mode === 'cities' ? 2 : (country === 'nl' && postal ? 1 : 3)
  if (!input || input.length < minLen) {
    return { predictions: [] }
  }

  let predictions = await googlePredictions(input, country, types)

  if (!predictions.length) {
    // Understand where the customer put the house number ("15 rue X" vs
    // "Rue X 15") before talking to the fallback providers.
    const [streetSeg, ...restSegs] = input.split(',')
    const rest = restSegs.length ? `, ${restSegs.join(',').trim()}` : ''
    const { houseNo, street } = mode === 'cities'
      ? { houseNo: null as string | null, street: streetSeg.trim() }
      : splitHouseNumber(streetSeg)

    if (country === 'fr') {
      // BAN matches best with the number LEADING.
      const q = houseNo ? `${houseNo} ${street}${rest}` : input
      predictions = await banPredictions(q, mode, postal, houseNo)
    } else if (country === 'nl') {
      predictions = await pdokPredictions(input, mode, postal, houseNo, street)
    } else {
      predictions = await photonPredictions(input, country, mode, houseNo)
    }
  }

  return { predictions }
})
