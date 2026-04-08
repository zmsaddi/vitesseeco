import { useDB } from '~/server/database/db'
import { addresses, sessions } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDB()
  const [session] = await db.select({ customerId: sessions.customerId }).from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1)
  if (!session) throw createError({ statusCode: 401, message: 'Session expired' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Address ID required' })

  // Check if the address being deleted is the default
  const [addressToDelete] = await db.select({ isDefault: addresses.isDefault })
    .from(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.customerId, session.customerId)))
    .limit(1)

  if (!addressToDelete) {
    throw createError({ statusCode: 404, message: 'Address not found' })
  }

  await db.delete(addresses).where(
    and(eq(addresses.id, id), eq(addresses.customerId, session.customerId))
  )

  // If deleted address was default, promote the first remaining address
  if (addressToDelete.isDefault) {
    const [firstRemaining] = await db.select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.customerId, session.customerId))
      .limit(1)

    if (firstRemaining) {
      await db.update(addresses)
        .set({ isDefault: true })
        .where(eq(addresses.id, firstRemaining.id))
    }
  }

  return { ok: true }
})
