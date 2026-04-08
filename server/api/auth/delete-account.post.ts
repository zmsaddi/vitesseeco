import { useDB } from '~/server/database/db'
import { customers, sessions, addresses, orders } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'
import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 3, windowMs: 60_000 })

  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDB()
  const [session] = await db.select({ customerId: sessions.customerId }).from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1)
  if (!session) throw createError({ statusCode: 401, message: 'Session expired' })

  const customerId = session.customerId

  // 1. Anonymize orders (keep for business records, remove personal data)
  await db.update(orders).set({
    customerId: null,
    guestEmail: 'deleted@account.removed',
    shippingAddress: { note: 'Account deleted by user' },
  }).where(eq(orders.customerId, customerId))

  // 2. Delete all addresses
  await db.delete(addresses).where(eq(addresses.customerId, customerId))

  // 3. Delete all sessions
  await db.delete(sessions).where(eq(sessions.customerId, customerId))

  // 4. Delete customer account
  await db.delete(customers).where(eq(customers.id, customerId))

  // 5. Clear auth cookie
  deleteCookie(event, 'auth_token')

  return { ok: true, message: 'Account deleted' }
})
