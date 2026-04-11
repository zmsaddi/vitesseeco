/**
 * Shared type definitions for server-side code.
 * These interfaces define the contracts between layers.
 */

// ═══════ SANITY PRODUCT (from GROQ queries) ═══════

export interface SanityLocalizedString {
  fr?: string
  en?: string
  es?: string
  nl?: string
  de?: string
  ar?: string
}

export interface SanityProduct {
  _id: string
  name: SanityLocalizedString
  slug: { current: string }
  price: number
  compareAtPrice?: number
  stock: number
  isAvailable: boolean
  color?: SanityLocalizedString
  colorHex?: string
  modelFamily?: string
  productType?: string
  brand?: { name: string }
  images?: Array<{ asset: { _ref: string } }>
}

export interface SanityProductForCart {
  _id: string
  name: SanityLocalizedString
  price: number
  stock: number
  isAvailable: boolean
  color?: SanityLocalizedString
  colorHex?: string
}

// ═══════ SANITY PROMO CODE ═══════

export interface SanityPromoCode {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minOrderAmount?: number
  maxUses?: number
  currentUses?: number
  validFrom?: string
  validUntil?: string
  isActive: boolean
}

// ═══════ SANITY SHIPPING METHOD ═══════

export interface SanityShippingMethod {
  code: string
  name: SanityLocalizedString
  description?: SanityLocalizedString
  estimatedDays?: string
  price: number
  freeAbove?: number
}

// ═══════ ORDER ═══════

export interface OrderItem {
  _key: string
  productId: string
  productName: string
  color: string
  sku: string
  quantity: number
  price: number
}

export interface OrderAddress {
  firstName: string
  lastName: string
  phone?: string
  address: string
  city: string
  postalCode: string
  country: string
}

export interface OrderCustomerInfo {
  name: string
  email: string
  phone: string
  customerId: string
}

// ═══════ VALIDATED CART ITEM ═══════

export interface ValidatedCartItem {
  productId: string
  sku: string
  name: SanityLocalizedString
  price: number
  quantity: number
  maxStock: number
  colorHex: string
  colorName: SanityLocalizedString
  valid: boolean
  error?: string
}

// ═══════ STOCK CHECK RESULT ═══════

export interface StockCheckResult {
  productId: string
  sku: string
  requestedQty: number
  availableStock: number
  productName: string
  colorName: string
  price: number
  valid: boolean
  message?: string
}

// ═══════ API ERROR ═══════

export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
  field?: string
  details?: unknown
}

/** Error codes used across the API */
export const ERROR_CODES = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  // Cart
  CART_EMPTY: 'CART_EMPTY',
  INVALID_PRODUCT: 'INVALID_PRODUCT',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  STOCK_INSUFFICIENT: 'STOCK_INSUFFICIENT',
  // Checkout
  CAPTCHA_REQUIRED: 'CAPTCHA_REQUIRED',
  CAPTCHA_FAILED: 'CAPTCHA_FAILED',
  SHIPPING_REQUIRED: 'SHIPPING_REQUIRED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  ADDRESS_INVALID: 'ADDRESS_INVALID',
  COUNTRY_UNSUPPORTED: 'COUNTRY_UNSUPPORTED',
  // Promo
  PROMO_INVALID: 'PROMO_INVALID',
  PROMO_EXPIRED: 'PROMO_EXPIRED',
  PROMO_NOT_ACTIVE: 'PROMO_NOT_ACTIVE',
  PROMO_FULLY_USED: 'PROMO_FULLY_USED',
  PROMO_MIN_ORDER: 'PROMO_MIN_ORDER',
  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const
