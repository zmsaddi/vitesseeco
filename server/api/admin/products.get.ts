/**
 * The catalogue as the owner manages it: what it costs, and how many we have.
 *
 * Price comes from Sanity, which owns catalogue content; sellable quantity
 * comes from Postgres, which owns stock. Joining them here means one screen
 * answers both questions without the owner holding two tools open.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { sanity } from '../../catalog/client'
import { db } from '../../db/client'
import { readAvailability } from '../../services/stock'

interface Row {
  id: string
  slug: string
  name: string
  color: string | null
  image: string | null
  price: number
  compareAtPrice: number | null
  isAvailable: boolean
  productType: string | null
}

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: z
    .object({
      search: z.string().trim().max(80).optional(),
      lowStockOnly: z.coerce.boolean().optional(),
    })
    .strict(),
  handler: async ({ query }) => {
    // Drafts are excluded: an unpublished edit is not what the shop is selling.
    const rows = await sanity().fetch<Row[]>(
      `*[_type == "product" && defined(slug.current)${query.search ? ' && (name.fr match $term || sku match $term)' : ''}]
        | order(coalesce(sortOrder, 0) asc, name.fr asc) [0...500] {
          "id": _id,
          "slug": slug.current,
          "name": coalesce(name.fr, name.en),
          "color": color.fr,
          "image": images[0].asset->url,
          price,
          compareAtPrice,
          isAvailable,
          productType
        }`,
      query.search ? { term: `${query.search}*` } : {}
    )

    const availability = await readAvailability(db(), rows.map((row) => row.id))

    const items = rows.map((row) => ({
      ...row,
      onHand: availability.get(row.id)?.onHand ?? 0,
      reserved: availability.get(row.id)?.reserved ?? 0,
      available: availability.get(row.id)?.available ?? 0,
    }))

    return {
      items: query.lowStockOnly ? items.filter((item) => item.available <= 5) : items,
      total: items.length,
    }
  },
})
