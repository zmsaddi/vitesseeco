/**
 * Image provider for the Sanity CDN.
 *
 * `@nuxt/image` was installed and never configured, so every `<NuxtImg>` passed
 * its absolute `cdn.sanity.io` URL straight through. The `width` attribute set
 * the layout box and nothing else: a phone downloaded the same 2048×2048 file a
 * desktop did, on a catalogue page showing two dozen of them.
 *
 * Sanity's CDN resizes on the URL, so the fix is to say so. Anything that is
 * not a Sanity URL — the brand mark, a local asset — is returned untouched
 * rather than handed parameters it will not understand.
 */

interface Modifiers {
  width?: number | string
  height?: number | string
  quality?: number | string
  format?: string
  fit?: string
}

const SANITY_CDN = 'https://cdn.sanity.io/images/'

export function getImage(src: string, { modifiers = {} }: { modifiers?: Modifiers } = {}) {
  if (!src.startsWith(SANITY_CDN)) return { url: src }

  const params = new URLSearchParams()
  if (modifiers.width) params.set('w', String(modifiers.width))
  if (modifiers.height) params.set('h', String(modifiers.height))
  // `max` never enlarges past the original, so a 900px request against an
  // 800px master returns 800 rather than an upscaled blur.
  params.set('fit', modifiers.fit ?? 'max')
  params.set('q', String(modifiers.quality ?? 78))
  // Serves AVIF or WebP to browsers that accept them, the original otherwise.
  params.set('auto', 'format')

  return { url: `${src}?${params.toString()}` }
}

export const validateDomains = true
export const supportsAlias = false

// @nuxt/image imports a provider module by its default export.
export default { getImage, validateDomains, supportsAlias }
