/**
 * Contact form.
 *
 * The message lands in Postgres, not in the catalogue store. A name, an email
 * and free text are personal data, and personal data belongs in the database
 * nobody can query from a browser — this is the last piece of the old build's
 * public-dataset exposure, closed by having nowhere else to put it.
 *
 * The address is hashed for abuse investigation and never stored in the clear.
 */
import { defineRoute } from '../security/handler'
import { contactSchema } from '../../shared/schemas'
import { db } from '../db/client'
import { contactMessages } from '../db/schema'
import { verifyCaptcha } from '../security/captcha'
import { clientIp, hashIpFor } from '../security/request'

export default defineRoute({
  access: 'public',
  rateLimit: 'contact',
  body: contactSchema,
  handler: async ({ event, body }) => {
    await verifyCaptcha(body.captchaToken, clientIp(event))

    await db().insert(contactMessages).values({
      name: body.name,
      email: body.email,
      subject: body.subject,
      message: body.message,
      locale: body.locale ?? 'fr',
      ipHash: hashIpFor(event),
    })

    return { ok: true }
  },
})
