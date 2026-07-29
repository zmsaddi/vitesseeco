import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import { assertSameOrigin, clientIp, edgeCountry, routeKey } from '../../server/security/request'
import { AppError, ERROR_CODES } from '../../shared/errors'

/**
 * A minimal stand-in for an H3 event. Only the parts these functions read are
 * modelled, so a change in what they read shows up as a test that stops
 * compiling rather than one that silently passes.
 */
function makeEvent(options: {
  method?: string
  path?: string
  headers?: Record<string, string>
  remoteAddress?: string
}): H3Event {
  const headers = new Map(
    Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  )
  return {
    method: options.method ?? 'GET',
    path: options.path ?? '/api/test',
    node: {
      req: {
        headers: Object.fromEntries(headers),
        socket: { remoteAddress: options.remoteAddress ?? '10.0.0.1' },
      },
      res: { setHeader: () => {} },
    },
    context: {},
  } as unknown as H3Event
}

describe('clientIp', () => {
  it('prefers the header our own edge sets', () => {
    const event = makeEvent({ headers: { 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '1.2.3.4' } })
    expect(clientIp(event)).toBe('203.0.113.5')
  })

  it('takes the LAST forwarded hop, not the first', () => {
    // The client can prepend entries, so the leftmost is attacker-controlled.
    // Trusting it is what made every per-IP limit bypassable in the old build.
    const event = makeEvent({ headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 203.0.113.5' } })
    expect(clientIp(event)).toBe('203.0.113.5')
  })

  it('cannot be spoofed by a single forged entry', () => {
    const spoofed = makeEvent({ headers: { 'x-forwarded-for': 'attacker-chosen' } })
    const real = makeEvent({ headers: { 'x-forwarded-for': 'attacker-chosen, 203.0.113.5' } })
    expect(clientIp(spoofed)).not.toBe(clientIp(real))
  })

  it('falls back to the socket when no proxy header is present', () => {
    expect(clientIp(makeEvent({ remoteAddress: '127.0.0.1' }))).toBe('127.0.0.1')
  })
})

describe('routeKey', () => {
  it('drops the query string, which the caller controls', () => {
    // Keying a rate limit on the full path let `?x=random` mint a fresh budget.
    expect(routeKey(makeEvent({ path: '/api/auth/login?x=random' }))).toBe('/api/auth/login')
    expect(routeKey(makeEvent({ path: '/api/auth/login' }))).toBe('/api/auth/login')
  })

  it('gives every query variant of a route the same key', () => {
    const keys = ['?a=1', '?a=2', '?b=3', ''].map((suffix) =>
      routeKey(makeEvent({ path: `/api/search${suffix}` }))
    )
    expect(new Set(keys).size).toBe(1)
  })
})

describe('assertSameOrigin', () => {
  it('lets safe methods through untouched', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(() =>
        assertSameOrigin(makeEvent({ method, headers: { 'sec-fetch-site': 'cross-site' } }))
      ).not.toThrow()
    }
  })

  it('rejects a state change the browser marked cross-site', () => {
    const event = makeEvent({ method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } })
    expect(() => assertSameOrigin(event)).toThrow(AppError)
    try {
      assertSameOrigin(event)
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.CSRF_REJECTED)
    }
  })

  it('rejects a foreign origin even when the fetch metadata is absent', () => {
    const event = makeEvent({ method: 'POST', headers: { origin: 'https://evil.example' } })
    expect(() => assertSameOrigin(event)).toThrow(AppError)
  })

  it('accepts our own origins', () => {
    for (const origin of [
      'https://vitesse-eco.fr',
      'https://www.vitesse-eco.fr',
      'https://vitesse-eco.de',
      'https://vitesse-eco.nl',
    ]) {
      expect(() =>
        assertSameOrigin(makeEvent({ method: 'POST', headers: { origin } }))
      ).not.toThrow()
    }
  })

  it('rejects a look-alike domain', () => {
    for (const origin of ['https://vitesse-eco.fr.evil.example', 'https://vitesseeco.fr', 'https://vitesse-eco.co']) {
      expect(() => assertSameOrigin(makeEvent({ method: 'POST', headers: { origin } }))).toThrow(AppError)
    }
  })

  it('accepts a same-origin post', () => {
    expect(() =>
      assertSameOrigin(
        makeEvent({
          method: 'POST',
          headers: { 'sec-fetch-site': 'same-origin', origin: 'https://vitesse-eco.fr' },
        })
      )
    ).not.toThrow()
  })

  it('allows a non-browser client carrying neither signal', () => {
    // CSRF needs a victim's browser. A tool or server has no ambient cookies,
    // so the session cookie remains the real gate.
    expect(() => assertSameOrigin(makeEvent({ method: 'POST' }))).not.toThrow()
  })

  it('covers every state-changing method', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(() =>
        assertSameOrigin(makeEvent({ method, headers: { 'sec-fetch-site': 'cross-site' } }))
      ).toThrow(AppError)
    }
  })
})

describe('edgeCountry', () => {
  it('reads the CDN hint', () => {
    expect(edgeCountry(makeEvent({ headers: { 'x-vercel-ip-country': 'NL' } }))).toBe('NL')
    expect(edgeCountry(makeEvent({ headers: { 'cf-ipcountry': 'BE' } }))).toBe('BE')
  })

  it('is absent when the edge said nothing', () => {
    expect(edgeCountry(makeEvent({}))).toBeUndefined()
  })
})
