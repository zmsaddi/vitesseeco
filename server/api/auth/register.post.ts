/**
 * Create an account.
 *
 * The CAPTCHA is verified before the password is hashed, so a bot never gets a
 * bcrypt round out of us, and the account and its session are created in one
 * transaction — a customer who registers is signed in, or nothing happened.
 */
import { eq } from 'drizzle-orm'
import { defineRoute } from '../../security/handler'
import { registerSchema } from '../../../shared/schemas'
import { withTransaction } from '../../db/client'
import { customers } from '../../db/schema'
import { hashPassword } from '../../security/crypto'
import { verifyCaptcha } from '../../security/captcha'
import { createSession } from '../../security/session'
import { clientIp } from '../../security/request'
import { AppError, ERROR_CODES } from '../../../shared/errors'
import { audit } from '../../services/audit'

export default defineRoute({
  access: 'public',
  rateLimit: 'register',
  body: registerSchema,
  handler: async ({ event, body }) => {
    await verifyCaptcha(body.captchaToken, clientIp(event))

    const passwordHash = await hashPassword(body.password)

    try {
      const customer = await withTransaction(async (tx) => {
        const [created] = await tx
          .insert(customers)
          .values({
            email: body.email,
            passwordHash,
            firstName: body.firstName,
            lastName: body.lastName,
            phone: body.phone ?? null,
            locale: body.locale ?? 'fr',
          })
          .returning({
            id: customers.id,
            email: customers.email,
            firstName: customers.firstName,
            lastName: customers.lastName,
          })

        if (!created) throw new Error('customer insert returned no row')

        await createSession(event, tx, created.id)
        return created
      })

      await audit({
        action: 'customer.register',
        actorType: 'customer',
        actorId: customer.id,
        resourceType: 'customer',
        resourceId: customer.id,
      })

      return {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      }
    } catch (error) {
      if (isDuplicateEmail(error)) {
        // Deliberately the same shape as a validation failure, and deliberately
        // not "this email is taken" — an unauthenticated caller must not be
        // able to enumerate who has an account here.
        const existing = await emailExists(body.email)
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
          details: { issues: [{ path: 'email', message: 'errors.email_unavailable' }] },
          internal: `registration refused for an existing email (exists=${existing})`,
        })
      }
      throw error
    }
  },
})

function isDuplicateEmail(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown })?.cause]
  return candidates.some((candidate) => {
    const record = candidate as { code?: string; constraint?: string; message?: string } | undefined
    return record?.code === '23505' && (record.constraint ?? record.message ?? '').includes('customers_email')
  })
}

async function emailExists(email: string): Promise<boolean> {
  const { db } = await import('../../db/client')
  const [row] = await db().select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1)
  return Boolean(row)
}
