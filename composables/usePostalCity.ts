/**
 * Zip-first address UX: postal code → city via /api/geo/postal, memoized
 * per session so retyping the same code costs nothing.
 */
const cache = new Map<string, string | null>()

export function usePostalCity() {
  async function lookup(country: string, code: string): Promise<string | null> {
    const key = `${country}:${code}`.toUpperCase().replace(/\s/g, '')
    if (cache.has(key)) return cache.get(key) ?? null
    try {
      const res = await $fetch<{ city: string | null }>('/api/geo/postal', {
        query: { country, code },
      })
      cache.set(key, res.city)
      return res.city
    } catch {
      return null
    }
  }
  return { lookup }
}
