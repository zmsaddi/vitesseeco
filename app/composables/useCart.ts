/**
 * The basket.
 *
 * Holds product ids and quantities, and nothing else. No price, no total, no
 * discount — those are asked of the server, which is the only place that may
 * decide them. A basket restored from a previous visit therefore cannot carry a
 * stale price into a checkout, because it never carried one.
 *
 * Persisted to localStorage so a customer can close the tab and come back.
 */
const STORAGE_KEY = 'vitesse.cart.v1'
const MAX_LINES = 20
const MAX_PER_LINE = 10

export interface CartLine {
  productId: string
  quantity: number
}

/** What the server said this basket costs, refreshed whenever it changes. */
export interface CartPricing {
  lines: Array<{
    productId: string
    slug: string
    name: string
    color: string | null
    image: string | null
    unitPrice: string
    quantity: number
    lineTotal: string
    available: number
  }>
  subtotal: string
  discount: string
  total: string
  promo: { code: string; applied: boolean; reason?: string } | null
}

export function useCart() {
  const lines = useState<CartLine[]>('cart-lines', () => [])
  const promoCode = useState<string | null>('cart-promo', () => null)
  const restored = useState('cart-restored', () => false)

  function restore(): void {
    if (import.meta.server || restored.value) return
    restored.value = true
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      // A hand-edited or half-written value must not reach the render path.
      const stored = Array.isArray(raw?.lines) ? raw.lines : []
      lines.value = stored
        .filter(
          (line: unknown): line is CartLine =>
            typeof (line as CartLine)?.productId === 'string' &&
            Number.isInteger((line as CartLine)?.quantity) &&
            (line as CartLine).quantity > 0
        )
        .slice(0, MAX_LINES)
      promoCode.value = typeof raw?.promoCode === 'string' ? raw.promoCode : null
    } catch {
      lines.value = []
      promoCode.value = null
    }
  }

  function persist(): void {
    if (import.meta.server) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines: lines.value, promoCode: promoCode.value }))
    } catch {
      // A full or disabled storage must not break the basket in memory.
    }
  }

  /**
   * Returns whether the basket accepted the product.
   *
   * It used to return nothing and bail silently at the line cap, so the page
   * had no way to tell a refusal from a success — and announced "added" for a
   * bike that never entered the basket. A caller must be able to see the
   * difference, which is why this answers rather than just acting.
   */
  function add(productId: string, quantity = 1): boolean {
    restore()
    const existing = lines.value.find((line) => line.productId === productId)
    if (existing) {
      existing.quantity = Math.min(MAX_PER_LINE, existing.quantity + quantity)
    } else {
      if (lines.value.length >= MAX_LINES) return false
      lines.value.push({ productId, quantity: Math.min(MAX_PER_LINE, Math.max(1, quantity)) })
    }
    persist()
    return true
  }

  function setQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) return remove(productId)
    const line = lines.value.find((entry) => entry.productId === productId)
    if (line) {
      line.quantity = Math.min(MAX_PER_LINE, Math.floor(quantity))
      persist()
    }
  }

  function remove(productId: string): void {
    lines.value = lines.value.filter((line) => line.productId !== productId)
    persist()
  }

  function clear(): void {
    lines.value = []
    promoCode.value = null
    persist()
  }

  function applyPromo(code: string | null): void {
    promoCode.value = code?.trim().toUpperCase() || null
    persist()
  }

  const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
  const isEmpty = computed(() => lines.value.length === 0)

  return { lines, promoCode, count, isEmpty, restore, add, setQuantity, remove, clear, applyPromo }
}
