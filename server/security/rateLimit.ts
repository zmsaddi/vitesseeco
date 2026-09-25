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
import { db, queryRows, type SqlExecutor } from '../db/client'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { clientIp, routeKey } from './request'
import { hashIp } from './crypto'

/**
 * The limiter takes its database handle rather than reaching for the global
 * one, matching how the stock service takes a transaction. That is what makes
 * it exercisable against any Postgres — the coupling to one driver showed up as
 * a failing test rather than as a surprise in production.
 */
export type Executor = SqlExecutor

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

/** The bucket a request counts against. Shared so both stores agree on it. */
function bucketFor(event: H3Event, options: RateLimitOptions): string {
  const identity = hashIp(clientIp(event))
  const scope = options.scope ?? routeKey(event)
  return options.subject ? `${identity}:${scope}:${options.subject}` : `${identity}:${scope}`
}

/**
 * The in-memory store, for anonymous reads.
 *
 * Why a second store exists at all: the SQL limiter writes a row on *every*
 * request, so a shop with steady crawler traffic never stops writing, and a
 * Neon compute that is never idle is never suspended — it bills continuously
 * until the plan's quota is gone. That is not a hypothetical; it took the shop
 * down twice. An anonymous GET must therefore be servable without touching
 * Postgres at all, so the database can actually go to sleep.
 *
 * It is per-instance and best-effort, and that is the accepted trade: a
 * distributed scraper gets a budget per serverless instance rather than one
 * globally. Worth it for reads, and never used for anything that spends money,
 * sends mail or checks a credential — those keep the durable store, where
 * cross-instance accuracy is the entire point.
 */
const memoryBuckets = new Map<string, { count: number; expiresAt: number }>()

/** Bounded so a long-lived instance under a spray of unique IPs cannot grow without end. */
const MEMORY_BUCKET_CAP = 20_000

function consumeInMemory(event: H3Event, options: RateLimitOptions): RateLimitResult {
  const bucket = bucketFor(event, options)
  const now = Date.now()

  // Opportunistic eviction: cheaper than a timer, and the cap is only reached by
  // traffic that is itself evicting as it goes.
  if (memoryBuckets.size >= MEMORY_BUCKET_CAP) {
    for (const [key, value] of memoryBuckets) {
      if (value.expiresAt <= now) memoryBuckets.delete(key)
    }
    // Still full: every bucket is live, so drop the oldest insertions rather
    // than start refusing requests over a bookkeeping limit.
    if (memoryBuckets.size >= MEMORY_BUCKET_CAP) {
      let toDrop = Math.ceil(MEMORY_BUCKET_CAP / 10)
      for (const key of memoryBuckets.keys()) {
        memoryBuckets.delete(key)
        if (--toDrop <= 0) break
      }
    }
  }

  const existing = memoryBuckets.get(bucket)
  const entry =
    existing && existing.expiresAt > now
      ? { count: existing.count + 1, expiresAt: existing.expiresAt }
      : { count: 1, expiresAt: now + options.windowMs }
  memoryBuckets.set(bucket, entry)

  return {
    allowed: entry.count <= options.limit,
    remaining: Math.max(0, options.limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
  }
}

/**
 * Consume one unit of budget.
 *
 * Returns the outcome rather than throwing, for callers that want to record a
 * failure without rejecting. Most callers want `enforceRateLimit`.
 */
export async function consumeRateLimit(
  event: H3Event,
  options: RateLimitOptions,
  database: Executor = db()
): Promise<RateLimitResult> {
  const bucket = bucketFor(event, options)
  const windowSeconds = Math.ceil(options.windowMs / 1000)

  // One statement: insert the bucket, or — if the window has rolled over —
  // restart it, otherwise increment. The returned count is authoritative
  // because the row is locked for the duration of the upsert.
  const rows = await queryRows<{ count: number; expires_at: string }>(database, sql`
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

  const row = rows[0]
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
 *
 * `ephemeral` picks the in-memory store instead of Postgres. The caller decides,
 * because only the caller knows whether the request is an anonymous read — see
 * `defineRoute`, which passes it for public GETs so that ordinary browsing and
 * crawling leave the database untouched and let it suspend.
 */
export async function enforceRateLimit(
  event: H3Event,
  preset: RateLimitPreset,
  extra: Omit<RateLimitOptions, 'limit' | 'windowMs'> & { ephemeral?: boolean } = {},
  database: Executor = db()
): Promise<void> {
  const { ephemeral = false, ...options } = extra
  const config = RATE_LIMITS[preset]
  let result: RateLimitResult
  try {
    result = ephemeral
      ? consumeInMemory(event, { ...config, ...options })
      : await consumeRateLimit(event, { ...config, ...options }, database)
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
export async function pruneRateLimits(limit = 1000, database: Executor = db()): Promise<number> {
  const deleted = await queryRows<{ bucket: string }>(
    database,
    sql`
      DELETE FROM rate_limits
       WHERE bucket IN (
         SELECT bucket FROM rate_limits WHERE expires_at <= NOW() LIMIT ${limit}
       )
      RETURNING bucket
    `
  )
  return deleted.length
}
