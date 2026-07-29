import { describe, expect, it, vi } from 'vitest'
import {
  createSessionToken,
  generateOrderNumber,
  hashIp,
  hashPassword,
  hashToken,
  randomToken,
  safeEqual,
  verifyPassword,
} from '../../server/security/crypto'

describe('password hashing', () => {
  it('never stores the password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).not.toContain('correct horse')
    expect(hash.startsWith('$2')).toBe(true)
  })

  it('salts, so two identical passwords do not share a hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')])
    expect(a).not.toBe(b)
  })

  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false)
    expect(await verifyPassword('', hash)).toBe(false)
  })

  it('still does the work when there is no stored hash', async () => {
    // An OAuth-only account must not answer faster than a real one, or the
    // login form becomes an oracle for which emails exist and how they signed up.
    const started = Date.now()
    expect(await verifyPassword('anything', null)).toBe(false)
    expect(Date.now() - started).toBeGreaterThan(20)
  })
})

describe('session tokens', () => {
  it('returns a token and its hash, and the hash is not the token', () => {
    const { token, tokenHash } = createSessionToken()
    expect(token.length).toBeGreaterThanOrEqual(32)
    expect(tokenHash).toHaveLength(64)
    expect(tokenHash).not.toBe(token)
  })

  it('is url-safe, so it survives a cookie round trip untouched', () => {
    for (let i = 0; i < 200; i++) {
      expect(createSessionToken().token).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('never repeats', () => {
    const seen = new Set(Array.from({ length: 2000 }, () => createSessionToken().token))
    expect(seen.size).toBe(2000)
  })

  it('hashes deterministically, so a presented token can be looked up', () => {
    const { token, tokenHash } = createSessionToken()
    expect(hashToken(token)).toBe(tokenHash)
    expect(hashToken(`${token}x`)).not.toBe(tokenHash)
  })
})

describe('safeEqual', () => {
  it('compares correctly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
  })

  it('handles different lengths without throwing', () => {
    // timingSafeEqual rejects a length mismatch, and that rejection would itself
    // leak the length, so both sides are digested to a fixed width first.
    expect(safeEqual('short', 'considerably longer')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})

describe('hashIp', () => {
  it('is stable for the same address', () => {
    expect(hashIp('203.0.113.7')).toBe(hashIp('203.0.113.7'))
  })

  it('separates different addresses', () => {
    expect(hashIp('203.0.113.7')).not.toBe(hashIp('203.0.113.8'))
  })

  it('does not contain the address it came from', () => {
    expect(hashIp('203.0.113.7')).not.toContain('203.0.113')
  })

  it('is keyed, so the value cannot be reversed by hashing every IPv4 address', () => {
    vi.stubEnv('IP_HASH_SALT', 'salt-one')
    const withFirstSalt = hashIp('203.0.113.7')
    vi.stubEnv('IP_HASH_SALT', 'salt-two')
    const withSecondSalt = hashIp('203.0.113.7')
    vi.unstubAllEnvs()
    expect(withFirstSalt).not.toBe(withSecondSalt)
  })
})

describe('order numbers', () => {
  it('matches the shape every consumer validates', () => {
    expect(generateOrderNumber()).toMatch(/^ORD-[A-Z0-9]{6,20}$/)
  })

  it('does not collide, even generated in the same millisecond', () => {
    // A timestamp alone collides under concurrent checkout, and order_number is
    // unique — so the loser would fail after its payment session already existed.
    // An earlier 24-bit suffix failed this at 20k; 40 bits clears 100k.
    const generated = new Set(Array.from({ length: 100_000 }, () => generateOrderNumber()))
    expect(generated.size).toBe(100_000)
  })

  it('avoids the characters customers mishear on the phone', () => {
    const sample = Array.from({ length: 500 }, () => generateOrderNumber().slice(-8)).join('')
    expect(sample).not.toMatch(/[ILOU]/)
  })

  it('sorts chronologically for the same-length prefix', () => {
    const first = generateOrderNumber()
    const later = generateOrderNumber()
    expect(first.slice(0, 10) <= later.slice(0, 10)).toBe(true)
  })
})

describe('randomToken', () => {
  it('is url-safe and unique', () => {
    const tokens = Array.from({ length: 1000 }, () => randomToken(16))
    expect(new Set(tokens).size).toBe(1000)
    expect(tokens.every((t) => /^[A-Za-z0-9_-]+$/.test(t))).toBe(true)
  })
})
