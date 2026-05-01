/**
 * Outbox dispatcher — translates outbox entries to Sanity mutations (P0-12).
 *
 * Only this module knows how to talk to Sanity for write side-effects derived
 * from PG primary state. Adding new outbox kinds means adding a case here.
 */

import { createClient } from '@sanity/client'
import { eq } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { inventory } from '~/server/database/schema'
import type { OutboxKind } from '~/server/utils/outbox'

let cachedClient: ReturnType<typeof createClient> | null = null

function getWriteClient() {
  if (cachedClient) return cachedClient
  const token = process.env.SANITY_TOKEN
  if (!token) throw new Error('SANITY_TOKEN is not set; cannot dispatch outbox to Sanity')
  cachedClient = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    token,
    apiVersion: '2024-01-01',
    useCdn: false,
  })
  return cachedClient
}

export async function dispatchOutboxEntry(entry: { kind: string; payload: any }): Promise<void> {
  const client = getWriteClient()
  const kind = entry.kind as OutboxKind

  switch (kind) {
    case 'sanity.order.create': {
      // Idempotent: if an order with the same orderNumber already exists in
      // Sanity (because a previous attempt partially succeeded), skip.
      const orderNumber = entry.payload?.orderNumber
      if (typeof orderNumber === 'string') {
        const existing = await client.fetch(
          `*[_type == "order" && orderNumber == $n][0]{ _id }`,
          { n: orderNumber }
        )
        if (existing?._id) return
      }
      await client.create({ _type: 'order', ...entry.payload })
      return
    }

    case 'sanity.inventory.patch': {
      // payload: { productId } — stock is read fresh from PG at dispatch time
      // because PG is the source of truth post-activation. Putting stock in the
      // payload would freeze the value at enqueue time and cause drift if a
      // later order decremented again before the cron drained the earlier
      // entry. Reading at dispatch makes Sanity converge on the latest value.
      const { productId } = entry.payload as { productId: string }
      if (!productId || typeof productId !== 'string') {
        throw new Error(`invalid inventory.patch payload: missing productId — ${JSON.stringify(entry.payload)}`)
      }

      const db = useDBHttp()
      const rows = await db
        .select({ stock: inventory.stock })
        .from(inventory)
        .where(eq(inventory.productId, productId))
        .limit(1)

      if (rows.length === 0) {
        // Throwing keeps the entry in the outbox; retry/backoff covers the
        // case where the inventory row is created after enqueue (e.g., backfill
        // running concurrently with first orders). After PERMANENT_FAIL_AFTER
        // attempts the entry is marked failed for manual reconciliation.
        throw new Error(`inventory row not found for productId=${productId}`)
      }

      await client.patch(productId).set({ stock: rows[0].stock }).commit()
      return
    }

    case 'sanity.promo.increment': {
      const { promoId } = entry.payload as { promoId: string }
      if (!promoId) throw new Error('invalid promo.increment payload')
      // Best effort — promo currentUses is already authoritative in Sanity
      // since P0-01. This kind is reserved for a future refactor.
      await client.patch(promoId).inc({ currentUses: 1 }).commit()
      return
    }

    case 'sanity.promo.decrement': {
      const { promoId } = entry.payload as { promoId: string }
      if (!promoId) throw new Error('invalid promo.decrement payload')
      await client.patch(promoId).dec({ currentUses: 1 }).commit()
      return
    }

    default:
      throw new Error(`unknown outbox kind: ${kind}`)
  }
}
