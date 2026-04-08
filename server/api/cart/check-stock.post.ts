import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'

interface CartItem {
  productId: string
  sku: string
  quantity: number
}

interface StockResult {
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

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 20, windowMs: 60_000 })

  const body = await readBody<{ items: CartItem[] }>(event)

  if (!body?.items?.length) {
    throw createError({ statusCode: 400, message: 'Cart is empty' })
  }

  // Input validation / sanitization
  for (const item of body.items) {
    if (typeof item.productId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.productId)) throw createError({ statusCode: 400, message: 'Invalid productId' })
    if (typeof item.sku !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.sku)) throw createError({ statusCode: 400, message: 'Invalid sku' })
    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity < 1) throw createError({ statusCode: 400, message: 'Invalid quantity' })
  }

  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: false, // Always fresh stock data
  })

  const productIds = [...new Set(body.items.map(i => i.productId))]
  const products = await client.fetch(
    `*[_type == "product" && _id in $ids] {
      _id, name, price, isAvailable,
      variants[]{ sku, stock, priceOverride, colorName }
    }`,
    { ids: productIds }
  )

  const productMap = new Map(products.map((p: any) => [p._id, p]))
  const results: StockResult[] = []
  let hasChanges = false

  for (const item of body.items) {
    const product = productMap.get(item.productId)

    if (!product || !product.isAvailable) {
      results.push({
        productId: item.productId,
        sku: item.sku,
        requestedQty: item.quantity,
        availableStock: 0,
        productName: product?.name?.fr || 'Unknown',
        colorName: '',
        price: 0,
        valid: false,
        message: 'product_unavailable',
      })
      hasChanges = true
      continue
    }

    const variant = product.variants?.find((v: any) => v.sku === item.sku)

    if (!variant) {
      results.push({
        productId: item.productId,
        sku: item.sku,
        requestedQty: item.quantity,
        availableStock: 0,
        productName: product.name?.fr || '',
        colorName: '',
        price: 0,
        valid: false,
        message: 'variant_not_found',
      })
      hasChanges = true
      continue
    }

    const stock = variant.stock ?? 0
    const actualQty = Math.min(item.quantity, stock)
    const price = variant.priceOverride || product.price || 0

    if (stock <= 0) {
      results.push({
        productId: item.productId,
        sku: item.sku,
        requestedQty: item.quantity,
        availableStock: 0,
        productName: product.name?.fr || '',
        colorName: variant.colorName?.fr || '',
        price,
        valid: false,
        message: 'out_of_stock',
      })
      hasChanges = true
    } else if (stock < item.quantity) {
      results.push({
        productId: item.productId,
        sku: item.sku,
        requestedQty: item.quantity,
        availableStock: stock,
        productName: product.name?.fr || '',
        colorName: variant.colorName?.fr || '',
        price,
        valid: true,
        message: 'quantity_reduced',
      })
      hasChanges = true
    } else {
      results.push({
        productId: item.productId,
        sku: item.sku,
        requestedQty: item.quantity,
        availableStock: stock,
        productName: product.name?.fr || '',
        colorName: variant.colorName?.fr || '',
        price,
        valid: true,
      })
    }
  }

  return {
    items: results,
    allValid: results.every(r => r.valid),
    hasChanges,
  }
})
