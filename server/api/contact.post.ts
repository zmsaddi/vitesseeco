import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { verifyTurnstile } from '~/server/utils/verifyTurnstile'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 5, windowMs: 60_000 })

  const body = await readBody<{
    name: string; email: string; subject: string; message: string; turnstileToken: string
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

  // Save to Sanity (visible in control panel)
  const sanityToken = process.env.SANITY_TOKEN
  if (sanityToken) {
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
      email: body.email.trim().toLowerCase(),
      subject: body.subject.trim(),
      message: body.message.trim(),
      isRead: false,
      createdAt: new Date().toISOString(),
    })
  }

  return { success: true }
})
