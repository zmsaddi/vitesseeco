/**
 * Correct a stock count.
 *
 * The value is absolute — what is physically on the shelf — never a delta, so
 * two admins counting the same rack cannot compound each other's edit. Live
 * reservations are untouched: a checkout in flight keeps its hold, and the
 * corrected figure applies to what remains sellable.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { withTransaction } from '../../db/client'
import { readAvailability, setOnHand } from '../../services/stock'
import { productIdSchema } from '../../../shared/schemas'
import { audit } from '../../services/audit'

const bodySchema = z
  .object({
    productId: productIdSchema,
    onHand: z.number().int().min(0).max(100_000),
    sku: z.string().trim().max(100).optional(),
  })
  .strict()

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  body: bodySchema,
  handler: async ({ body, customer }) =>
    withTransaction(async (tx) => {
      const before = await readAvailability(tx, [body.productId])

      await setOnHand(tx, body.productId, body.onHand, body.sku ?? null)

      const after = await readAvailability(tx, [body.productId])

      await audit(
        {
          action: 'inventory.set',
          actorType: 'admin',
          actorId: customer!.email,
          resourceType: 'product',
          resourceId: body.productId,
          before: { onHand: before.get(body.productId)?.onHand ?? null },
          after: { onHand: body.onHand },
        },
        tx
      )

      return after.get(body.productId) ?? { productId: body.productId, onHand: body.onHand, reserved: 0, available: body.onHand }
    }),
})
