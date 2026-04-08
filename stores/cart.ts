import { defineStore } from 'pinia'

export interface CartItem {
  productId: string
  name: Record<string, string>
  slug: string
  price: number
  colorHex: string
  colorName: Record<string, string>
  sku: string
  quantity: number
  image?: string
}

const MAX_QUANTITY_PER_ITEM = 10
const MAX_CART_ITEMS = 20

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    promoCode: null as string | null,
    promoDiscount: 0,
    shippingCode: null as string | null,
    shippingZone: 'FR',
    shippingCost: 0,
    shippingMethod: null as any,
    // Server-validated totals (authoritative)
    serverSubtotal: null as number | null,
    serverTotal: null as number | null,
    validating: false,
    validationError: null as string | null,
  }),

  getters: {
    totalItems: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),

    // Client-side estimate (for display only — NOT for payment)
    subtotal: (state) => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),

    discount: (state) => state.promoDiscount,

    // Use server total if available, otherwise client estimate
    total(): number {
      if (this.serverTotal !== null) return this.serverTotal
      return Math.max(0, this.subtotal - this.discount + this.shippingCost)
    },

    isEmpty: (state) => state.items.length === 0,

    isValidated: (state) => state.serverTotal !== null,
  },

  actions: {
    addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
      // Validate quantity
      const safeQty = Math.max(1, Math.min(Math.floor(quantity), MAX_QUANTITY_PER_ITEM))

      // Validate price is positive
      if (!item.price || item.price <= 0) return

      const existing = this.items.find(
        (i) => i.productId === item.productId && i.sku === item.sku
      )
      if (existing) {
        existing.quantity = Math.min(existing.quantity + safeQty, MAX_QUANTITY_PER_ITEM)
      } else {
        if (this.items.length >= MAX_CART_ITEMS) return
        this.items.push({ ...item, quantity: safeQty })
      }
      // Invalidate server validation
      this._invalidateServer()
    },

    removeItem(productId: string, sku: string) {
      this.items = this.items.filter(
        (i) => !(i.productId === productId && i.sku === sku)
      )
      this._invalidateServer()
    },

    updateQuantity(productId: string, sku: string, quantity: number) {
      const item = this.items.find(
        (i) => i.productId === productId && i.sku === sku
      )
      if (item) {
        const safeQty = Math.floor(quantity)
        if (safeQty <= 0) {
          this.removeItem(productId, sku)
        } else {
          item.quantity = Math.min(safeQty, MAX_QUANTITY_PER_ITEM)
        }
        this._invalidateServer()
      }
    },

    clearCart() {
      this.items = []
      this.promoCode = null
      this.promoDiscount = 0
      this._invalidateServer()
    },

    // Check stock — call when opening cart page or before checkout
    async checkStock(): Promise<{ allValid: boolean; hasChanges: boolean; messages: string[] }> {
      if (this.items.length === 0) return { allValid: false, hasChanges: false, messages: [] }

      try {
        const result = await $fetch<any>('/api/cart/check-stock', {
          method: 'POST',
          body: {
            items: this.items.map(i => ({
              productId: i.productId,
              sku: i.sku,
              quantity: i.quantity,
            })),
          },
        })

        const messages: string[] = []

        for (const serverItem of result.items) {
          const localItem = this.items.find(
            i => i.productId === serverItem.productId && i.sku === serverItem.sku
          )

          if (!localItem) continue

          if (!serverItem.valid) {
            // Remove unavailable items
            this.items = this.items.filter(i => i !== localItem)
            messages.push(`${serverItem.productName} (${serverItem.colorName}) — removed: ${serverItem.message}`)
          } else if (serverItem.message === 'quantity_reduced') {
            // Reduce quantity to available stock
            localItem.quantity = serverItem.availableStock
            localItem.price = serverItem.price // Update price too
            messages.push(`${serverItem.productName} — quantity reduced to ${serverItem.availableStock}`)
          } else {
            // Update price from server
            localItem.price = serverItem.price
          }
        }

        return { allValid: result.allValid, hasChanges: result.hasChanges, messages }
      } catch {
        return { allValid: false, hasChanges: false, messages: ['Stock check failed'] }
      }
    },

    // Server-side validation — MUST be called before checkout
    async validateCart() {
      if (this.items.length === 0) return false

      this.validating = true
      this.validationError = null

      try {
        const result = await $fetch('/api/cart/validate', {
          method: 'POST',
          body: {
            items: this.items.map(i => ({
              productId: i.productId,
              sku: i.sku,
              quantity: i.quantity,
            })),
            promoCode: this.promoCode || undefined,
            shippingCode: this.shippingCode || undefined,
            zone: this.shippingZone,
          },
        })

        // Update cart with server-authoritative data
        for (const serverItem of result.items) {
          const localItem = this.items.find(
            i => i.productId === serverItem.productId && i.sku === serverItem.sku
          )
          if (localItem) {
            if (!serverItem.valid) {
              // Remove invalid items
              this.items = this.items.filter(i => i !== localItem)
            } else {
              // Update with server-authoritative price and quantity
              localItem.price = serverItem.price
              localItem.quantity = serverItem.quantity
              localItem.name = serverItem.name
              localItem.colorHex = serverItem.colorHex
              localItem.colorName = serverItem.colorName
            }
          }
        }

        // Set server-validated totals
        this.serverSubtotal = result.subtotal
        this.serverTotal = result.total
        this.promoDiscount = result.discount
        this.shippingCost = result.shippingCost || 0
        this.shippingMethod = result.shippingMethod || null

        if (!result.promoValid && this.promoCode) {
          this.promoCode = null
          this.promoDiscount = 0
        }

        this.validating = false
        return result.allValid
      } catch (e: any) {
        this.validationError = e.message || 'Validation failed'
        this.validating = false
        return false
      }
    },

    async applyPromoServer(code: string) {
      this.promoCode = code
      return this.validateCart()
    },

    removePromo() {
      this.promoCode = null
      this.promoDiscount = 0
      this._invalidateServer()
    },

    async selectShipping(code: string, zone = 'FR') {
      this.shippingCode = code
      this.shippingZone = zone
      return this.validateCart()
    },

    _invalidateServer() {
      this.serverSubtotal = null
      this.serverTotal = null
    },
  },

  persist: {
    // Only persist items and promoCode — NOT server-validated totals
    pick: ['items', 'promoCode', 'shippingCode', 'shippingZone'],
  },
})
