/**
 * Admin stock set — writes PG inventory (source of truth), audit-logs the
 * change, and queues the existing sanity.inventory.patch outbox kind so the
 * Sanity catalog converges to the PG value.
 *
 * Upserts: products created before inventory backfill get their row on first
 * save from the panel.
 */
import { eq, sql } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { inventory } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'
import { audit } from '~/server/utils/audit'
import { enqueueOutbox } from '~/server/utils/outbox'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })
  const admin = await requireAdmin(event)

  const productId = getRouterParam(event, 'productId')
  if (!productId || !/^[a-zA-Z0-9_.-]{1,200}$/.test(productId) || productId.startsWith('drafts.')) {
    throw createError({ statusCode: 400, message: 'Invalid product id' })
  }

  const body = await readBody(event)
  const stock = Number(body?.stock)
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
    throw createError({ statusCode: 400, message: 'Invalid stock value' })
  }
  const sku = typeof body?.sku === 'string' ? body.sku.slice(0, 100) : null

  const db = useDBHttp()
  const [before] = await db
    .select({ stock: inventory.stock })
    .from(inventory)
    .where(eq(inventory.productId, productId))
    .limit(1)

  await db
    .insert(inventory)
    .values({ productId, sku, stock, version: 1 })
    .onConflictDoUpdate({
      target: inventory.productId,
      set: {
        stock,
        version: sql`${inventory.version} + 1`,
        updatedAt: new Date(),
        ...(sku ? { sku } : {}),
      },
    })

  await audit({
    actorType: 'admin',
    actorId: admin.email,
    action: 'inventory.admin_set',
    resourceType: 'product',
    resourceId: productId,
    before: { stock: before?.stock ?? null },
    after: { stock },
    metadata: { sku },
  })

  await enqueueOutbox(db, {
    kind: 'sanity.inventory.patch',
    payload: { productId },
  })

  return { ok: true, productId, stock }
})
