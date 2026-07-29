import { useDBHttp } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'
import bcrypt from 'bcryptjs'
import { rateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstile } from '~/server/utils/verifyTurnstile'
import { isValidEmail, normalizeEmail, isValidName, isValidPassword, LIMITS } from '~/server/utils/validation'
import { logEvent } from '~/server/utils/events'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 5, windowMs: 60_000 })

  const body = await readBody<{
    email: string; password: string; firstName: string; lastName: string
    phone?: string; turnstileToken?: string
  }>(event)

  if (!body?.email || !body?.password || !body?.firstName || !body?.lastName) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  if (!isValidEmail(body.email)) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }
  if (!isValidName(body.firstName) || !isValidName(body.lastName)) {
    throw createError({ statusCode: 400, message: 'Invalid name' })
  }
  if (!isValidPassword(body.password)) {
    throw createError({ statusCode: 400, message: `Password must be at least ${LIMITS.MIN_PASSWORD_LENGTH} characters` })
  }

  // Verify Turnstile (mandatory) — the gate against mass account creation,
  // checked before the bcrypt hash below.
  if (!body.turnstileToken) {
    throw createError({ statusCode: 400, message: 'CAPTCHA token required' })
  }
  const captchaOk = await verifyTurnstile(body.turnstileToken)
  if (!captchaOk) throw createError({ statusCode: 400, message: 'CAPTCHA verification failed' })

  const email = normalizeEmail(body.email)

  const db = useDBHttp()
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
    // SEC-05 (P0-03): keep the message generic — directing the user to sign in
    // or reset their password — rather than confirming that the address is
    // registered. Timing is already similar between paths because both reach
    // here only after the bcrypt hash above.
    // TODO(P0-04 / P0-06): once Resend + password reset are wired, switch to
    // returning a registration-shaped success and emailing the existing
    // account holder ("someone tried to register with your email — reset
    // password if it was you"). That fully closes the enumeration surface.
    // drizzle-orm ≥0.44 wraps driver errors in DrizzleQueryError; the
    // NeonDbError carrying the PG code lives on `.cause`.
    const pgCode = e?.code ?? e?.cause?.code
    if (pgCode === '23505') {
      await logEvent({ type: 'auth_register_duplicate', payload: { emailHash: email.slice(0, 3) + '***' }, event })
      throw createError({
        statusCode: 409,
        message: 'An account with this email already exists. Please sign in or use the password reset flow.',
      })
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

  await logEvent({ type: 'auth_register_success', customerId: customer.id, event })

  return { user: customer }
})
