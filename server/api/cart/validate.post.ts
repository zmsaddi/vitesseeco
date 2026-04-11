import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { isValidProductId, LIMITS } from '~/server/utils/validation'
import type { SanityProductForCart, ValidatedCartItem, SanityShippingMethod } from '~/server/utils/types'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 20, windowMs: 60_000 })

  const body = await readBody<{ items: Array<{ productId: string; sku: string; quantity: number }>; promoCode?: string; shippingCode?: string; zone?: string }>(event)
  if (!body?.items?.length) throw createError({ statusCode: 400, message: 'Cart is empty' })
  if (body.items.length > LIMITS.MAX_CART_ITEMS) throw createError({ statusCode: 400, message: 'Too many items' })

  for (const item of body.items) {
    if (!isValidProductId(item.productId)) throw createError({ statusCode: 400, message: 'Invalid product ID' })
    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity)) throw createError({ statusCode: 400, message: 'Invalid quantity' })
  }

  const client = createClient({ projectId: '2jvnjf0c', dataset: 'production', apiVersion: '2024-01-01', useCdn: false })

  // System B: each product IS a color — no variants
  const productIds = [...new Set(body.items.map(i => i.productId))]
  const products = await client.fetch(
    `*[_type == "product" && _id in $ids]{ _id, name, price, stock, isAvailable, color, colorHex }`,
    { ids: productIds }
  )

  const productMap = new Map<string, SanityProductForCart>(products.map((p: SanityProductForCart) => [p._id, p]))
  const validatedItems: ValidatedCartItem[] = []
  let subtotal = 0

  for (const item of body.items) {
    const quantity = Math.floor(Number(item.quantity))
    if (!quantity || quantity < 1 || quantity > LIMITS.MAX_QUANTITY_PER_ITEM) {
      validatedItems.push({ productId: item.productId, sku: item.sku, name: {}, price: 0, quantity: 0, maxStock: 0, colorHex: '', colorName: {}, valid: false, error: 'Invalid quantity (1-10)' })
      continue
    }

    const product = productMap.get(item.productId)
    if (!product || !product.isAvailable) {
      validatedItems.push({ productId: item.productId, sku: item.sku, name: product?.name || {}, price: 0, quantity, maxStock: 0, colorHex: '', colorName: {}, valid: false, error: product ? 'Product unavailable' : 'Product not found' })
      continue
    }

    const stock = product.stock ?? 0
    const serverPrice = product.price || 0
    const validQuantity = Math.min(quantity, Math.max(stock, 0))

    if (stock <= 0) {
      validatedItems.push({ productId: item.productId, sku: item.sku, name: product.name || {}, price: 0, quantity: 0, maxStock: 0, colorHex: product.colorHex || '', colorName: product.color || {}, valid: false, error: 'Out of stock' })
      continue
    }

    subtotal += serverPrice * validQuantity
    validatedItems.push({ productId: item.productId, sku: item.sku, name: product.name || {}, price: serverPrice, quantity: validQuantity, maxStock: stock, colorHex: product.colorHex || '', colorName: product.color || {}, valid: true, error: validQuantity < quantity ? `Only ${stock} in stock` : undefined })
  }

  // Promo code
  let discount = 0, promoValid = false, promoMessage = ''
  if (body.promoCode) {
    const promo = await client.fetch(`*[_type == "promoCode" && code == $code && isActive == true][0]{ code, discountType, discountValue, minOrderAmount, maxUses, currentUses, validFrom, validUntil }`, { code: body.promoCode.toUpperCase().trim() })
    if (!promo) { promoMessage = 'Invalid promo code' }
    else {
      const now = new Date()
      if (promo.validFrom && new Date(promo.validFrom) > now) promoMessage = 'Promo not yet active'
      else if (promo.validUntil && new Date(promo.validUntil) < now) promoMessage = 'Promo expired'
      else if (promo.maxUses && promo.currentUses >= promo.maxUses) promoMessage = 'Promo fully used'
      else if (promo.minOrderAmount && subtotal < promo.minOrderAmount) promoMessage = `Min order: ${promo.minOrderAmount}€`
      else {
        promoValid = true
        discount = promo.discountType === 'percentage' ? Math.round(subtotal * promo.discountValue / 100) : promo.discountValue
        discount = Math.min(discount, subtotal)
      }
    }
  }

  // Shipping
  let shippingCost = 0, shippingMethod = null as SanityShippingMethod | null
  if (body.shippingCode) {
    const m = await client.fetch(`*[_type == "shippingMethod" && code == $code && isActive == true && $zone in zones][0]{ code, name, description, estimatedDays, price, freeAbove }`, { code: body.shippingCode, zone: body.zone || 'FR' })
    if (m) { shippingMethod = m; shippingCost = (m.freeAbove && subtotal >= m.freeAbove) ? 0 : (m.price || 0) }
  }

  return { items: validatedItems, subtotal, discount, shippingCost, shippingMethod, total: Math.max(0, subtotal - discount + shippingCost), promoValid, promoMessage, allValid: validatedItems.every(i => i.valid) }
})
