import { describe, expect, it } from 'vitest'
import { stampNonce } from '../../server/security/headers'

/**
 * These guard a policy that fails CLOSED and silently. `strict-dynamic` makes a
 * browser ignore `'self'` and every host source in script-src, so an unstamped
 * page is not "slightly less secure" — it is a site where nothing executes.
 * Nothing in a build or a typecheck catches that.
 */
describe('stampNonce', () => {
  const NONCE = 'abc123'

  it('stamps the entry module Nuxt loads to hydrate the page', () => {
    const html = '<script type="module" src="/_nuxt/entry.js"></script>'
    expect(stampNonce(html, NONCE)).toBe(
      '<script nonce="abc123" type="module" src="/_nuxt/entry.js"></script>'
    )
  })

  it('stamps the inline hydration payload', () => {
    const html = '<script>window.__NUXT__=(function(){return {}})()</script>'
    expect(stampNonce(html, NONCE)).toContain('<script nonce="abc123">')
  })

  it('stamps modulepreload links', () => {
    // Fetched by the parser rather than by a trusted script, so strict-dynamic
    // does not cover them and they need a nonce of their own.
    const html = '<link rel="modulepreload" href="/_nuxt/chunk.js">'
    expect(stampNonce(html, NONCE)).toBe(
      '<link nonce="abc123" rel="modulepreload" href="/_nuxt/chunk.js">'
    )
  })

  it('stamps every tag in a chunk, not just the first', () => {
    const html =
      '<script src="/a.js"></script><link rel="modulepreload" href="/b.js"><script src="/c.js"></script>'
    expect(stampNonce(html, NONCE).match(/nonce="abc123"/g)).toHaveLength(3)
  })

  it('never gives a tag two nonces', () => {
    // A duplicate attribute is rejected by the parser, which would break the
    // very tag this is meant to allow.
    const once = stampNonce('<script src="/a.js"></script>', NONCE)
    expect(stampNonce(once, NONCE)).toBe(once)
  })

  it('leaves everything that is not a script or a link alone', () => {
    const html = '<div class="script"><p>link</p><style>a{}</style></div>'
    expect(stampNonce(html, NONCE)).toBe(html)
  })

  it('is not fooled by the word script inside text or an attribute', () => {
    const html = '<p data-note="script">a script tag</p>'
    expect(stampNonce(html, NONCE)).toBe(html)
  })

  it('handles an empty chunk', () => {
    expect(stampNonce('', NONCE)).toBe('')
  })
})
