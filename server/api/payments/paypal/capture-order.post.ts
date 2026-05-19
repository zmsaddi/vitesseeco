/**
 * Capture a PayPal Order created via /api/orders/create.
 *
 * Flow:
 *   1. Browser receives `paypalOrderId` in /api/orders/create response.
 *   2. PayPal Smart Buttons handle the approval popup with that order id.
 *   3. On approve, the browser POSTs here with { orderNumber, paypalOrderId }.
 *   4. We GET the PayPal order to verify invoice_id matches our orderNumber
 *      (defence against a tampered client trying to capture someone else's
 *      payment).
 *   5. We POST to PayPal's capture endpoint.
 *   6. On COMPLETED, we flip the local order to 'paid' in PG + Sanity and
 *      record the capture id in the audit log.
 *
 * The webhook handler does the same flip if this endpoint never runs (closed
 * tab, browser crash) — both paths are idempotent.
 */
import { createClient } from '@sanity/client'
import { eq } from 'drizzle-orm'
import { rateLimit } from '~/server/utils/rateLimit'
import { getOrdersController, isPayPalEnabled } from '~/server/utils/paypal'
import { useDBHttp } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { audit } from '~/server/utils/audit'
import { logEvent } from '~/server/utils/events'

export default defineEventHandler(async (event) => {
  if (!isPayPalEnabled()) {
    throw createError({ statusCode: 400, message: 'PayPal is not enabled' })
  }
  rateLimit(event, { maxRequests: 10, windowMs: 60_000 })

  const body = await readBody<{ orderNumber: string; paypalOrderId: string }>(event)
  if (!body?.orderNumber || !body?.paypalOrderId) {
    throw createError({ statusCode: 400, message: 'orderNumber and paypalOrderId required' })
  }

  const ordersController = getOrdersController()

  // 1. Verify invoice_id binding before capturing — never trust the browser
  //    to tell us which local order this PayPal order belongs to.
  let lookup
  try {
    lookup = await ordersController.getOrder({ id: body.paypalOrderId })
  } catch (err) {
    console.error('[PAYPAL] getOrder failed', { paypalOrderId: body.paypalOrderId, err })
    throw createError({ statusCode: 502, message: 'Could not retrieve PayPal order' })
  }

  const invoiceId = lookup.result?.purchaseUnits?.[0]?.invoiceId
  if (invoiceId !== body.orderNumber) {
    await audit({
      action: 'paypal.capture.mismatch',
      resourceType: 'order',
      resourceId: body.orderNumber,
      metadata: { paypalOrderId: body.paypalOrderId, invoiceId: invoiceId || null },
    })
    throw createError({ statusCode: 400, message: 'PayPal order does not match local order' })
  }

  // 2. Capture.
  let captureResult
  try {
    captureResult = await ordersController.captureOrder({ id: body.paypalOrderId, prefer: 'return=minimal' })
  } catch (err: any) {
    await audit({
      action: 'paypal.capture.failed',
      resourceType: 'order',
      resourceId: body.orderNumber,
      metadata: { paypalOrderId: body.paypalOrderId, message: String(err?.message || err) },
    })
    console.error('[PAYPAL] captureOrder failed', err)
    throw createError({ statusCode: 502, message: 'Payment capture failed. You have not been charged.' })
  }

  const status = captureResult.result?.status
  const captureId = captureResult.result?.purchaseUnits?.[0]?.payments?.captures?.[0]?.id

  if (status !== 'COMPLETED') {
    await audit({
      action: 'paypal.capture.declined',
      resourceType: 'order',
      resourceId: body.orderNumber,
      metadata: { paypalOrderId: body.paypalOrderId, status: status || null },
    })
    throw createError({ statusCode: 402, message: `Payment not completed (status: ${status || 'unknown'})` })
  }

  // 3. Flip local order to paid (PG + Sanity). Idempotent — if the webhook
  //    already did this, the WHERE clause harmlessly updates an already-paid
  //    row.
  await markOrderPaid({ orderNumber: body.orderNumber, paypalOrderId: body.paypalOrderId, captureId })

  await audit({
    action: 'paypal.capture.completed',
    resourceType: 'order',
    resourceId: body.orderNumber,
    metadata: { paypalOrderId: body.paypalOrderId, captureId: captureId || null },
  })
  await logEvent({
    type: 'order_paid',
    payload: { orderNumber: body.orderNumber, paymentMethod: 'paypal' },
    event,
  })

  return { ok: true, orderNumber: body.orderNumber, status: 'paid' }
})

async function markOrderPaid(input: { orderNumber: string; paypalOrderId: string; captureId?: string }) {
  // PG
  try {
    const db = useDBHttp()
    await db
      .update(orders)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(orders.orderNumber, input.orderNumber))
  } catch (err) {
    console.error('[PAYPAL] PG mark paid failed', err)
  }

  // Sanity — patch by querying for the order doc id first. paymentMethod stays
  // 'paypal'; we add paypalOrderId / paypalCaptureId for admin visibility.
  const token = process.env.SANITY_TOKEN
  if (!token) return
  try {
    const client = createClient({
      projectId: '2jvnjf0c',
      dataset: 'production',
      apiVersion: '2024-01-01',
      useCdn: false,
      token,
    })
    const docId = await client.fetch<string | null>(
      `*[_type == "order" && orderNumber == $on][0]._id`,
      { on: input.orderNumber }
    )
    if (!docId) return
    await client
      .patch(docId)
      .set({
        status: 'paid',
        paypalOrderId: input.paypalOrderId,
        paypalCaptureId: input.captureId || null,
      })
      .commit()
  } catch (err) {
    console.error('[PAYPAL] Sanity mark paid failed', err)
  }
}
