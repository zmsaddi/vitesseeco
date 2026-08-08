import { describe, expect, it } from 'vitest'
import { applyApiHeaders } from '../../server/security/headers'

/**
 * Every API response was `no-store, private`, which is right for anything
 * carrying a customer, an order or an address — and wrong for the FAQ, the
 * category list and the article index, which are identical for every visitor
 * and were re-read from Sanity on every request.
 *
 * The dangerous half is the one worth testing: a shared cache holding an
 * authenticated response serves it to the NEXT visitor.
 */
function capture(): { headers: Record<string, string>; event: never } {
  const headers: Record<string, string> = {}
  // h3's setResponseHeader writes through event.node.res.setHeader.
  const event = {
    node: {
      res: {
        setHeader(name: string, value: string) {
          headers[name.toLowerCase()] = String(value)
        },
        getHeader: () => undefined,
        headersSent: false,
      },
    },
  } as unknown as never
  return { headers, event }
}

describe('applyApiHeaders', () => {
  it('stores nothing by default', () => {
    const { headers, event } = capture()
    applyApiHeaders(event)
    expect(headers['cache-control']).toBe('no-store, private')
    expect(headers).not.toHaveProperty('vary')
  })

  it('stores nothing when asked for zero seconds', () => {
    // The default flows through `definition.cacheSeconds ?? 0`, so zero has to
    // mean the same thing as omitted rather than "cache forever".
    const { headers, event } = capture()
    applyApiHeaders(event, 0)
    expect(headers['cache-control']).toBe('no-store, private')
  })

  it('lets a shared cache hold a public response, but not the browser', () => {
    const { headers, event } = capture()
    applyApiHeaders(event, 300)
    // s-maxage is the CDN; max-age=0 keeps the browser revalidating, so a
    // customer who reloads sees the current answer.
    expect(headers['cache-control']).toContain('s-maxage=300')
    expect(headers['cache-control']).toContain('max-age=0')
    expect(headers['cache-control']).toContain('public')
    expect(headers['cache-control']).not.toContain('private')
  })

  it('varies a cached response by language', () => {
    // Content routes answer in the visitor's language. A shared cache with no
    // Vary would serve the first caller's language to everyone behind it.
    const { headers, event } = capture()
    applyApiHeaders(event, 300)
    expect(headers.vary).toBe('Accept-Language')
  })

  it('never stops protecting the response itself', () => {
    for (const seconds of [0, 300]) {
      const { headers, event } = capture()
      applyApiHeaders(event, seconds)
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['referrer-policy']).toBe('no-referrer')
    }
  })
})
