/**
 * Rate limiting, verified against a real database.
 *
 * The property that matters is that a burst of concurrent requests cannot all
 * see the same count and all pass. That is a race, so it is tested by racing —
 * a serial loop would pass against a read-then-write implementation that a real
 * burst would sail straight through.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { consumeRateLimit, pruneRateLimits } from '../../server/security/rateLimit'
import { closePool, hasDatabase, resetDatabase, testDb } from './setup'

describe.skipIf(!hasDatabase)('rate limiting', () => {
  afterAll(async () => {
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
      const result = await consumeRateLimit(event, options, testDb())
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(3 - attempt)
    }

    const blocked = await consumeRateLimit(event, options, testDb())
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('does not let a concurrent burst slip past the limit', async () => {
    const event = eventFor('203.0.113.11')
    const options = { limit: 5, windowMs: 60_000 }

    const results = await Promise.all(
      Array.from({ length: 25 }, () => consumeRateLimit(event, options, testDb()))
    )

    expect(results.filter((r) => r.allowed)).toHaveLength(5)
  })

  it('keeps separate identities separate', async () => {
    const options = { limit: 2, windowMs: 60_000 }
    await consumeRateLimit(eventFor('203.0.113.20'), options, testDb())
    await consumeRateLimit(eventFor('203.0.113.20'), options, testDb())

    const other = await consumeRateLimit(eventFor('203.0.113.21'), options, testDb())
    expect(other.allowed).toBe(true)
  })

  it('gives every query variant of a route ONE budget', async () => {
    // The old build keyed on the full path, so `?x=random` minted a fresh
    // bucket and every limit on the site was one header away from useless.
    const options = { limit: 3, windowMs: 60_000 }
    const paths = ['/api/auth/login?x=1', '/api/auth/login?x=2', '/api/auth/login?y=3', '/api/auth/login']

    const results = []
    for (const path of paths) {
      results.push(await consumeRateLimit(eventFor('203.0.113.30', path), options, testDb()))
    }

    expect(results.filter((r) => r.allowed)).toHaveLength(3)
    expect(results[3]?.allowed).toBe(false)
  })

  it('keeps separate routes separate', async () => {
    const options = { limit: 1, windowMs: 60_000 }
    await consumeRateLimit(eventFor('203.0.113.40', '/api/one'), options, testDb())
    const other = await consumeRateLimit(eventFor('203.0.113.40', '/api/two'), options, testDb())
    expect(other.allowed).toBe(true)
  })

  it('applies a per-subject budget on top of the per-IP one', async () => {
    // One account cannot be sprayed from many addresses without also hitting
    // its own ceiling.
    const options = { limit: 2, windowMs: 60_000, subject: 'victim@example.com' }
    await consumeRateLimit(eventFor('203.0.113.50'), options, testDb())
    await consumeRateLimit(eventFor('203.0.113.50'), options, testDb())
    const blocked = await consumeRateLimit(eventFor('203.0.113.50'), options, testDb())
    expect(blocked.allowed).toBe(false)

    const otherSubject = await consumeRateLimit(
      eventFor('203.0.113.50'),
      { ...options, subject: 'someone-else@example.com' },
      testDb()
    )
    expect(otherSubject.allowed).toBe(true)
  })

  it('starts a fresh window once the old one has passed', async () => {
    const event = eventFor('203.0.113.60')
    const options = { limit: 1, windowMs: 60_000 }

    expect((await consumeRateLimit(event, options, testDb())).allowed).toBe(true)
    expect((await consumeRateLimit(event, options, testDb())).allowed).toBe(false)

    // Age the bucket rather than waiting a minute.
    await testDb().execute(
      sql`UPDATE rate_limits SET expires_at = NOW() - INTERVAL '1 second', window_started_at = NOW() - INTERVAL '61 seconds'`
    )

    const afterWindow = await consumeRateLimit(event, options, testDb())
    expect(afterWindow.allowed).toBe(true)
    expect(afterWindow.remaining).toBe(0)
  })

  it('survives a restart, because the counter is not in memory', async () => {
    // The whole reason this lives in Postgres: a serverless instance is
    // recycled constantly, and an in-memory counter resets with it. A fresh
    // module instance must still see the earlier requests.
    const event = eventFor('203.0.113.70')
    const options = { limit: 2, windowMs: 60_000 }
    await consumeRateLimit(event, options, testDb())
    await consumeRateLimit(event, options, testDb())

    const reloaded = await import(`../../server/security/rateLimit?restart=${Date.now()}`)
    const blocked = await reloaded.consumeRateLimit(event, options, testDb())
    expect(blocked.allowed).toBe(false)
  })

  it('prunes expired buckets without touching live ones', async () => {
    await consumeRateLimit(eventFor('203.0.113.80'), { limit: 5, windowMs: 60_000 }, testDb())
    await consumeRateLimit(eventFor('203.0.113.81'), { limit: 5, windowMs: 60_000 }, testDb())
    await testDb().execute(sql`
      UPDATE rate_limits SET expires_at = NOW() - INTERVAL '1 second'
       WHERE bucket = (SELECT bucket FROM rate_limits ORDER BY bucket LIMIT 1)
    `)

    expect(await pruneRateLimits(1000, testDb())).toBe(1)

    const remaining = await testDb().execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM rate_limits`
    )
    expect(Number(remaining.rows[0]?.count)).toBe(1)
  })
})
