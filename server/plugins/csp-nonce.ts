/**
 * Stamp the CSP nonce onto every script the page renders.
 *
 * The middleware issues a nonce and puts it in the Content-Security-Policy. This
 * is the other half, and without it the policy is not merely useless — it is
 * hostile. `script-src` carries `strict-dynamic`, which tells a CSP3 browser to
 * DISREGARD `'self'` and every host source in that directive. So the only thing
 * allowed to run is what carries the nonce, and if nothing does, nothing runs:
 * Nuxt's hydration bundle is blocked, and the site paints once and then sits
 * there. No cart, no checkout, no Stripe, no language switcher.
 *
 * It is done here, at the render boundary, rather than in each component,
 * because the tags that matter are the ones Nuxt emits for itself.
 */
import { NONCE_KEY, stampNonce } from '../security/headers'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const nonce = event.context[NONCE_KEY] as string | undefined
    // No nonce means the security middleware did not run for this response —
    // a prerendered route, say. Stamping a stale or empty value would be worse
    // than leaving the markup alone.
    if (!nonce) return

    const apply = (chunks: string[]): string[] => chunks.map((chunk) => stampNonce(chunk, nonce))

    html.head = apply(html.head)
    html.bodyPrepend = apply(html.bodyPrepend)
    html.body = apply(html.body)
    html.bodyAppend = apply(html.bodyAppend)
  })
})
