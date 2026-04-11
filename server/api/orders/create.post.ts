import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstile } from '~/server/utils/verifyTurnstile'
import { LIMITS, isValidName, isAllowedCountry, isValidProductId } from '~/server/utils/validation'
import type { SanityProductForCart, OrderItem, OrderCustomerInfo } from '~/server/utils/types'
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
    billingAddress?: {
      firstName: string; lastName: string; phone?: string
      address: string; city: string; postalCode: string; country: string
    }
    promoCode?: string
    notes?: string
    turnstileToken?: string
  }>(event)

  // Verify Turnstile
  if (!body?.turnstileToken) {
    throw createError({ statusCode: 400, message: 'CAPTCHA token required' })
  }
  const turnstileValid = await verifyTurnstile(body.turnstileToken)
  if (!turnstileValid) throw createError({ statusCode: 400, message: 'CAPTCHA verification failed' })

  if (!body?.items?.length) throw createError({ statusCode: 400, message: 'Cart is empty' })
  if (!body.shippingCode) throw createError({ statusCode: 400, message: 'Shipping method required' })
  if (!body.paymentCode) throw createError({ statusCode: 400, message: 'Payment method required' })
  if (!body.shippingAddress?.address || !body.shippingAddress?.city) {
    throw createError({ statusCode: 400, message: 'Shipping address required' })
  }
  if (body.notes && body.notes.length > LIMITS.MAX_NOTE_LENGTH) {
    throw createError({ statusCode: 400, message: 'Notes too long' })
  }

  // Validate shipping address fields
  const addr = body.shippingAddress
  if (!isValidName(addr.firstName)) throw createError({ statusCode: 400, message: 'Invalid first name' })
  if (!isValidName(addr.lastName)) throw createError({ statusCode: 400, message: 'Invalid last name' })
  if (!addr.postalCode) throw createError({ statusCode: 400, message: 'Postal code required' })
  if (!addr.country || !isAllowedCountry(addr.country)) {
    throw createError({ statusCode: 400, message: 'Invalid or unsupported country' })
  }

  const sanityToken = process.env.SANITY_TOKEN
  const readClient = createClient({ projectId: '2jvnjf0c', dataset: 'production', apiVersion: '2024-01-01', useCdn: false })
  const writeClient = sanityToken
    ? createClient({ projectId: '2jvnjf0c', dataset: 'production', apiVersion: '2024-01-01', useCdn: false, token: sanityToken })
    : null

  // 1. Validate all items + get server prices (System B: no variants)
  const productIds = [...new Set(body.items.filter(i => isValidProductId(i.productId)).map(i => i.productId))]
  if (productIds.length === 0) throw createError({ statusCode: 400, message: 'No valid product IDs' })

  const products: SanityProductForCart[] = await readClient.fetch(
    `*[_type == "product" && _id in $ids]{ _id, name, price, stock, isAvailable, color, slug }`,
    { ids: productIds }
  )
  const productMap = new Map<string, SanityProductForCart>(products.map((p) => [p._id, p]))

  const validatedItems: OrderItem[] = []
  let subtotal = 0

  for (const item of body.items) {
    const product = productMap.get(item.productId)
    if (!product?.isAvailable) throw createError({ statusCode: 400, message: `Product ${item.productId} unavailable` })

    if ((product.stock ?? 0) < item.quantity) {
      throw createError({ statusCode: 400, message: `${product.name?.fr} — only ${product.stock} left` })
    }

    const price = product.price
    subtotal += price * item.quantity

    validatedItems.push({
      _key: `item-${((product as any).slug?.current || item.productId).slice(0, 20)}-${Date.now()}`,
      productId: item.productId,
      productName: product.name?.fr || '',
      color: product.color?.fr || '',
      sku: (product as any).slug?.current || item.productId,
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
  let customerInfo: OrderCustomerInfo = { name: `${body.shippingAddress.firstName} ${body.shippingAddress.lastName}`, email: '', phone: body.shippingAddress.phone || '', customerId: '' }
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

  // 6. Create order in Sanity (primary source — dashboard uses this)
  if (writeClient) {
    await writeClient.create({
      _type: 'order',
      orderNumber,
      status: body.paymentCode === 'in_store' ? 'pending' : 'pending',
      paymentMethod: body.paymentCode,
      customer: customerInfo,
      shippingAddress: body.shippingAddress,
      billingAddress: body.billingAddress || body.shippingAddress,
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

  // 7. Create order in Postgres too (secondary — for relational queries)
  try {
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
  } catch (pgError) {
    // Log but don't fail — Sanity order exists and is the dashboard source
    console.error(`[ORDER] PostgreSQL write failed for ${orderNumber}:`, pgError)
  }

  // 8. Decrement stock in Sanity (System B: direct product.stock)
  // Uses ifRevisionId for optimistic locking to prevent race conditions
  if (writeClient) {
    for (const item of validatedItems) {
      // Get current revision for optimistic lock
      const current = await readClient.fetch(
        `*[_type == "product" && _id == $id][0]{ _rev, stock }`,
        { id: item.productId }
      )

      if (!current || (current.stock ?? 0) < item.quantity) {
        console.error(`[ORDER] Stock insufficient for ${item.sku} at decrement time (have: ${current?.stock}, need: ${item.quantity})`)
        continue // Skip decrement — order is already created, handle via support
      }

      try {
        await writeClient
          .patch(item.productId)
          .ifRevisionId(current._rev) // Optimistic lock — fails if document changed
          .dec({ stock: item.quantity })
          .commit()
      } catch (patchError: unknown) {
        // Revision conflict — another request modified this product simultaneously
        // Retry once with fresh revision
        try {
          const fresh = await readClient.fetch(
            `*[_type == "product" && _id == $id][0]{ _rev, stock }`,
            { id: item.productId }
          )
          if (fresh && (fresh.stock ?? 0) >= item.quantity) {
            await writeClient
              .patch(item.productId)
              .ifRevisionId(fresh._rev)
              .dec({ stock: item.quantity })
              .commit()
          } else {
            console.error(`[ORDER] Stock race confirmed for ${item.sku}, insufficient after retry`)
          }
        } catch (retryError) {
          console.error(`[ORDER] Stock decrement failed for ${item.sku} after retry:`, retryError)
        }
      }
    }
  }

  return {
    orderNumber,
    total,
    status: 'pending',
    paymentMethod: body.paymentCode,
  }
})
