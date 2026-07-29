/**
 * Sign out of this browser.
 *
 * Deletes the session row rather than just clearing the cookie: a cookie the
 * customer discards is still a valid credential to anyone who copied it.
 */
import { defineRoute } from '../../security/handler'
import { destroySession } from '../../security/session'

export default defineRoute({
  access: 'public',
  rateLimit: 'standard',
  handler: async ({ event }) => {
    await destroySession(event)
    return { ok: true }
  },
})
