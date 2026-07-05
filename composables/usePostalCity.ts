/**
 * Zip-first address UX: postal code → commune(s) via /api/geo/postal,
 * memoized per session. A zip may cover several communes — the caller
 * decides how to present the choice.
 */
export interface PostalResult {
  /** Unambiguous city (exactly one commune), else null. */
  city: string | null
  /** Every commune under this code (may be empty when unknown). */
  cities: string[]
}

const cache = new Map<string, PostalResult>()

export function usePostalCity() {
  async function lookup(country: string, code: string): Promise<PostalResult> {
    const key = `${country}:${code}`.toUpperCase().replace(/\s/g, '')
    const hit = cache.get(key)
    if (hit) return hit
    try {
      const res = await $fetch<PostalResult>('/api/geo/postal', {
        query: { country, code },
      })
      const value: PostalResult = { city: res.city ?? null, cities: res.cities ?? [] }
      cache.set(key, value)
      return value
    } catch {
      return { city: null, cities: [] }
    }
  }
  return { lookup }
}
