/**
 * A customer's saved addresses.
 */
import { asc, desc, eq } from 'drizzle-orm'
import { defineRoute } from '../../security/handler'
import { db } from '../../db/client'
import { addresses } from '../../db/schema'

export default defineRoute({
  access: 'customer',
  rateLimit: 'standard',
  handler: async ({ customer }) =>
    db()
      .select()
      .from(addresses)
      .where(eq(addresses.customerId, customer!.id))
      .orderBy(desc(addresses.isDefault), asc(addresses.createdAt)),
})
