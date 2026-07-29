import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstile } from '~/server/utils/verifyTurnstile'
import { isValidEmail, normalizeEmail, LIMITS } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 5, windowMs: 60_000 })

  const body = await readBody<{
    name: string; email: string; subject: string; message: string; turnstileToken: string
  }>(event)

  if (!body?.name || !body?.email || !body?.subject || !body?.message) {
    throw createError({ statusCode: 400, message: 'All fields are required' })
  }

  if (!isValidEmail(body.email)) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }

  if (
    body.message.length > LIMITS.MAX_MESSAGE_LENGTH ||
    body.subject.length > LIMITS.MAX_SUBJECT_LENGTH ||
    body.name.length > LIMITS.MAX_NAME_LENGTH
  ) {
    throw createError({ statusCode: 400, message: 'Message too long' })
  }

  // Verify Turnstile (mandatory)
  if (!body.turnstileToken) {
    throw createError({ statusCode: 400, message: 'CAPTCHA token required' })
  }
  const valid = await verifyTurnstile(body.turnstileToken)
  if (!valid) throw createError({ statusCode: 400, message: 'CAPTCHA verification failed' })

  // Save to Sanity (visible in control panel). Without the token the message
  // would be dropped on the floor while the customer is told it was sent, so
  // this fails loudly instead and the page can offer another channel.
  const sanityToken = process.env.SANITY_TOKEN
  if (!sanityToken) {
    console.error('[CONTACT] SANITY_TOKEN missing — message from', normalizeEmail(body.email), 'was not stored')
    throw createError({ statusCode: 503, message: 'Contact form temporarily unavailable' })
  }
  {
    const client = createClient({
      projectId: '2jvnjf0c',
      dataset: 'production',
      token: sanityToken,
      apiVersion: '2024-01-01',
      useCdn: false,
    })

    await client.create({
      _type: 'contactMessage',
      name: body.name.trim(),
      email: normalizeEmail(body.email),
      subject: body.subject.trim(),
      message: body.message.trim(),
      isRead: false,
      createdAt: new Date().toISOString(),
    })
  }

  return { success: true }
})
