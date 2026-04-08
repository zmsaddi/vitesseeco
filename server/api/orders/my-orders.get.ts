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

  const orders = await client.fetch(
    `*[_type == "order" && customer.customerId == $customerId] | order(createdAt desc) {
      orderNumber, status, paymentMethod, total, shippingMethod, trackingNumber,
      items[]{ productName, color, quantity, price },
      createdAt
    }`,
    { customerId: session.customerId }
  )

  return { orders }
})
