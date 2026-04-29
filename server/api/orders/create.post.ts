import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstile } from '~/server/utils/verifyTurnstile'
import { LIMITS, isValidName, isAllowedCountry, isValidProductId } from '~/server/utils/validation'
import { reservePromoUse, releasePromoUse } from '~/server/utils/promo'
import type { SanityProductForCart, OrderItem, OrderCustomerInfo } from '~/server/utils/types'
import { useDB } from '~/server/database/db'
import { orders, sessions, customers } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'
import { persistOrderPGPrimary, opportunisticOutboxFlush } from '~/server/utils/orderService'
import { dispatchOutboxEntry } from '~/server/utils/sanitySync'
import { audit } from '~/server/utils/audit'
import { logEvent } from '~/server/utils/events'

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

  // 3. RESERVE the promo BEFORE order creation (P0-01, SEC-02).
  // Atomic increment with re-validation in the retry loop closes the
  // concurrency window: two parallel orders for a maxUses=1 code cannot
  // both succeed because each retry re-reads currentUses. If order
  // creation later fails, releasePromoUse() compensates.
  // Failed reservation does not error out — the order proceeds without
  // a discount, matching prior UX for invalid codes.
  let discount = 0
  let reservedPromo: { id: string; code: string } | null = null
  if (body.promoCode) {
    const reservation = await reservePromoUse(writeClient, readClient, body.promoCode, subtotal)
    if (reservation.success && reservation.promoId && reservation.code && typeof reservation.discount === 'number') {
      discount = reservation.discount
      reservedPromo = { id: reservation.promoId, code: reservation.code }
    } else if (reservation.reason) {
      console.warn(`[ORDER] Promo "${body.promoCode}" reservation failed: ${reservation.reason}`)
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

  // ── Branch on feature flag (ADR-001 / P0-11) ─────────────────────────────
  // PG-primary path: stock locked + order inserted in one transaction; Sanity
  // is synced async via the outbox. Fail-safe: if the flag is off, fall back
  // to the existing Sanity-first dual-write code below.
  const usePgPrimary = process.env.ENABLE_PG_PRIMARY_ORDERS === 'true'

  if (usePgPrimary) {
    try {
      await persistOrderPGPrimary({
        orderNumber,
        customerSnapshot: customerInfo,
        customerId: customerInfo.customerId || null,
        guestEmail: customerInfo.email || null,
        validatedItems,
        subtotal,
        shippingCost,
        discount,
        total,
        shippingCode: body.shippingCode,
        shippingMethodLabel: shippingMethod?.name?.fr || null,
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress,
        paymentCode: body.paymentCode,
        promoCode: body.promoCode || null,
        notes: body.notes || null,
      })

      // Audit + telemetry
      await audit({
        action: 'order.create',
        actorType: customerInfo.customerId ? 'customer' : 'system',
        actorId: customerInfo.customerId || null,
        resourceType: 'order',
        resourceId: orderNumber,
        after: { orderNumber, total, paymentMethod: body.paymentCode, items: validatedItems.length },
      })
      await logEvent({
        type: 'order_created',
        customerId: customerInfo.customerId || null,
        payload: { orderNumber, total, items: validatedItems.length, promo: !!reservedPromo },
        event,
      })

      // Best-effort opportunistic Sanity sync — admin sees the order quickly
      // when this succeeds; cron drains anything left over.
      opportunisticOutboxFlush({ process: dispatchOutboxEntry, batchSize: 5, budgetMs: 4000 }).catch(() => {})

      return {
        orderNumber,
        total,
        status: 'pending',
        paymentMethod: body.paymentCode,
      }
    } catch (orderError: any) {
      // Failed AFTER promo reservation. Compensate.
      if (reservedPromo && writeClient) {
        const release = await releasePromoUse(writeClient, readClient, reservedPromo.id)
        if (!release.success) {
          console.error(
            `[ORDER ${orderNumber}] CRITICAL: promo "${reservedPromo.code}" reserved but order failed; release also failed (${release.reason}).`
          )
          await audit({
            action: 'promo.release_failed',
            resourceType: 'promo',
            resourceId: reservedPromo.id,
            metadata: { code: reservedPromo.code, reason: release.reason, orderNumber },
          })
        } else {
          await audit({
            action: 'promo.release',
            resourceType: 'promo',
            resourceId: reservedPromo.id,
            metadata: { code: reservedPromo.code, orderNumber },
          })
        }
      }

      await audit({
        action: 'order.failed',
        resourceType: 'order',
        resourceId: orderNumber,
        metadata: {
          code: orderError?.code,
          message: String(orderError?.message || orderError),
          insufficient: orderError?.insufficient,
          notFound: orderError?.notFound,
        },
      })
      await logEvent({
        type: 'order_failed',
        customerId: customerInfo.customerId || null,
        payload: { orderNumber, reason: orderError?.code || 'unknown' },
        event,
      })

      // Translate STOCK_UNAVAILABLE into a 409 the client can act on
      if (orderError?.code === 'STOCK_UNAVAILABLE') {
        throw createError({
          statusCode: 409,
          message: 'Some items are no longer available in the requested quantity. Please review your cart.',
          data: { insufficient: orderError.insufficient, notFound: orderError.notFound },
        })
      }
      throw orderError
    }
  }

  // ── Legacy Sanity-first path (default until ENABLE_PG_PRIMARY_ORDERS=true)
  // Kept intentionally as a rollback path — see ADR-001.
  try {
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
        orderNumber,
        customerId: customerInfo.customerId || null,
        guestEmail: customerInfo.email || null,
        status: 'pending',
        paymentMethod: body.paymentCode,
        items: validatedItems,
        subtotal: String(subtotal),
        shippingCost: String(shippingCost),
        discount: String(discount),
        total: String(total),
        promoCode: body.promoCode || null,
        shippingMethod: body.shippingCode,
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress || body.shippingAddress,
        customerSnapshot: customerInfo,
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

    // Audit + telemetry on legacy path too (P0-17/P0-18)
    await audit({
      action: 'order.create',
      actorType: customerInfo.customerId ? 'customer' : 'system',
      actorId: customerInfo.customerId || null,
      resourceType: 'order',
      resourceId: orderNumber,
      after: { orderNumber, total, paymentMethod: body.paymentCode, items: validatedItems.length, path: 'legacy' },
    })
    await logEvent({
      type: 'order_created',
      customerId: customerInfo.customerId || null,
      payload: { orderNumber, total, items: validatedItems.length, promo: !!reservedPromo, path: 'legacy' },
      event,
    })

    return {
      orderNumber,
      total,
      status: 'pending',
      paymentMethod: body.paymentCode,
    }
  } catch (orderError) {
    // Order creation failed AFTER reservation. Attempt to release.
    if (reservedPromo && writeClient) {
      const release = await releasePromoUse(writeClient, readClient, reservedPromo.id)
      if (!release.success) {
        console.error(
          `[ORDER ${orderNumber}] CRITICAL: promo "${reservedPromo.code}" reserved but order failed; release also failed (${release.reason}). Manual reconciliation required.`
        )
        await audit({ action: 'promo.release_failed', resourceType: 'promo', resourceId: reservedPromo.id, metadata: { code: reservedPromo.code, reason: release.reason, orderNumber } })
      } else {
        await audit({ action: 'promo.release', resourceType: 'promo', resourceId: reservedPromo.id, metadata: { code: reservedPromo.code, orderNumber } })
      }
    }
    await audit({ action: 'order.failed', resourceType: 'order', resourceId: orderNumber, metadata: { message: String(orderError) } })
    await logEvent({ type: 'order_failed', customerId: customerInfo.customerId || null, payload: { orderNumber }, event })
    throw orderError
  }
})
