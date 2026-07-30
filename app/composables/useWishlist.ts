/**
 * Saved products.
 *
 * Holds product ids and nothing else. No price, no name, no photograph — the
 * same rule as the basket, for a sharper reason: a wishlist is opened weeks
 * after it was filled, so anything cached beside the id would be shown as
 * current when it is not. A March price rendered on a July visit is either a
 * promise the shop has to honour or a number the customer is right to
 * distrust. The ids are re-read from the catalogue on every visit instead.
 *
 * Capped, because localStorage is a few megabytes shared with everything else
 * the site keeps, and a list nobody prunes only ever grows.
 *
 * Persisted so a customer can close the tab and come back.
 */
const STORAGE_KEY = 'vitesse.wishlist.v1'
const MAX_ITEMS = 50

/** An id long enough to be a Sanity document id and no longer. */
const MAX_ID_LENGTH = 200

export function useWishlist() {
  const ids = useState<string[]>('wishlist-ids', () => [])
  const restored = useState('wishlist-restored', () => false)

  function restore(): void {
    if (import.meta.server || restored.value) return
    restored.value = true
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      // A hand-edited or half-written value must not reach the render path.
      const stored: unknown[] = Array.isArray(raw?.ids) ? raw.ids : []
      const clean = stored.filter(
        (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH
      )
      // Duplicates would each occupy one of the fifty slots and render twice.
      ids.value = [...new Set(clean)].slice(0, MAX_ITEMS)
    } catch {
      ids.value = []
    }
  }

  function persist(): void {
    if (import.meta.server) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: ids.value }))
    } catch {
      // A full or disabled storage must not break the list in memory.
    }
  }

  /**
   * Whether a product is saved.
   *
   * Answers false until `restore()` has run, which is deliberate: that is also
   * what the server rendered, so the first client render agrees with the HTML
   * it is hydrating.
   */
  function has(productId: string): boolean {
    return ids.value.includes(productId)
  }

  function add(productId: string): void {
    restore()
    if (ids.value.includes(productId)) return
    // Newest first, and the oldest falls off when the list is full. The other
    // option — refusing the fifty-first — leaves the customer clicking a
    // control that does nothing, and between the two, the product they saved
    // fifty products ago is the weaker signal of interest.
    ids.value = [productId, ...ids.value].slice(0, MAX_ITEMS)
    persist()
  }

  function remove(productId: string): void {
    restore()
    ids.value = ids.value.filter((id) => id !== productId)
    persist()
  }

  /**
   * Flip a product in or out of the list, and report which happened.
   *
   * This is the entry point a page can call without having mounted the
   * wishlist itself — a heart on the product page, say. Every mutator restores
   * first for that reason: writing from a list that was never read back would
   * erase everything the customer had saved.
   */
  function toggle(productId: string): boolean {
    restore()
    const saved = ids.value.includes(productId)
    if (saved) remove(productId)
    else add(productId)
    return !saved
  }

  function clear(): void {
    restore()
    ids.value = []
    persist()
  }

  const count = computed(() => ids.value.length)
  const isEmpty = computed(() => ids.value.length === 0)

  return { ids, count, isEmpty, restore, has, add, remove, toggle, clear }
}
