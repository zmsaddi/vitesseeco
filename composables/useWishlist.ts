/**
 * Wishlist v1 (U-M2) — localStorage, client-only. Same snapshot shape as
 * recently-viewed so both strips can share card markup.
 */
import type { RecentProduct } from '~/composables/useRecentlyViewed'

const KEY = 'vitesse-wishlist'
const MAX = 50

export function useWishlist() {
  const items = useState<RecentProduct[]>('wishlist', () => [])
  const loaded = useState('wishlist-loaded', () => false)

  function load() {
    if (import.meta.server || loaded.value) return
    loaded.value = true
    try {
      items.value = JSON.parse(localStorage.getItem(KEY) || '[]')
    } catch {
      items.value = []
    }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(items.value)) } catch {}
  }

  function has(id: string): boolean {
    return items.value.some((i) => i.id === id)
  }

  /** Returns true when the product ended up IN the wishlist. */
  function toggle(p: RecentProduct): boolean {
    load()
    if (has(p.id)) {
      items.value = items.value.filter((i) => i.id !== p.id)
      persist()
      return false
    }
    items.value = [p, ...items.value].slice(0, MAX)
    persist()
    return true
  }

  function remove(id: string) {
    load()
    items.value = items.value.filter((i) => i.id !== id)
    persist()
  }

  const count = computed(() => items.value.length)

  return { items, count, load, has, toggle, remove }
}
