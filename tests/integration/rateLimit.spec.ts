/**
 * Rate limiting, verified against a real database.
 *
 * The property that matters is that a burst of concurrent requests cannot all
 * see the same count and all pass. That is a race, so it is tested by racing —
 * a serial loop would pass against a read-then-write implementation that a real
 * burst would sail straight through.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { closePool, hasDatabase, migrate, resetDatabase } from './setup'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? ''

describe.skipIf(!hasDatabase)('rate limiting', () => {
  let consumeRateLimit: typeof import('../../server/security/rateLimit')['consumeRateLimit']
  let pruneRateLimits: typeof import('../../server/security/rateLimit')['pruneRateLimits']
  let dbHandle: typeof import('../../server/db/client')['db']

  beforeAll(async () => {
    // The limiter reads DATABASE_URL through the production client, so point it
    // at the scratch database for the duration of this suite.
    vi.stubEnv('DATABASE_URL', TEST_DATABASE_URL)
    await migrate()
    const limiter = await import('../../server/security/rateLimit')
    consumeRateLimit = limiter.consumeRateLimit
    pruneRateLimits = limiter.pruneRateLimits
    dbHandle = (await import('../../server/db/client')).db
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  /** An event carrying a fixed identity, so a test controls its own bucket. */
  function eventFor(ip: string, path = '/api/test') {
    return {
      method: 'POST',
      path,
      node: { req: { headers: { 'x-real-ip': ip }, socket: {} }, res: { setHeader: () => {} } },
      context: {},
    } as never
  }

  it('allows requests up to the limit and refuses the next one', async () => {
    const event = eventFor('203.0.113.10')
    const options = { limit: 3, windowMs: 60_000 }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await consumeRateLimit(event, options)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(3 - attempt)
    }

    const blocked = await consumeRateLimit(event, options)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('does not let a concurrent burst slip past the limit', async () => {
    const event = eventFor('203.0.113.11')
    const options = { limit: 5, windowMs: 60_000 }

    const results = await Promise.all(
      Array.from({ length: 25 }, () => consumeRateLimit(event, options))
    )

    expect(results.filter((r) => r.allowed)).toHaveLength(5)
  })

  it('keeps separate identities separate', async () => {
    const options = { limit: 2, windowMs: 60_000 }
    await consumeRateLimit(eventFor('203.0.113.20'), options)
    await consumeRateLimit(eventFor('203.0.113.20'), options)

    const other = await consumeRateLimit(eventFor('203.0.113.21'), options)
    expect(other.allowed).toBe(true)
  })

  it('gives every query variant of a route ONE budget', async () => {
    // The old build keyed on the full path, so `?x=random` minted a fresh
    // bucket and every limit on the site was one header away from useless.
    const options = { limit: 3, windowMs: 60_000 }
    const paths = [
      '/api/auth/login?x=1',
      '/api/auth/login?x=2',
      '/api/auth/login?y=3',
      '/api/auth/login',
    ]

    const results = []
    for (const path of paths) {
      results.push(await consumeRateLimit(eventFor('203.0.113.30', path), options))
    }

    expect(results.filter((r) => r.allowed)).toHaveLength(3)
    expect(results[3]?.allowed).toBe(false)
  })

  it('keeps separate routes separate', async () => {
    const options = { limit: 1, windowMs: 60_000 }
    await consumeRateLimit(eventFor('203.0.113.40', '/api/one'), options)
    const other = await consumeRateLimit(eventFor('203.0.113.40', '/api/two'), options)
    expect(other.allowed).toBe(true)
  })

  it('applies a per-subject budget on top of the per-IP one', async () => {
    // One account cannot be sprayed from many addresses without also hitting
    // its own ceiling.
    const options = { limit: 2, windowMs: 60_000, subject: 'victim@example.com' }
    await consumeRateLimit(eventFor('203.0.113.50'), options)
    await consumeRateLimit(eventFor('203.0.113.50'), options)
    const blocked = await consumeRateLimit(eventFor('203.0.113.50'), options)
    expect(blocked.allowed).toBe(false)

    const otherSubject = await consumeRateLimit(eventFor('203.0.113.50'), {
      ...options,
      subject: 'someone-else@example.com',
    })
    expect(otherSubject.allowed).toBe(true)
  })

  it('starts a fresh window once the old one has passed', async () => {
    const event = eventFor('203.0.113.60')
    const options = { limit: 1, windowMs: 60_000 }

    expect((await consumeRateLimit(event, options)).allowed).toBe(true)
    expect((await consumeRateLimit(event, options)).allowed).toBe(false)

    // Age the bucket rather than waiting a minute.
    await dbHandle().execute(
      sql`UPDATE rate_limits SET expires_at = NOW() - INTERVAL '1 second', window_started_at = NOW() - INTERVAL '61 seconds'`
    )

    const afterWindow = await consumeRateLimit(event, options)
    expect(afterWindow.allowed).toBe(true)
    expect(afterWindow.remaining).toBe(0)
  })

  it('survives a restart, because the counter is not in memory', async () => {
    // The whole reason this lives in Postgres: a serverless instance is
    // recycled constantly, and an in-memory counter resets with it.
    const event = eventFor('203.0.113.70')
    const options = { limit: 2, windowMs: 60_000 }
    await consumeRateLimit(event, options)
    await consumeRateLimit(event, options)

    vi.resetModules()
    const reloaded = await import('../../server/security/rateLimit')

    const blocked = await reloaded.consumeRateLimit(event, options)
    expect(blocked.allowed).toBe(false)
  })

  it('prunes expired buckets without touching live ones', async () => {
    await consumeRateLimit(eventFor('203.0.113.80'), { limit: 5, windowMs: 60_000 })
    await consumeRateLimit(eventFor('203.0.113.81'), { limit: 5, windowMs: 60_000 })
    await dbHandle().execute(
      sql`UPDATE rate_limits SET expires_at = NOW() - INTERVAL '1 second' WHERE bucket LIKE '%' AND ctid IN (SELECT ctid FROM rate_limits LIMIT 1)`
    )

    expect(await pruneRateLimits()).toBe(1)

    const remaining = await dbHandle().execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM rate_limits`
    )
    expect(Number(remaining.rows[0]?.count)).toBe(1)
  })
})
