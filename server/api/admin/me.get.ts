/**
 * Admin session probe. Used by the /admin route middleware to gate the UI.
 * Returns 401 (not logged in), 403 (logged in but not admin), or the admin
 * identity. Security is enforced per-endpoint via requireAdmin — this route
 * only exists so the client can fail fast with a redirect.
 */
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })
  const admin = await requireAdmin(event)
  return { ok: true, email: admin.email }
})
