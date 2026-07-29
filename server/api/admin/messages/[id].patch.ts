/**
 * Mark a message read, or attach a note.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getRouterParam } from 'h3'
import { defineRoute } from '../../../security/handler'
import { db } from '../../../db/client'
import { contactMessages } from '../../../db/schema'
import { LIMITS } from '../../../../shared/schemas'
import { AppError, ERROR_CODES } from '../../../../shared/errors'

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  body: z
    .object({
      isRead: z.boolean().optional(),
      adminNote: z.string().trim().max(LIMITS.MAX_NOTE_LENGTH).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, 'nothing to change'),
  handler: async ({ event, body }) => {
    const id = z.string().uuid().safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new AppError(ERROR_CODES.NOT_FOUND, { internal: 'malformed message id' })

    const [updated] = await db()
      .update(contactMessages)
      .set({
        ...(body.isRead !== undefined ? { isRead: body.isRead } : {}),
        ...(body.adminNote !== undefined ? { adminNote: body.adminNote || null } : {}),
      })
      .where(eq(contactMessages.id, id.data))
      .returning()

    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `no message ${id.data}` })
    return updated
  },
})
