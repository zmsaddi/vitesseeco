/**
 * Edit a product's price from the panel.
 *
 * The write goes to Sanity, which owns catalogue content — the panel is a
 * faster door into the same room, not a second source of truth.
 *
 * Two consequences are handled here rather than discovered later:
 *
 *  - The catalogue cache is dropped immediately. Merchant Center crawls the
 *    landing page and compares it to the feed, and a price that disagrees
 *    between the two is one of the commonest reasons an item is disapproved.
 *  - Orders already placed are unaffected. They were priced when they were
 *    made and the amount is held at the payment provider, so a price change
 *    cannot alter what a customer is charged mid-checkout.
 */
import { z } from 'zod'
import { getRouterParam } from 'h3'
import { defineRoute } from '../../../security/handler'
import { invalidateCatalogCache, sanity } from '../../../catalog/client'
import { AppError, ERROR_CODES } from '../../../../shared/errors'
import { audit } from '../../../services/audit'
import { fromEuros } from '../../../../shared/money'

const bodySchema = z
  .object({
    // Authored in euros, as the owner thinks of it. Two decimals maximum:
    // anything finer cannot be charged.
    price: z.number().min(0).max(1_000_000).multipleOf(0.01).optional(),
    compareAtPrice: z.number().min(0).max(1_000_000).multipleOf(0.01).nullable().optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'nothing to change')

/** Sanity document id. Drafts are refused — the shop sells published documents. */
const idSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  .refine((value) => !value.startsWith('drafts.'), 'drafts are not editable here')

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  body: bodySchema,
  handler: async ({ event, body, customer }) => {
    const id = idSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new AppError(ERROR_CODES.NOT_FOUND, { internal: 'malformed product id' })

    const client = sanity()
    const before = await client.fetch<{ price: number; compareAtPrice: number | null; isAvailable: boolean; name: string } | null>(
      `*[_id == $id][0]{ price, compareAtPrice, isAvailable, "name": coalesce(name.fr, name.en) }`,
      { id: id.data }
    )
    if (!before) throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `no product ${id.data}` })

    const nextPrice = body.price ?? before.price
    const nextCompare = body.compareAtPrice === undefined ? before.compareAtPrice : body.compareAtPrice

    // A "was" price that is not actually higher advertises a discount that does
    // not exist, which is a misrepresentation wherever the feed is read.
    if (nextCompare !== null && nextCompare !== undefined && nextCompare <= nextPrice) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
        details: { issues: [{ path: 'compareAtPrice', message: 'errors.compare_price_not_higher' }] },
        internal: `compareAtPrice ${nextCompare} is not above price ${nextPrice}`,
      })
    }

    // Proves the amount survives the trip through cents without drifting.
    fromEuros(nextPrice)

    const patch: Record<string, unknown> = {}
    if (body.price !== undefined) patch.price = body.price
    if (body.isAvailable !== undefined) patch.isAvailable = body.isAvailable

    let mutation = client.patch(id.data).set(patch)
    if (body.compareAtPrice === null) mutation = mutation.unset(['compareAtPrice'])
    else if (body.compareAtPrice !== undefined) mutation = mutation.set({ compareAtPrice: body.compareAtPrice })

    await mutation.commit()

    // Without this the storefront and the feed keep serving the old figure for
    // up to a minute, which is exactly the window a crawl can land in.
    invalidateCatalogCache()

    await audit({
      action: 'product.price_change',
      actorType: 'admin',
      actorId: customer!.email,
      resourceType: 'product',
      resourceId: id.data,
      before: { price: before.price, compareAtPrice: before.compareAtPrice, isAvailable: before.isAvailable },
      after: { price: nextPrice, compareAtPrice: nextCompare, isAvailable: body.isAvailable ?? before.isAvailable },
      metadata: { name: before.name },
    })

    return { id: id.data, price: nextPrice, compareAtPrice: nextCompare, isAvailable: body.isAvailable ?? before.isAvailable }
  },
})
