/**
 * Sign in.
 *
 * Two things are deliberate and worth stating:
 *
 *  - The CAPTCHA is checked BEFORE the password comparison, so a credential
 *    stuffing run never reaches bcrypt and never learns anything from timing.
 *  - A wrong email and a wrong password produce the identical error, and the
 *    identical amount of work: `verifyPassword` still runs a comparison when
 *    there is no account, so the response time does not reveal which addresses
 *    are registered.
 *
 * The rate limit is keyed on the email as well as the IP, so one account cannot
 * be sprayed from a botnet without also hitting its own ceiling.
 */
import { eq } from 'drizzle-orm'
import { defineRoute } from '../../security/handler'
import { loginSchema } from '../../../shared/schemas'
import { db, withTransaction } from '../../db/client'
import { customers } from '../../db/schema'
import { verifyPassword } from '../../security/crypto'
import { verifyCaptcha } from '../../security/captcha'
import { createSession } from '../../security/session'
import { clientIp } from '../../security/request'
import { consumeRateLimit, RATE_LIMITS } from '../../security/rateLimit'
import { AppError, ERROR_CODES } from '../../../shared/errors'
import { audit } from '../../services/audit'
import { hashIp } from '../../security/crypto'

export default defineRoute({
  access: 'public',
  rateLimit: 'auth',
  body: loginSchema,
  handler: async ({ event, body }) => {
    // A second budget, this one per account rather than per address.
    const perAccount = await consumeRateLimit(event, {
      ...RATE_LIMITS.auth,
      subject: body.email,
      scope: 'login:account',
    })
    if (!perAccount.allowed) {
      throw new AppError(ERROR_CODES.RATE_LIMITED, {
        details: { retryAfterSeconds: perAccount.retryAfterSeconds },
        internal: `login attempts exhausted for ${body.email}`,
      })
    }

    await verifyCaptcha(body.captchaToken, clientIp(event))

    const [customer] = await db()
      .select({
        id: customers.id,
        email: customers.email,
        passwordHash: customers.passwordHash,
        firstName: customers.firstName,
        lastName: customers.lastName,
      })
      .from(customers)
      .where(eq(customers.email, body.email))
      .limit(1)

    // Runs the comparison either way — an unknown email must not answer faster
    // than a known one with the wrong password.
    const valid = await verifyPassword(body.password, customer?.passwordHash ?? null)

    if (!customer || !valid) {
      await audit({
        action: 'customer.login_failed',
        resourceType: 'customer',
        // The address, not whether it exists: enough to spot an attack, not
        // enough to confirm an account to whoever reads the log.
        metadata: { email: body.email },
        ipHash: hashIp(clientIp(event)),
      })
      throw new AppError(ERROR_CODES.INVALID_CREDENTIALS)
    }

    await withTransaction(async (tx) => {
      await createSession(event, tx, customer.id)
    })

    await audit({
      action: 'customer.login',
      actorType: 'customer',
      actorId: customer.id,
      resourceType: 'customer',
      resourceId: customer.id,
      ipHash: hashIp(clientIp(event)),
    })

    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    }
  },
})
