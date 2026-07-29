/**
 * Security headers on every response.
 *
 * Middleware rather than per-route, because a header that protects only the
 * routes someone remembered protects nothing. API responses additionally
 * declare themselves uncacheable — a shared cache holding an authenticated
 * response and serving it to the next visitor is a data leak, and shared caches
 * are exactly where that happens.
 */
import { defineEventHandler } from 'h3'
import { applyApiHeaders, applySecurityHeaders } from '../security/headers'

export default defineEventHandler((event) => {
  applySecurityHeaders(event)
  if (event.path.startsWith('/api/')) {
    applyApiHeaders(event)
  }
})
