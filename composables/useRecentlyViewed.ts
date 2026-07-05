/**
 * Recently-viewed products (U-M1) — localStorage, max 8, newest first.
 * Client-only by nature; call record() from the PDP, read via items after
 * load() (RecentlyViewed.vue does both).
 */

export interface RecentProduct {
  id: string
  name: string
  slug: string
  price: number
  image: string
  stock: number
}

const KEY = 'vitesse-recently-viewed'
const MAX = 8

export function useRecentlyViewed() {
  const items = useState<RecentProduct[]>('recently-viewed', () => [])

  function load() {
    if (import.meta.server) return
    try {
      items.value = JSON.parse(localStorage.getItem(KEY) || '[]')
    } catch {
      items.value = []
    }
  }

  function record(p: RecentProduct) {
    if (import.meta.server || !p.id || !p.slug) return
    load()
    items.value = [p, ...items.value.filter((i) => i.id !== p.id)].slice(0, MAX)
    try { localStorage.setItem(KEY, JSON.stringify(items.value)) } catch {}
  }

  return { items, load, record }
}
