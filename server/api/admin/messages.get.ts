/**
 * Customer messages.
 */
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { db } from '../../db/client'
import { contactMessages } from '../../db/schema'
import { paginationSchema } from '../../../shared/schemas'

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: paginationSchema.extend({ unreadOnly: z.coerce.boolean().optional() }).strict(),
  handler: async ({ query }) => {
    const where = query.unreadOnly ? eq(contactMessages.isRead, false) : undefined

    const messages = await db()
      .select()
      .from(contactMessages)
      .where(where)
      .orderBy(desc(contactMessages.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage)

    const [unread] = await db()
      .select({ value: sql<string>`COUNT(*)::text` })
      .from(contactMessages)
      .where(eq(contactMessages.isRead, false))

    return { messages, unread: Number(unread?.value ?? 0) }
  },
})
