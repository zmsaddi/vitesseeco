/**
 * Finish the invoice an interrupted attempt already numbered.
 *
 * The body is the sale and nothing else. The invoice states its own frame
 * number, date and customer, and its signed receipt is on file, so nothing is
 * typed or signed again — a customer who left with the bike cannot be asked to.
 *
 * Audited like an issue: it is the moment a numbered invoice becomes final.
 */
import { z } from 'zod'
import { defineRoute } from '../../../security/handler'
import { finishLinkInvoice } from '../../../payments/linkInvoices'
import { audit } from '../../../services/audit'

const bodySchema = z
  .object({
    sessionId: z.string().regex(/^cs_(live|test)_[A-Za-z0-9]+$/),
  })
  .strict()

export default defineRoute({
  access: 'admin',
  rateLimit: 'checkout',
  body: bodySchema,
  handler: async ({ body, customer }) => {
    const invoice = await finishLinkInvoice(body.sessionId)
    await audit({
      action: 'link_sale.invoiced',
      actorType: 'admin',
      actorId: customer?.id ?? null,
      resourceType: 'invoice',
      resourceId: invoice.id,
      metadata: {
        sessionId: body.sessionId,
        invoice: invoice.number,
        resumed: true,
        // Finished as it stood: nothing was typed that could differ from it.
        finishedAsNumbered: true,
        frameNumber: invoice.frameNumber,
        deliveredOn: invoice.deliveredOn,
      },
    })
    return { invoice }
  },
})
