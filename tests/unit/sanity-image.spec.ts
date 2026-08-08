import { describe, expect, it } from 'vitest'
import { getImage } from '../../providers/sanity-cdn'

/**
 * @nuxt/image was installed and never configured, so every product photo was
 * delivered at its master size — up to 2048×2048 — to phones included, on a
 * catalogue page showing two dozen of them. The `width` attribute set the
 * layout box and nothing else.
 */
const SANITY = 'https://cdn.sanity.io/images/2jvnjf0c/production/abc123-2048x2048.webp'

describe('the Sanity CDN image provider', () => {
  it('asks the CDN for the width the layout actually needs', () => {
    const { url } = getImage(SANITY, { modifiers: { width: 600 } })
    expect(url).toContain('w=600')
    expect(url.startsWith(SANITY)).toBe(true)
  })

  it('never enlarges past the master', () => {
    // `fit=max` returns the original when the request is larger, rather than an
    // upscaled blur that costs bytes and looks worse.
    const { url } = getImage(SANITY, { modifiers: { width: 4000 } })
    expect(url).toContain('fit=max')
  })

  it('lets the browser choose the format', () => {
    const { url } = getImage(SANITY, { modifiers: { width: 900 } })
    expect(url).toContain('auto=format')
  })

  it('carries a quality, and lets a caller override it', () => {
    expect(getImage(SANITY, { modifiers: { width: 900 } }).url).toContain('q=78')
    expect(getImage(SANITY, { modifiers: { width: 900, quality: 92 } }).url).toContain('q=92')
  })

  it('leaves anything that is not a Sanity URL completely alone', () => {
    // The brand mark and other local assets would not understand these
    // parameters, and appending them would turn a working URL into a 404.
    for (const src of ['/brand/logo-primary.svg', '/favicon.ico', 'https://example.com/a.png']) {
      expect(getImage(src, { modifiers: { width: 600 } }).url).toBe(src)
    }
  })

  it('works with no modifiers at all', () => {
    const { url } = getImage(SANITY)
    expect(url.startsWith(SANITY)).toBe(true)
    expect(url).toContain('auto=format')
  })
})
