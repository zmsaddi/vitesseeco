import { useDB } from '~/server/database/db'
import { addresses, sessions } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'
import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 10, windowMs: 60_000 })

  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDB()
  const [session] = await db.select({ customerId: sessions.customerId }).from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1)
  if (!session) throw createError({ statusCode: 401, message: 'Session expired' })

  const body = await readBody<{
    label?: string; firstName: string; lastName: string; phone?: string
    address: string; addressLine2?: string; city: string; postalCode: string; country?: string
    isDefault?: boolean
  }>(event)

  if (!body?.firstName || !body?.lastName || !body?.address || !body?.city || !body?.postalCode) {
    throw createError({ statusCode: 400, message: 'Missing required address fields' })
  }

  // Max 5 addresses per customer
  const existing = await db.select({ id: addresses.id }).from(addresses)
    .where(eq(addresses.customerId, session.customerId))
  if (existing.length >= 5) {
    throw createError({ statusCode: 400, message: 'Maximum 5 addresses allowed' })
  }

  // If setting as default, unset other defaults
  if (body.isDefault) {
    await db.update(addresses).set({ isDefault: false })
      .where(eq(addresses.customerId, session.customerId))
  }

  // If first address, make it default
  const isFirst = existing.length === 0

  const [addr] = await db.insert(addresses).values({
    customerId: session.customerId,
    label: body.label || 'home',
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    phone: body.phone?.trim() || null,
    address: body.address.trim(),
    addressLine2: body.addressLine2?.trim() || null,
    city: body.city.trim(),
    postalCode: body.postalCode.trim(),
    country: body.country || 'FR',
    isDefault: body.isDefault || isFirst,
  }).returning()

  return { address: addr }
})
