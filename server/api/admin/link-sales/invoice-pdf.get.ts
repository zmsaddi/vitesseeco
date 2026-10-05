/**
 * The invoice PDF, through a fresh link each time.
 *
 * Stripe's PDF links are not permanent, so the panel never stores one: it asks
 * here, and is redirected to a link minted a moment ago.
 */
import { z } from 'zod'
import { sendRedirect } from 'h3'
import { defineRoute } from '../../../security/handler'
import { invoicePdfUrl } from '../../../payments/linkInvoices'

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: z.object({ invoice: z.string().regex(/^in_[A-Za-z0-9]+$/) }).strict(),
  handler: async ({ event, query }) => sendRedirect(event, await invoicePdfUrl(query.invoice), 302),
})
