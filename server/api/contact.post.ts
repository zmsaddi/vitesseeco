import { rateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstile } from '~/server/utils/verifyTurnstile'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 5, windowMs: 60_000 })

  const body = await readBody<{
    name: string; email: string; subject: string; message: string; turnstileToken?: string
  }>(event)

  if (!body?.name || !body?.email || !body?.subject || !body?.message) {
    throw createError({ statusCode: 400, message: 'All fields are required' })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }

  if (body.message.length > 5000 || body.subject.length > 200 || body.name.length > 100) {
    throw createError({ statusCode: 400, message: 'Message too long' })
  }

  // Verify Turnstile (mandatory)
  if (!body.turnstileToken) {
    throw createError({ statusCode: 400, message: 'CAPTCHA token required' })
  }
  const valid = await verifyTurnstile(body.turnstileToken)
  if (!valid) throw createError({ statusCode: 400, message: 'CAPTCHA verification failed' })

  // For now, store in memory / log. Will send via Resend in Phase 3
  console.log('[CONTACT FORM]', {
    name: body.name,
    email: body.email,
    subject: body.subject,
    message: body.message.substring(0, 100) + '...',
    date: new Date().toISOString(),
  })

  return { success: true }
})
