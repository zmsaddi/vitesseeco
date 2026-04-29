/**
 * Business funnel telemetry (P0-18, ADR-05).
 *
 * Replaces external analytics (no GA4/Plausible yet — see ADR-05). All events
 * are written to the `events` table in PG and queried via SQL.
 *
 * GDPR notes:
 * - Raw IP is never stored. We hash it with a daily salt so the same IP on
 *   different days produces different hashes — preventing long-term tracking
 *   while still allowing same-day correlation for abuse/funnel queries.
 * - sessionId is anonymous (UUID generated client-side) — no PII.
 * - customerId is set only when the user is authenticated.
 *
 * Cleanup: rows older than 90 days will be purged by a future cron job.
 */

import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { useDB } from '~/server/database/db'
import { events } from '~/server/database/schema'

export type EventType =
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_started'
  | 'checkout_validated'
  | 'order_created'
  | 'order_failed'
  | 'promo_applied'
  | 'promo_rejected'
  | 'auth_login_success'
  | 'auth_login_failed'
  | 'auth_register_success'
  | 'auth_register_duplicate'
  | 'auth_password_reset_requested'
  | 'auth_password_reset_completed'
  | 'contact_form_submitted'
  | 'turnstile_failed'

export interface EventEntry {
  type: EventType
  customerId?: string | null
  sessionId?: string | null
  payload?: Record<string, unknown>
  event?: H3Event // optional — if provided, IP/UA are extracted
}

function hashIp(ip: string): string {
  // Daily salt so the hash rotates each day — limits correlation window.
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${ip}|${day}`).digest('hex').slice(0, 32)
}

function getClientIp(event: H3Event): string | null {
  const xff = getRequestHeader(event, 'x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const cf = getRequestHeader(event, 'cf-connecting-ip')
  if (cf) return cf
  return null
}

/**
 * Best-effort event write. Never throws — telemetry failures must not affect
 * customer-facing flows.
 */
export async function logEvent(entry: EventEntry): Promise<void> {
  try {
    const db = useDB()

    let ipHash: string | null = null
    let userAgent: string | null = null
    if (entry.event) {
      const ip = getClientIp(entry.event)
      if (ip) ipHash = hashIp(ip)
      userAgent = getRequestHeader(entry.event, 'user-agent') || null
    }

    await db.insert(events).values({
      eventType: entry.type,
      customerId: entry.customerId ?? null,
      sessionId: entry.sessionId ?? null,
      payload: (entry.payload ?? null) as any,
      ipHash,
      userAgent,
    })
  } catch (err) {
    console.error('[EVENTS] failed to log event', { type: entry.type, err })
  }
}
