import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { isValidProductId } from '~/server/utils/validation'
import type { StockCheckResult, SanityProductForCart } from '~/server/utils/types'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 20, windowMs: 60_000 })

  const body = await readBody<{ items: CartItem[] }>(event)
  if (!body?.items?.length) throw createError({ statusCode: 400, message: 'Cart is empty' })

  for (const item of body.items) {
    if (!isValidProductId(item.productId)) throw createError({ statusCode: 400, message: 'Invalid productId' })
    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity < 1) throw createError({ statusCode: 400, message: 'Invalid quantity' })
  }

  const client = createClient({ projectId: '2jvnjf0c', dataset: 'production', apiVersion: '2024-01-01', useCdn: false })

  const productIds = [...new Set(body.items.map(i => i.productId))]
  const products = await client.fetch(
    `*[_type == "product" && _id in $ids]{ _id, name, price, stock, isAvailable, color }`,
    { ids: productIds }
  )

  const productMap = new Map<string, SanityProductForCart>(products.map((p: SanityProductForCart) => [p._id, p]))
  const results: StockCheckResult[] = []
  let hasChanges = false

  for (const item of body.items) {
    const product = productMap.get(item.productId)

    if (!product || !product.isAvailable) {
      results.push({ productId: item.productId, sku: item.sku, requestedQty: item.quantity, availableStock: 0, productName: product?.name?.fr || 'Unknown', colorName: '', price: 0, valid: false, message: 'product_unavailable' })
      hasChanges = true
      continue
    }

    const stock = product.stock ?? 0
    const price = product.price || 0
    const colorName = product.color?.fr || ''

    if (stock <= 0) {
      results.push({ productId: item.productId, sku: item.sku, requestedQty: item.quantity, availableStock: 0, productName: product.name?.fr || '', colorName, price, valid: false, message: 'out_of_stock' })
      hasChanges = true
    } else if (stock < item.quantity) {
      results.push({ productId: item.productId, sku: item.sku, requestedQty: item.quantity, availableStock: stock, productName: product.name?.fr || '', colorName, price, valid: true, message: 'quantity_reduced' })
      hasChanges = true
    } else {
      results.push({ productId: item.productId, sku: item.sku, requestedQty: item.quantity, availableStock: stock, productName: product.name?.fr || '', colorName, price, valid: true })
    }
  }

  return { items: results, allValid: results.every(r => r.valid), hasChanges }
})
