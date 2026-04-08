import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { useDB } from '~/server/database/db'
import { orders, sessions, customers } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 5, windowMs: 60_000 })

  const body = await readBody<{
    items: Array<{ productId: string; sku: string; quantity: number }>
    shippingCode: string
    paymentCode: string
    shippingAddress: {
      firstName: string; lastName: string; phone?: string
      address: string; city: string; postalCode: string; country: string
    }
    promoCode?: string
    notes?: string
  }>(event)

  if (!body?.items?.length) throw createError({ statusCode: 400, message: 'Cart is empty' })
  if (!body.shippingCode) throw createError({ statusCode: 400, message: 'Shipping method required' })
  if (!body.paymentCode) throw createError({ statusCode: 400, message: 'Payment method required' })
  if (!body.shippingAddress?.address || !body.shippingAddress?.city) {
    throw createError({ statusCode: 400, message: 'Shipping address required' })
  }

  const sanityToken = process.env.SANITY_TOKEN
  const readClient = createClient({ projectId: '2jvnjf0c', dataset: 'production', apiVersion: '2024-01-01', useCdn: false })
  const writeClient = sanityToken
    ? createClient({ projectId: '2jvnjf0c', dataset: 'production', apiVersion: '2024-01-01', useCdn: false, token: sanityToken })
    : null

  // 1. Validate all items + get server prices
  const productIds = [...new Set(body.items.map(i => i.productId))]
  const products = await readClient.fetch(
    `*[_type == "product" && _id in $ids]{ _id, name, price, isAvailable, variants[]{ sku, stock, priceOverride, colorName } }`,
    { ids: productIds }
  )
  const productMap = new Map(products.map((p: any) => [p._id, p]))

  const validatedItems: any[] = []
  let subtotal = 0

  for (const item of body.items) {
    const product = productMap.get(item.productId)
    if (!product?.isAvailable) throw createError({ statusCode: 400, message: `Product ${item.productId} unavailable` })

    const variant = product.variants?.find((v: any) => v.sku === item.sku)
    if (!variant) throw createError({ statusCode: 400, message: `Variant ${item.sku} not found` })

    if ((variant.stock ?? 0) < item.quantity) {
      throw createError({ statusCode: 400, message: `${product.name?.fr} (${variant.colorName?.fr}) — only ${variant.stock} left` })
    }

    const price = variant.priceOverride || product.price
    subtotal += price * item.quantity

    validatedItems.push({
      productId: item.productId,
      productName: product.name?.fr || '',
      color: variant.colorName?.fr || '',
      sku: item.sku,
      quantity: item.quantity,
      price,
    })
  }

  // 2. Calculate shipping
  const shippingMethod = await readClient.fetch(
    `*[_type == "shippingMethod" && code == $code && isActive == true][0]{ code, name, price, freeAbove }`,
    { code: body.shippingCode }
  )
  let shippingCost = shippingMethod?.price || 0
  if (shippingMethod?.freeAbove && subtotal >= shippingMethod.freeAbove) shippingCost = 0

  // 3. Validate promo
  let discount = 0
  if (body.promoCode) {
    const promo = await readClient.fetch(
      `*[_type == "promoCode" && code == $code && isActive == true][0]{ discountType, discountValue, minOrderAmount }`,
      { code: body.promoCode.toUpperCase().trim() }
    )
    if (promo) {
      if (!promo.minOrderAmount || subtotal >= promo.minOrderAmount) {
        discount = promo.discountType === 'percentage'
          ? Math.round(subtotal * promo.discountValue / 100)
          : promo.discountValue
        discount = Math.min(discount, subtotal)
      }
    }
  }

  const total = Math.max(0, subtotal - discount + shippingCost)

  // 4. Generate order number
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`

  // 5. Get customer info
  let customerInfo = { name: `${body.shippingAddress.firstName} ${body.shippingAddress.lastName}`, email: '', phone: body.shippingAddress.phone || '', customerId: '' }
  const token = getCookie(event, 'auth_token')
  if (token) {
    const db = useDB()
    const [session] = await db.select({ customerId: sessions.customerId }).from(sessions)
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1)
    if (session) {
      const [customer] = await db.select().from(customers).where(eq(customers.id, session.customerId)).limit(1)
      if (customer) {
        customerInfo = { name: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone || body.shippingAddress.phone || '', customerId: customer.id }
      }
    }
  }

  // 6. Create order in Sanity
  if (writeClient) {
    await writeClient.create({
      _type: 'order',
      orderNumber,
      status: body.paymentCode === 'in_store' ? 'pending' : 'pending',
      paymentMethod: body.paymentCode,
      customer: customerInfo,
      shippingAddress: body.shippingAddress,
      shippingMethod: shippingMethod?.name?.fr || body.shippingCode,
      items: validatedItems,
      subtotal,
      shippingCost,
      discount,
      total,
      promoCode: body.promoCode || null,
      notes: body.notes || null,
      createdAt: new Date().toISOString(),
    })
  }

  // 7. Create order in Postgres too
  const db = useDB()
  await db.insert(orders).values({
    customerId: customerInfo.customerId || null,
    guestEmail: customerInfo.email || null,
    status: 'pending',
    items: validatedItems,
    subtotal: String(subtotal),
    shippingCost: String(shippingCost),
    discount: String(discount),
    total: String(total),
    promoCode: body.promoCode || null,
    shippingMethod: body.shippingCode,
    shippingAddress: body.shippingAddress,
    stripePaymentId: null,
  })

  // 8. Decrement stock in Sanity
  if (writeClient) {
    for (const item of validatedItems) {
      const product = productMap.get(item.productId)
      if (!product) continue
      const variantIndex = product.variants?.findIndex((v: any) => v.sku === item.sku)
      if (variantIndex === undefined || variantIndex < 0) continue

      await writeClient
        .patch(item.productId)
        .dec({ [`variants[${variantIndex}].stock`]: item.quantity })
        .commit()
    }
  }

  return {
    orderNumber,
    total,
    status: 'pending',
    paymentMethod: body.paymentCode,
  }
})
