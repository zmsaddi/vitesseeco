import { useDB } from '~/server/database/db'
import { addresses, sessions } from '~/server/database/schema'
import { eq, and, gt, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDB()
  const [session] = await db.select({ customerId: sessions.customerId }).from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1)
  if (!session) throw createError({ statusCode: 401, message: 'Session expired' })

  const result = await db.select().from(addresses)
    .where(eq(addresses.customerId, session.customerId))
    .orderBy(desc(addresses.isDefault))

  return { addresses: result }
})
