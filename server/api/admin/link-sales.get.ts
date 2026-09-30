/**
 * Sales made through a Stripe Payment Link — the ones with no order row.
 *
 * Read straight from Stripe on every request: there is nothing of ours to
 * cache, and the invoice state lives on the PaymentIntent.
 */
import { defineRoute } from '../../security/handler'
import { listLinkSales } from '../../payments/linkInvoices'

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  handler: async () => ({ items: await listLinkSales() }),
})
