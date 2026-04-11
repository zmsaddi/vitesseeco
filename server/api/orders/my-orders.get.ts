import { createClient } from '@sanity/client'
import { useDB } from '~/server/database/db'
import { sessions } from '~/server/database/schema'
import { eq, and, gt } from 'drizzle-orm'
import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 30, windowMs: 60_000 })

  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDB()
  const [session] = await db.select({ customerId: sessions.customerId }).from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))).limit(1)
  if (!session) throw createError({ statusCode: 401, message: 'Session expired' })

  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
  })

  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10))
  const offset = (page - 1) * limit

  const orders = await client.fetch(
    `*[_type == "order" && customer.customerId == $customerId] | order(createdAt desc) [$offset...$end] {
      orderNumber, status, paymentMethod, total, shippingMethod, trackingNumber,
      items[]{ productName, color, quantity, price },
      createdAt
    }`,
    { customerId: session.customerId, offset, end: offset + limit }
  )

  const total = await client.fetch(
    `count(*[_type == "order" && customer.customerId == $customerId])`,
    { customerId: session.customerId }
  )

  return { orders, total, page, limit, totalPages: Math.ceil(total / limit) }
})
