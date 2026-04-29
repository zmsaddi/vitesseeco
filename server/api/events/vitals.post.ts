/**
 * Web Vitals collection endpoint (P5-01).
 *
 * Receives LCP / CLS / INP / FCP / TTFB measurements from the browser
 * (sent via plugins/vitals.client.ts using sendBeacon) and writes them
 * to the events table for SQL-based analysis.
 *
 * No analytics service is involved — see ADR-05.
 */
import { logEvent } from '~/server/utils/events'
import { rateLimit } from '~/server/utils/rateLimit'

interface VitalPayload {
  name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  path: string
  navigationType?: string
  sessionId?: string
}

const ALLOWED_NAMES = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB'])

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })

  const body = await readBody<VitalPayload>(event)
  if (!body || !ALLOWED_NAMES.has(body.name) || typeof body.value !== 'number') {
    throw createError({ statusCode: 400, message: 'Invalid vital payload' })
  }

  await logEvent({
    type: 'web_vital',
    payload: {
      vital: body.name,
      value: Math.round(body.value),
      rating: body.rating,
      path: String(body.path || '').slice(0, 200),
      navigationType: body.navigationType,
    },
    sessionId: body.sessionId || null,
    event,
  })

  return { ok: true }
})
