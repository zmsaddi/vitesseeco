/**
 * PayPal webhook receiver.
 *
 * Acts as the safety net for the capture endpoint: if the customer's tab
 * closes between PayPal approval and our capture call, PayPal still notifies
 * us via webhook so the order eventually flips to 'paid'.
 *
 * Idempotent — re-receiving the same event after we have already marked the
 * order paid is a no-op.
 *
 * Always returns 200 on a signed event (even ones we don't care about) so
 * PayPal does not enter exponential-backoff retry loops. Unsigned / invalid
 * events return 400.
 */
import { createClient } from '@sanity/client'
import { and, eq } from 'drizzle-orm'
import { paypalAdapter } from '~/server/payments/adapters/paypal'
import { isPayPalEnabled } from '~/server/utils/paypal'
import { useDBHttp } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { audit } from '~/server/utils/audit'
import { enqueueOutbox } from '~/server/utils/outbox'

export default defineEventHandler(async (event) => {
  if (!isPayPalEnabled()) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  if (!paypalAdapter.verifyWebhook) {
    throw createError({ statusCode: 500, message: 'webhook handler not registered' })
  }

  // Record the inbound attempt so we can tell apart "PayPal never hit us" from
  // "PayPal hit us but signature failed" — important during webhook setup.
  await audit({
    action: 'paypal.webhook.received',
    resourceType: 'webhook',
    metadata: {
      headers: {
        'paypal-transmission-id': event.node.req.headers['paypal-transmission-id'] || null,
        'paypal-cert-url': event.node.req.headers['paypal-cert-url'] || null,
      },
      ua: event.node.req.headers['user-agent'] || null,
    },
  })

  const result = await paypalAdapter.verifyWebhook(event)
  if (!result.ok) {
    await audit({
      action: 'paypal.webhook.signature_failed',
      resourceType: 'webhook',
    })
    throw createError({ statusCode: 400, message: 'Invalid webhook signature' })
  }

  if (!result.orderNumber || result.newStatus !== 'paid') {
    // Verified but not an event we act on (e.g., APPROVED with no invoice_id,
    // or non-completion events). Acknowledge to stop retries.
    return { ok: true, handled: false }
  }

  // Idempotent, forward-only paid flip — PG + Sanity. The capture endpoint may
  // have already run, and PayPal redelivers this event for up to 3 days, so the
  // status predicate keeps a late redelivery from pulling an order an admin
  // already moved to processing/shipped/cancelled back to 'paid'.
  try {
    const db = useDBHttp()
    await db
      .update(orders)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(and(eq(orders.orderNumber, result.orderNumber), eq(orders.status, 'pending')))
  } catch (err) {
    console.error('[PAYPAL webhook] PG update failed', err)
  }

  const token = process.env.SANITY_TOKEN
  if (token) {
    try {
      const client = createClient({
        projectId: '2jvnjf0c',
        dataset: 'production',
        apiVersion: '2024-01-01',
        useCdn: false,
        token,
      })
      const doc = await client.fetch<{ _id: string; status: string | null } | null>(
        `*[_type == "order" && orderNumber == $on][0]{ _id, status }`,
        { on: result.orderNumber }
      )
      if (!doc?._id) {
        // Mirror doc not created yet — this webhook raced the outbox cron that
        // creates it. Hand the flip to the outbox so its retry/backoff converges
        // once the doc exists, instead of dropping it and leaving Studio on
        // 'pending' forever.
        await enqueueOutbox(useDBHttp(), {
          kind: 'sanity.order.patch',
          payload: { orderNumber: result.orderNumber },
        })
      } else if (doc.status === 'pending') {
        await client.patch(doc._id).set({ status: 'paid' }).commit()
      }
    } catch (err) {
      console.error('[PAYPAL webhook] Sanity update failed', err)
    }
  }

  await audit({
    action: 'paypal.webhook.paid',
    resourceType: 'order',
    resourceId: result.orderNumber,
    metadata: { source: 'webhook' },
  })

  return { ok: true, handled: true }
})
