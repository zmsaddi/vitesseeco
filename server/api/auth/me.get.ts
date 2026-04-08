import { useDB } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = useDB()

  const [session] = await db
    .select({ customerId: sessions.customerId })
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!session) {
    deleteCookie(event, 'auth_token')
    throw createError({ statusCode: 401, message: 'Session expired' })
  }

  const [customer] = await db
    .select({
      id: customers.id,
      email: customers.email,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
      address: customers.address,
      city: customers.city,
      postalCode: customers.postalCode,
      country: customers.country,
    })
    .from(customers)
    .where(eq(customers.id, session.customerId))
    .limit(1)

  if (!customer) {
    throw createError({ statusCode: 401, message: 'User not found' })
  }

  return { user: customer }
})
