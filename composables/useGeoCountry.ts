/**
 * Visitor country (shipping-zone whitelist) resolved once per session from
 * /api/geo (Vercel IP geolocation). Purely a UX default — never overrides
 * an explicit customer choice.
 */
export function useGeoCountry() {
  const country = useState<string>('geo-country', () => '')

  async function load(): Promise<string> {
    if (country.value) return country.value
    if (import.meta.client) {
      try {
        const cached = sessionStorage.getItem('ve_geo_country')
        if (cached) {
          country.value = cached
          return cached
        }
      } catch { /* private mode */ }
    }
    try {
      const res = await $fetch<{ country: string }>('/api/geo')
      country.value = res.country || 'FR'
    } catch {
      country.value = 'FR'
    }
    if (import.meta.client) {
      try { sessionStorage.setItem('ve_geo_country', country.value) } catch { /* private mode */ }
    }
    return country.value
  }

  return { country, load }
}
