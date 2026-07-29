/**
 * Delete a saved address.
 *
 * The customer id is part of the DELETE, so an id belonging to someone else
 * matches nothing. Reporting "not found" rather than "forbidden" is deliberate:
 * distinguishing the two tells a caller which ids exist.
 */
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getRouterParam } from 'h3'
import { defineRoute } from '../../../security/handler'
import { db } from '../../../db/client'
import { addresses } from '../../../db/schema'
import { AppError, ERROR_CODES } from '../../../../shared/errors'

export default defineRoute({
  access: 'customer',
  rateLimit: 'standard',
  handler: async ({ event, customer }) => {
    const id = z.string().uuid().safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new AppError(ERROR_CODES.NOT_FOUND, { internal: 'malformed address id' })

    const removed = await db()
      .delete(addresses)
      .where(and(eq(addresses.id, id.data), eq(addresses.customerId, customer!.id)))
      .returning({ id: addresses.id })

    if (removed.length === 0) {
      throw new AppError(ERROR_CODES.NOT_FOUND, {
        internal: `address ${id.data} does not belong to ${customer!.id}`,
      })
    }

    return { ok: true }
  },
})
