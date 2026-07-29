import { useDBHttp } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'
import { rateLimit } from '~/server/utils/rateLimit'
import { isValidName } from '~/server/utils/validation'

// Phone is free-form across six markets — only shape and length are enforced.
const PHONE_RE = /^[+()\d\s.-]{6,32}$/

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 10, windowMs: 60_000 })

  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDBHttp()
  const [session] = await db.select({ customerId: sessions.customerId }).from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1)
  if (!session) throw createError({ statusCode: 401, message: 'Session expired' })

  const body = await readBody<{
    firstName?: string; lastName?: string; phone?: string
  }>(event)

  const updates: Partial<{ firstName: string; lastName: string; phone: string | null; updatedAt: Date }> = { updatedAt: new Date() }

  if (body?.firstName !== undefined) {
    if (!isValidName(body.firstName)) throw createError({ statusCode: 400, message: 'Invalid name' })
    updates.firstName = body.firstName.trim()
  }
  if (body?.lastName !== undefined) {
    if (!isValidName(body.lastName)) throw createError({ statusCode: 400, message: 'Invalid name' })
    updates.lastName = body.lastName.trim()
  }
  if (body?.phone !== undefined) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (phone && !PHONE_RE.test(phone)) throw createError({ statusCode: 400, message: 'Invalid phone' })
    updates.phone = phone || null
  }

  const [updated] = await db.update(customers).set(updates)
    .where(eq(customers.id, session.customerId))
    .returning({
      id: customers.id, email: customers.email,
      firstName: customers.firstName, lastName: customers.lastName,
      phone: customers.phone,
    })

  return { user: updated }
})
