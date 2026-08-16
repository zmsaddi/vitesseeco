/**
 * The candidate rig's two safety guards, proven without opening a socket.
 *
 * One tool truncates a whole database; the other swaps the shop's catalogue
 * for test data. Both decide from URLs and environment facts alone, so both
 * are pure — and a pure guard gets its refusals asserted here, not trusted
 * from a comment.
 */
import { describe, expect, it } from 'vitest'
import { isLoopbackUrl } from '../../shared/loopback-url.mjs'
import { fixtureActivationProblems } from '../../server/catalog/fixture'

describe('isLoopbackUrl — the seed script and fixture rig target rule', () => {
  it('accepts localhost', () => {
    expect(isLoopbackUrl('postgres://vitesse:vitesse@localhost:5544/vitesse_dev')).toBe(true)
  })

  it('accepts 127.0.0.1', () => {
    expect(isLoopbackUrl('postgres://vitesse:vitesse@127.0.0.1:5432/anything')).toBe(true)
  })

  it('accepts IPv6 loopback', () => {
    expect(isLoopbackUrl('postgres://vitesse:vitesse@[::1]:5432/vitesse_dev')).toBe(true)
  })

  it('rejects a remote host even when the database is named like a test', () => {
    expect(isLoopbackUrl('postgres://user:pass@remote.example.com/vitesse_test')).toBe(false)
  })

  it('decides by host alone: a scary name on loopback is allowed', () => {
    expect(isLoopbackUrl('postgres://vitesse:vitesse@localhost/production')).toBe(true)
  })

  it('rejects lookalike hosts, garbage and absence', () => {
    expect(isLoopbackUrl('postgres://u:p@localhost.evil.com/db')).toBe(false)
    expect(isLoopbackUrl('postgres://u:p@127.0.0.1.evil.com/db')).toBe(false)
    expect(isLoopbackUrl('not a url at all')).toBe(false)
    expect(isLoopbackUrl('')).toBe(false)
    expect(isLoopbackUrl(undefined)).toBe(false)
  })
})

describe('fixtureActivationProblems — the fixture catalogue contract', () => {
  const validRig = {
    CANDIDATE_TEST_RIG: '1',
    NUXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
    DATABASE_URL: 'postgres://vitesse:vitesse@localhost:5544/vitesse_dev',
  }

  it('accepts a complete candidate rig', () => {
    expect(fixtureActivationProblems(validRig)).toEqual([])
  })

  it('refuses without the explicit sentinel', () => {
    const problems = fixtureActivationProblems({ ...validRig, CANDIDATE_TEST_RIG: undefined })
    expect(problems.some((p) => p.includes('CANDIDATE_TEST_RIG'))).toBe(true)
  })

  it('refuses a remote database even with the sentinel set', () => {
    const problems = fixtureActivationProblems({
      ...validRig,
      DATABASE_URL: 'postgres://user:pass@db.example.com/vitesse_test',
    })
    expect(problems.some((p) => p.includes('DATABASE_URL'))).toBe(true)
  })

  it('refuses a public site URL even with the sentinel set', () => {
    const problems = fixtureActivationProblems({
      ...validRig,
      NUXT_PUBLIC_SITE_URL: 'https://vitesse-eco.fr',
    })
    expect(problems.some((p) => p.includes('NUXT_PUBLIC_SITE_URL'))).toBe(true)
  })

  it('refuses Vercel absolutely, whatever else is set', () => {
    for (const vercel of [{ VERCEL: '1' }, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview' }]) {
      const problems = fixtureActivationProblems({ ...validRig, ...vercel })
      expect(problems.some((p) => p.includes('Vercel'))).toBe(true)
    }
  })

  it('names every unmet term at once, not just the first', () => {
    const problems = fixtureActivationProblems({
      VERCEL: '1',
      NUXT_PUBLIC_SITE_URL: 'https://vitesse-eco.fr',
      DATABASE_URL: 'postgres://u:p@db.example.com/x',
    })
    expect(problems.length).toBe(4)
  })
})
