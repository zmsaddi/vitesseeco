/**
 * Who is signed in.
 *
 * Returns null for a guest rather than a 401, because a guest asking is not an
 * error — this is how the client learns which of the two interfaces to render.
 */
import { defineRoute } from '../../security/handler'

export default defineRoute({
  access: 'public',
  rateLimit: 'standard',
  handler: async ({ customer }) =>
    customer
      ? {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          locale: customer.locale,
        }
      : null,
})
