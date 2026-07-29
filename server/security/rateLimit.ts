/**
 * Rate limiting.
 *
 * The counter lives in Postgres, not in process memory. A serverless function
 * is recycled constantly and there are many instances running at once, so an
 * in-memory counter limits one instance for a few minutes — which is a limit in
 * name only. The previous build had exactly that, and keyed it on a string the
 * caller controlled, so appending `?x=random` reset the budget.
 *
 * The whole increment is a single statement. Read-then-write would let two
 * concurrent requests both see "9 of 10" and both proceed.
 */
import { sql } from 'drizzle-orm'
import { setResponseHeader, type H3Event } from 'h3'
import { db } from '../db/client'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { clientIp, routeKey } from './request'
import { hashIp } from './crypto'

export interface RateLimitOptions {
  /** Requests permitted inside the window. */
  limit: number
  windowMs: number
  /**
   * Extra identity beyond the IP — an email on a login attempt, so one address
   * cannot be sprayed from a botnet without also hitting a per-account ceiling.
   */
  subject?: string
  /** Override the route component of the key, to share a budget across routes. */
  scope?: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Sensible defaults per kind of endpoint. Named rather than numeric at the call
 * site so the intent is visible and the numbers live in one place.
 */
export const RATE_LIMITS = {
  /** Credential endpoints: expensive to us, valuable to an attacker. */
  auth: { limit: 8, windowMs: 15 * 60_000 },
  /** Account creation. */
  register: { limit: 5, windowMs: 60 * 60_000 },
  /** Anything that sends a message or an email on our behalf. */
  contact: { limit: 5, windowMs: 60 * 60_000 },
  /** Placing an order. Generous — a real customer may legitimately retry. */
  checkout: { limit: 20, windowMs: 15 * 60_000 },
  /** Read endpoints that hit an upstream API. */
  lookup: { limit: 120, windowMs: 60_000 },
  /** Everything else. */
  standard: { limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, { limit: number; windowMs: number }>

export type RateLimitPreset = keyof typeof RATE_LIMITS

/**
 * Consume one unit of budget.
 *
 * Returns the outcome rather than throwing, for callers that want to record a
 * failure without rejecting. Most callers want `enforceRateLimit`.
 */
export async function consumeRateLimit(
  event: H3Event,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const identity = hashIp(clientIp(event))
  const scope = options.scope ?? routeKey(event)
  const bucket = options.subject ? `${identity}:${scope}:${options.subject}` : `${identity}:${scope}`
  const windowSeconds = Math.ceil(options.windowMs / 1000)

  // One statement: insert the bucket, or — if the window has rolled over —
  // restart it, otherwise increment. The returned count is authoritative
  // because the row is locked for the duration of the upsert.
  const rows = await db().execute<{ count: number; expires_at: string }>(sql`
    INSERT INTO rate_limits (bucket, count, window_started_at, expires_at)
    VALUES (
      ${bucket},
      1,
      NOW(),
      NOW() + ${sql.raw(`INTERVAL '${windowSeconds} seconds'`)}
    )
    ON CONFLICT (bucket) DO UPDATE
      SET count = CASE
            WHEN rate_limits.expires_at <= NOW() THEN 1
            ELSE rate_limits.count + 1
          END,
          window_started_at = CASE
            WHEN rate_limits.expires_at <= NOW() THEN NOW()
            ELSE rate_limits.window_started_at
          END,
          expires_at = CASE
            WHEN rate_limits.expires_at <= NOW()
              THEN NOW() + ${sql.raw(`INTERVAL '${windowSeconds} seconds'`)}
            ELSE rate_limits.expires_at
          END
    RETURNING count, expires_at
  `)

  const row = rows.rows[0]
  if (!row) {
    // The limiter must never be the reason an order cannot be placed.
    return { allowed: true, remaining: options.limit, retryAfterSeconds: 0 }
  }

  const count = Number(row.count)
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 1000)
  )

  return {
    allowed: count <= options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSeconds,
  }
}

/**
 * Consume budget and reject when it is gone.
 *
 * A database failure must not take the site down, so an error here is logged
 * and allowed through: the limiter is a defence in depth, not the only one, and
 * every protected route also requires a session, a CAPTCHA or a signature.
 */
export async function enforceRateLimit(
  event: H3Event,
  preset: RateLimitPreset,
  extra: Omit<RateLimitOptions, 'limit' | 'windowMs'> = {}
): Promise<void> {
  const config = RATE_LIMITS[preset]
  let result: RateLimitResult
  try {
    result = await consumeRateLimit(event, { ...config, ...extra })
  } catch (error) {
    console.error('[rate-limit] store unavailable, allowing request', error)
    return
  }

  setResponseHeader(event, 'X-RateLimit-Limit', String(config.limit))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(result.remaining))

  if (!result.allowed) {
    // Retry-After is a numeric header in h3's typed signature.
    setResponseHeader(event, 'Retry-After', result.retryAfterSeconds)
    throw new AppError(ERROR_CODES.RATE_LIMITED, {
      details: { retryAfterSeconds: result.retryAfterSeconds },
      internal: `rate limit exceeded for ${routeKey(event)}`,
    })
  }
}

/** Housekeeping. Expired buckets are already ignored; this keeps the table small. */
export async function pruneRateLimits(limit = 1000): Promise<number> {
  const deleted = await db().execute<{ bucket: string }>(sql`
    DELETE FROM rate_limits
     WHERE bucket IN (
       SELECT bucket FROM rate_limits WHERE expires_at <= NOW() LIMIT ${limit}
     )
    RETURNING bucket
  `)
  return deleted.rows.length
}
