import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'

interface CartItemInput {
  productId: string
  sku: string
  quantity: number
}

interface ValidatedItem {
  productId: string
  sku: string
  name: Record<string, string>
  price: number
  quantity: number
  maxStock: number
  colorHex: string
  colorName: Record<string, string>
  valid: boolean
  error?: string
}

export default defineEventHandler(async (event) => {
  // Rate limit: 20 requests per minute per IP
  rateLimit(event, { maxRequests: 20, windowMs: 60_000 })

  const body = await readBody<{ items: CartItemInput[]; promoCode?: string; shippingCode?: string; zone?: string }>(event)

  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, message: 'Cart is empty' })
  }

  // Limit cart size
  if (body.items.length > 20) {
    throw createError({ statusCode: 400, message: 'Too many items in cart' })
  }

  // Sanitize inputs — reject anything that's not a clean string/number
  for (const item of body.items) {
    if (typeof item.productId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.productId)) {
      throw createError({ statusCode: 400, message: 'Invalid product ID' })
    }
    if (typeof item.sku !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.sku)) {
      throw createError({ statusCode: 400, message: 'Invalid SKU' })
    }
    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity)) {
      throw createError({ statusCode: 400, message: 'Invalid quantity' })
    }
  }
  if (body.promoCode && (typeof body.promoCode !== 'string' || body.promoCode.length > 50)) {
    throw createError({ statusCode: 400, message: 'Invalid promo code' })
  }

  const config = useRuntimeConfig()
  const client = createClient({
    projectId: config.public.sanityProjectId || '2jvnjf0c',
    dataset: config.public.sanityDataset || 'production',
    apiVersion: '2024-01-01',
    useCdn: false, // Always fresh data for validation
  })

  // Fetch all referenced products from Sanity in one query
  const productIds = [...new Set(body.items.map(i => i.productId))]
  const products = await client.fetch(
    `*[_type == "product" && _id in $ids] {
      _id, name, price, compareAtPrice, isOnSale, isAvailable,
      variants[]{ sku, stock, priceOverride, colorHex, colorName }
    }`,
    { ids: productIds }
  )

  const productMap = new Map<string, any>(products.map((p: any) => [p._id, p]))

  const validatedItems: ValidatedItem[] = []
  let subtotal = 0

  for (const item of body.items) {
    // Validate quantity
    const quantity = Math.floor(Number(item.quantity))
    if (!quantity || quantity < 1 || quantity > 10) {
      validatedItems.push({
        productId: item.productId,
        sku: item.sku,
        name: {},
        price: 0,
        quantity: 0,
        maxStock: 0,
        colorHex: '',
        colorName: {},
        valid: false,
        error: 'Invalid quantity (1-10)',
      })
      continue
    }

    const product = productMap.get(item.productId)
    if (!product) {
      validatedItems.push({
        productId: item.productId,
        sku: item.sku,
        name: {},
        price: 0,
        quantity,
        maxStock: 0,
        colorHex: '',
        colorName: {},
        valid: false,
        error: 'Product not found',
      })
      continue
    }

    if (!product.isAvailable) {
      validatedItems.push({
        productId: item.productId,
        sku: item.sku,
        name: product.name || {},
        price: 0,
        quantity,
        maxStock: 0,
        colorHex: '',
        colorName: {},
        valid: false,
        error: 'Product unavailable',
      })
      continue
    }

    // Find variant by SKU
    const variant = product.variants?.find((v: any) => v.sku === item.sku)
    if (!variant) {
      validatedItems.push({
        productId: item.productId,
        sku: item.sku,
        name: product.name || {},
        price: 0,
        quantity,
        maxStock: 0,
        colorHex: '',
        colorName: {},
        valid: false,
        error: 'Variant not found',
      })
      continue
    }

    // Check stock
    const stock = variant.stock ?? 0
    const validQuantity = Math.min(quantity, stock)

    if (stock <= 0) {
      validatedItems.push({
        productId: item.productId,
        sku: item.sku,
        name: product.name || {},
        price: 0,
        quantity: 0,
        maxStock: 0,
        colorHex: variant.colorHex || '',
        colorName: variant.colorName || {},
        valid: false,
        error: 'Out of stock',
      })
      continue
    }

    // SERVER-AUTHORITATIVE PRICE — never trust client price
    const serverPrice = variant.priceOverride || product.price || 0

    subtotal += serverPrice * validQuantity

    validatedItems.push({
      productId: item.productId,
      sku: item.sku,
      name: product.name || {},
      price: serverPrice,
      quantity: validQuantity,
      maxStock: stock,
      colorHex: variant.colorHex || '',
      colorName: variant.colorName || {},
      valid: true,
      error: validQuantity < quantity ? `Only ${stock} in stock` : undefined,
    })
  }

  // Validate promo code server-side
  let discount = 0
  let promoValid = false
  let promoMessage = ''

  if (body.promoCode) {
    const promo = await client.fetch(
      `*[_type == "promoCode" && code == $code && isActive == true][0] {
        code, discountType, discountValue, minOrderAmount, maxUses, currentUses,
        validFrom, validUntil
      }`,
      { code: body.promoCode.toUpperCase().trim() }
    )

    if (!promo) {
      promoMessage = 'Invalid promo code'
    } else {
      const now = new Date()
      if (promo.validFrom && new Date(promo.validFrom) > now) {
        promoMessage = 'Promo code not yet active'
      } else if (promo.validUntil && new Date(promo.validUntil) < now) {
        promoMessage = 'Promo code expired'
      } else if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        promoMessage = 'Promo code fully used'
      } else if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
        promoMessage = `Minimum order: ${promo.minOrderAmount}€`
      } else {
        promoValid = true
        if (promo.discountType === 'percentage') {
          discount = Math.round(subtotal * promo.discountValue / 100)
        } else {
          discount = promo.discountValue
        }
        discount = Math.min(discount, subtotal) // Never negative total
      }
    }
  }

  // Shipping calculation
  let shippingCost = 0
  let shippingMethod = null as any
  const zone = body.zone || 'FR'

  if (body.shippingCode) {
    const methods = await client.fetch(
      `*[_type == "shippingMethod" && code == $code && isActive == true && $zone in zones][0] {
        code, name, description, estimatedDays, price, freeAbove
      }`,
      { code: body.shippingCode, zone }
    )

    if (methods) {
      shippingMethod = methods
      // Free shipping if subtotal >= freeAbove threshold
      if (methods.freeAbove && subtotal >= methods.freeAbove) {
        shippingCost = 0
      } else {
        shippingCost = methods.price || 0
      }
    }
  }

  const total = Math.max(0, subtotal - discount + shippingCost)

  return {
    items: validatedItems,
    subtotal,
    discount,
    shippingCost,
    shippingMethod,
    total,
    promoValid,
    promoMessage,
    allValid: validatedItems.every(i => i.valid),
  }
})
