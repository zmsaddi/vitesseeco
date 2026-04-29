import { useDB } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { rateLimit } from '~/server/utils/rateLimit'
import { normalizeEmail } from '~/server/utils/validation'
import { logEvent } from '~/server/utils/events'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 10, windowMs: 60_000 })

  const body = await readBody<{ email: string; password: string }>(event)

  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const db = useDB()
  // Login does NOT validate email format intentionally — the lookup will fail
  // for malformed emails, returning the same generic error to avoid leaking
  // whether the email exists. We only normalize for case-insensitive lookup.
  const email = normalizeEmail(body.email)

  const [customer] = await db.select({
    id: customers.id,
    email: customers.email,
    passwordHash: customers.passwordHash,
    firstName: customers.firstName,
    lastName: customers.lastName,
  }).from(customers).where(eq(customers.email, email)).limit(1)
  if (!customer) {
    await logEvent({ type: 'auth_login_failed', payload: { reason: 'no_customer' }, event })
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(body.password, customer.passwordHash)
  if (!valid) {
    await logEvent({ type: 'auth_login_failed', customerId: customer.id, payload: { reason: 'bad_password' }, event })
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

  await logEvent({ type: 'auth_login_success', customerId: customer.id, event })

  return {
    user: {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    },
  }
})
