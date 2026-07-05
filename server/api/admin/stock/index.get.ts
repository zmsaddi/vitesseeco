/**
 * Admin stock list — Sanity catalog (names/prices) merged with PG inventory
 * (the stock source of truth). Products without an inventory row are shown
 * as "untracked"; saving a stock value from the panel creates the row.
 */
import { createClient } from '@sanity/client'
import { useDBHttp } from '~/server/database/db'
import { inventory } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })
  await requireAdmin(event)

  const sanity = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
  })

  const [products, invRows] = await Promise.all([
    sanity.fetch(
      `*[_type == "product"]{
        _id,
        "name": coalesce(name.fr, name.en),
        "slug": slug.current,
        sku,
        price,
        "sanityStock": stock,
        isAvailable
      } | order(name asc)`
    ),
    useDBHttp().select().from(inventory),
  ])

  const invMap = new Map(invRows.map((r) => [r.productId, r]))

  const rows = (products as any[]).map((p) => {
    const inv = invMap.get(p._id)
    return {
      productId: p._id,
      name: p.name || p.slug,
      sku: p.sku || p.slug,
      price: p.price ?? null,
      isAvailable: p.isAvailable ?? true,
      sanityStock: p.sanityStock ?? null,
      stock: inv ? inv.stock : null,
      tracked: Boolean(inv),
    }
  })

  return { products: rows, total: rows.length }
})
