/**
 * Telling a database outage apart from a bug.
 *
 * Every route error funnels through `respond` in server/security/handler.ts, and
 * an unreachable database used to arrive at the browser as a 500 — which invites
 * a crawler to treat the page as broken and a monitor to page someone about a
 * defect that does not exist. A 503 says "temporary" to both.
 *
 * The classification is a list of strings, so the risk runs both ways and both
 * are asserted here: it must recognise what a database says when it is
 * unavailable, and it must NOT swallow an ordinary programming error into a
 * status that tells everyone to try again later.
 */
import { describe, expect, it } from 'vitest'
import { isDatabaseUnavailable } from '../../server/security/handler'

/** The shape drizzle produces: the useful text is on the inner cause. */
function wrapped(inner: Error, depth = 1): Error {
  let error = inner
  for (let i = 0; i < depth; i++) {
    const outer = new Error('Failed query: SELECT 1')
    outer.name = 'DrizzleQueryError'
    ;(outer as Error & { cause?: unknown }).cause = error
    error = outer
  }
  return error
}

describe('recognising an unavailable database', () => {
  it('recognises the Neon quota wall that took the shop down', () => {
    const neon = new Error(
      'Server error (HTTP status 402): {"message":"Your account or project has exceeded the quota. Upgrade your plan to increase limits.","neon:retryable":true}'
    )
    neon.name = 'NeonDbError'
    expect(isDatabaseUnavailable(neon)).toBe(true)
  })

  it('recognises it through drizzle wrapping, which is how it actually arrives', () => {
    const neon = new Error('Server error (HTTP status 402): exceeded the quota')
    neon.name = 'NeonDbError'
    // Production showed it one level down; two is cheap insurance.
    expect(isDatabaseUnavailable(wrapped(neon, 1))).toBe(true)
    expect(isDatabaseUnavailable(wrapped(neon, 2))).toBe(true)
  })

  it('recognises the earlier wording, which named compute time explicitly', () => {
    expect(
      isDatabaseUnavailable(new Error('exceeded the compute time quota'))
    ).toBe(true)
  })

  it('recognises a missing connection string', () => {
    expect(isDatabaseUnavailable(new Error('DATABASE_URL is not set'))).toBe(true)
  })

  it.each([
    ['refused connection', 'connect ECONNREFUSED 127.0.0.1:5432'],
    ['timed out', 'connect ETIMEDOUT'],
    ['unresolvable host', 'getaddrinfo ENOTFOUND db.example.neon.tech'],
    ['dropped session', 'Connection terminated unexpectedly'],
    ['exhausted pool', 'sorry, too many connections already'],
  ])('recognises %s', (_label, message) => {
    expect(isDatabaseUnavailable(new Error(message))).toBe(true)
  })

  describe('and NOT mistaking a bug for an outage', () => {
    it.each([
      ['a typo', new TypeError('Cannot read properties of undefined (reading Slug)')],
      ['a bad column', new Error('column "prodcut_id" does not exist')],
      ['a constraint', new Error('duplicate key value violates unique constraint')],
      ['a parse failure', new SyntaxError('Unexpected token < in JSON at position 0')],
      ['a plain string', 'something went wrong'],
      ['nothing at all', undefined],
      ['null', null],
    ])('leaves %s classified as an internal error', (_label, error) => {
      expect(isDatabaseUnavailable(error)).toBe(false)
    })

    it('does not loop forever on a self-referencing cause', () => {
      const error = new Error('boom') as Error & { cause?: unknown }
      error.cause = error
      expect(isDatabaseUnavailable(error)).toBe(false)
    })
  })
})
