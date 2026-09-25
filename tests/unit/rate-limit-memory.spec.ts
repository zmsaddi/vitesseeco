/**
 * The in-memory rate limit store.
 *
 * This exists for one reason, and the reason is the test: the durable limiter
 * writes a row to Postgres on every single request, so a shop with steady
 * crawler traffic never let its Neon compute go idle, and a compute that is
 * never idle bills until the plan's quota is gone. That took the shop down
 * twice — the second time with a 500 on the product listing and a 404 on every
 * product page.
 *
 * So the property under test is not "it counts". It is "it counts WITHOUT
 * touching the database", which is why the executor here is a spy that records
 * whether it was used at all. A regression that quietly routes anonymous reads
 * back through Postgres would still count correctly and would still pass a test
 * that only checked the arithmetic.
 */
import { describe, expect, it } from 'vitest'
import { enforceRateLimit, RATE_LIMITS } from '../../server/security/rateLimit'
import { AppError, ERROR_CODES } from '../../shared/errors'

/** An event carrying a fixed identity, so a test controls its own bucket. */
function eventFor(ip: string, path = '/api/catalog/products') {
  return {
    method: 'GET',
    path,
    node: { req: { headers: { 'x-real-ip': ip }, socket: {} }, res: { setHeader: () => {} } },
    context: {},
  } as never
}

/**
 * A stand-in for the database that reports whether it was consulted.
 *
 * It resolves rather than throws on purpose: `enforceRateLimit` swallows store
 * failures by design, so a throwing fake would be indistinguishable from one
 * that was never called.
 */
function executorSpy() {
  let calls = 0
  return {
    calls: () => calls,
    executor: {
      execute: () => {
        calls += 1
        return Promise.resolve({ rows: [{ count: 1, expires_at: new Date(Date.now() + 60_000) }] })
      },
    },
  }
}

describe('in-memory rate limiting for anonymous reads', () => {
  it('never touches the database', async () => {
    const spy = executorSpy()
    const event = eventFor('203.0.113.50')

    for (let i = 0; i < 3; i++) {
      await enforceRateLimit(event, 'lookup', { ephemeral: true }, spy.executor as never)
    }

    expect(spy.calls()).toBe(0)
  })

  it('does not even ask for a database handle, with no DATABASE_URL and no executor passed', async () => {
    // The regression this catches shipped and was caught by a preview deployment:
    // `database: Executor = db()` was a DEFAULT PARAMETER, so it was evaluated at
    // the call site before the function body ran, and `db()` throws when
    // DATABASE_URL is absent. The throw landed outside the try that swallows
    // store failures, so every product listing answered 500 on any deployment
    // missing the variable — while passing every test that supplied an executor.
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      await expect(
        enforceRateLimit(eventFor('203.0.113.80'), 'lookup', { ephemeral: true })
      ).resolves.toBeUndefined()
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = saved
    }
  })

  it('does use the database when not ephemeral — so the flag is load-bearing', async () => {
    const spy = executorSpy()
    await enforceRateLimit(
      eventFor('203.0.113.51'),
      'lookup',
      { ephemeral: false },
      spy.executor as never
    )
    expect(spy.calls()).toBeGreaterThan(0)
  })

  it('still refuses once the budget is gone', async () => {
    const spy = executorSpy()
    // A scope of its own, so this test cannot be affected by any other.
    const scope = 'test:exhaustion'
    const event = eventFor('203.0.113.52')
    const limit = RATE_LIMITS.register.limit

    for (let i = 0; i < limit; i++) {
      await enforceRateLimit(event, 'register', { ephemeral: true, scope }, spy.executor as never)
    }

    await expect(
      enforceRateLimit(event, 'register', { ephemeral: true, scope }, spy.executor as never)
    ).rejects.toMatchObject({ code: ERROR_CODES.RATE_LIMITED })
    expect(spy.calls()).toBe(0)
  })

  it('keeps one visitor from spending another visitor budget', async () => {
    const spy = executorSpy()
    const scope = 'test:isolation'
    const limit = RATE_LIMITS.register.limit

    for (let i = 0; i < limit; i++) {
      await enforceRateLimit(
        eventFor('203.0.113.60'),
        'register',
        { ephemeral: true, scope },
        spy.executor as never
      )
    }

    // The first address is spent; a different one must still be served.
    await expect(
      enforceRateLimit(
        eventFor('203.0.113.61'),
        'register',
        { ephemeral: true, scope },
        spy.executor as never
      )
    ).resolves.toBeUndefined()
  })

  it('reports a retry delay a caller can act on', async () => {
    const spy = executorSpy()
    const scope = 'test:retry-after'
    const event = eventFor('203.0.113.70')
    const limit = RATE_LIMITS.register.limit

    for (let i = 0; i < limit; i++) {
      await enforceRateLimit(event, 'register', { ephemeral: true, scope }, spy.executor as never)
    }

    try {
      await enforceRateLimit(event, 'register', { ephemeral: true, scope }, spy.executor as never)
      throw new Error('expected the limiter to refuse')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const details = (error as AppError).details as { retryAfterSeconds?: number } | undefined
      expect(details?.retryAfterSeconds).toBeGreaterThan(0)
    }
  })
})
