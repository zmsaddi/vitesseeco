/**
 * Sentry — client (browser) init.
 *
 * Gated by ENABLE_SENTRY=true AND a non-empty SENTRY_DSN. Either missing
 * makes the call a no-op and the SDK never installs handlers.
 *
 * Sampling stays low to fit the free tier:
 *   - errors:           100%   (errors are cheap; we want them all)
 *   - tracesSampleRate: 0.05   (5% of transactions get a perf trace)
 *   - replays:          0      (intentional — no session replay until budget allows)
 *
 * PII scrubbing is applied via beforeSend; we never let the SDK ship raw
 * email / phone / address / cart payloads to Sentry's servers.
 *
 * Release tag is the Vercel commit SHA when deployed; "local" otherwise.
 * Source-map upload is NOT configured here — that arrives in Sentry-2/-3.
 */
import * as Sentry from '@sentry/nuxt'

const enabled = import.meta.env.VITE_ENABLE_SENTRY === 'true' || (typeof process !== 'undefined' && process.env?.ENABLE_SENTRY === 'true')
const dsn = import.meta.env.VITE_SENTRY_DSN || (typeof process !== 'undefined' && process.env?.SENTRY_DSN) || ''

if (enabled && dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sampleRate: 1.0,
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'local',
    environment: import.meta.env.VITE_VERCEL_ENV || 'development',
    beforeSend(event) {
      return scrubPii(event)
    },
  })
}

function scrubPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  // Strip request body, cookies, auth-bearing headers, and user PII before
  // the event leaves the browser. Keep the event itself so we still get
  // stack traces.
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
  return event
}
