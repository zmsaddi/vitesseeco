import { useDB } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'
import bcrypt from 'bcryptjs'
import { rateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 5, windowMs: 60_000 })

  const body = await readBody<{
    email: string; password: string; firstName: string; lastName: string; phone?: string
  }>(event)

  if (!body?.email || !body?.password || !body?.firstName || !body?.lastName) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const email = body.email.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }
  if (body.password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  const db = useDB()
  const passwordHash = await bcrypt.hash(body.password, 12)

  let customer: { id: string; email: string; firstName: string; lastName: string }
  try {
    const [inserted] = await db.insert(customers).values({
      email,
      passwordHash,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      phone: body.phone?.trim() || null,
    }).returning({ id: customers.id, email: customers.email, firstName: customers.firstName, lastName: customers.lastName })
    customer = inserted
  } catch (e: any) {
    // Unique constraint violation (PostgreSQL code 23505)
    if (e.code === '23505') {
      throw createError({ statusCode: 409, message: 'Email already registered' })
    }
    throw e
  }

  // Create session
  const token = crypto.randomUUID()
  await db.insert(sessions).values({
    customerId: customer.id,
    token,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  })

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return { user: customer }
})
