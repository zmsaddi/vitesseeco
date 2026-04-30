/**
 * Tag every Sentry transaction with the parameterised route, never the
 * raw URL.
 *
 * Why: Sentry's default tag for a transaction is the resolved URL, which
 * includes path params (e.g. `/api/orders/ORD-MOLMNP8P`). That makes alert
 * filtering by route unreliable — every order produces a unique URL —
 * and risks leaking order numbers via tag enumeration in the Sentry UI.
 *
 * Fix: hook into Nitro's request lifecycle and override the route tag with
 * the matched route template (e.g. `/api/orders/[orderNumber]`). Falls back
 * to the path without query string if no template is available.
 *
 * No-op when ENABLE_SENTRY is unset (the SDK isn't installed and
 * Sentry.getCurrentScope() resolves to a stub that ignores setTag).
 */
import * as Sentry from '@sentry/nuxt'

export default defineNitroPlugin((nitroApp) => {
  if (process.env.ENABLE_SENTRY !== 'true' || !process.env.SENTRY_DSN) return

  nitroApp.hooks.hook('request', (event) => {
    try {
      const matched = (event.context.matchedRoute as { path?: string } | undefined)?.path
      const path = (event.path || '').split('?')[0]
      const tag = matched || path || 'unknown'
      Sentry.getCurrentScope().setTag('route', tag)
    } catch {
      // never let instrumentation crash a request
    }
  })
})
