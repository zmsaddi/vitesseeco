/**
 * Who is signed in.
 *
 * Returns null for a guest rather than a 401, because a guest asking is not an
 * error — this is how the client learns which of the two interfaces to render.
 */
import { defineRoute, isAdminEmail } from '../../security/handler'

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
          // Lets the account page offer a localised link into the panel. It is
          // a hint for rendering, never a permission: every admin route checks
          // the allowlist again server-side.
          isAdmin: isAdminEmail(customer.email),
        }
      : null,
})
