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

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    promoCode: null as string | null,
    promoDiscount: 0,
  }),

  getters: {
    totalItems: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),

    subtotal: (state) => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),

    discount: (state) => state.promoDiscount,

    total(): number {
      return Math.max(0, this.subtotal - this.discount)
    },

    isEmpty: (state) => state.items.length === 0,
  },

  actions: {
    addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
      const existing = this.items.find(
        (i) => i.productId === item.productId && i.sku === item.sku
      )
      if (existing) {
        existing.quantity += quantity
      } else {
        this.items.push({ ...item, quantity })
      }
    },

    removeItem(productId: string, sku: string) {
      this.items = this.items.filter(
        (i) => !(i.productId === productId && i.sku === sku)
      )
    },

    updateQuantity(productId: string, sku: string, quantity: number) {
      const item = this.items.find(
        (i) => i.productId === productId && i.sku === sku
      )
      if (item) {
        if (quantity <= 0) {
          this.removeItem(productId, sku)
        } else {
          item.quantity = quantity
        }
      }
    },

    clearCart() {
      this.items = []
      this.promoCode = null
      this.promoDiscount = 0
    },

    applyPromo(code: string, discount: number) {
      this.promoCode = code
      this.promoDiscount = discount
    },

    removePromo() {
      this.promoCode = null
      this.promoDiscount = 0
    },
  },

  persist: true,
})
