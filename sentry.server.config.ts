/**
 * Sentry — server (Nitro) init.
 *
 * Mirrors sentry.client.config.ts: ENABLE_SENTRY + SENTRY_DSN both required,
 * either missing => no-op. Same low sampling and PII scrubbing.
 *
 * The release tag pulls from VERCEL_GIT_COMMIT_SHA so Sentry can tie an
 * error back to a specific deploy. Source-map upload remains off until
 * Sentry-2/-3 adds SENTRY_AUTH_TOKEN.
 *
 * Route normalisation (turning `/api/orders/[orderNumber]` into a stable
 * tag rather than a per-order URL) is handled by the Nitro plugin in
 * server/plugins/sentry-route-tag.ts.
 */
import * as Sentry from '@sentry/nuxt'

if (process.env.ENABLE_SENTRY === 'true' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
    sampleRate: 1.0,
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    environment: process.env.VERCEL_ENV || 'development',
    beforeSend(event) {
      return scrubPii(event)
    },
  })
}

function scrubPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request) {
    if (event.request.cookies) event.request.cookies = '[redacted]' as any
    if (event.request.data) event.request.data = '[redacted]'
    if (event.request.headers) {
      const h = event.request.headers as Record<string, string>
      delete h.cookie
      delete h.authorization
      delete h['x-cron-secret']
    }
  }
  if (event.user) {
    delete event.user.email
    delete event.user.ip_address
    delete (event.user as any).phone
  }
  // Strip any extra context keys that may carry PII downstream
  if (event.contexts) {
    for (const k of ['cart', 'customer', 'order', 'address']) {
      if ((event.contexts as any)[k]) (event.contexts as any)[k] = '[redacted]'
    }
  }
  return event
}
