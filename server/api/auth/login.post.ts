import { useDB } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 10, windowMs: 60_000 })

  const body = await readBody<{ email: string; password: string }>(event)

  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const db = useDB()
  const email = body.email.toLowerCase().trim()

  const [customer] = await db.select({
    id: customers.id,
    email: customers.email,
    passwordHash: customers.passwordHash,
    firstName: customers.firstName,
    lastName: customers.lastName,
  }).from(customers).where(eq(customers.email, email)).limit(1)
  if (!customer) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(body.password, customer.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  const token = crypto.randomUUID()
  await db.insert(sessions).values({
    customerId: customer.id,
    token,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return {
    user: {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    },
  }
})
