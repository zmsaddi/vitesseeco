/**
 * Issue the invoice for one Payment Link sale, after the handover.
 *
 * Audited like marking cash received: it asserts that a bike with this frame
 * number left the shop on this day, which is what a dispute will be argued on.
 */
import { z } from 'zod'
import { defineRoute } from '../../../security/handler'
import { issueLinkInvoice } from '../../../payments/linkInvoices'
import { MAX_SIGNATURE_BYTES } from '../../../payments/handover'
import { audit } from '../../../services/audit'
import { CONTROL_CHARACTERS, HANDOVER_LIMITS } from '../../../../shared/handoverForm'

// The page holds the form to these same rules before the customer signs, so a
// refusal here is a bug or a tampered request — never a second signature.
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !CONTROL_CHARACTERS.test(value))

const bodySchema = z
  .object({
    sessionId: z.string().regex(/^cs_(live|test)_[A-Za-z0-9]+$/),
    frameNumber: text(HANDOVER_LIMITS.frameNumber),
    deliveredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    billing: z
      .object({
        name: text(HANDOVER_LIMITS.name),
        line1: text(HANDOVER_LIMITS.line1),
        postalCode: text(HANDOVER_LIMITS.postalCode),
        city: text(HANDOVER_LIMITS.city),
        country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
      })
      .strict(),
    deliveryFeeCollected: z.boolean(),
    // Base64 inflates by a third; the decoded size is checked again server-side.
    signature: z.string().startsWith('data:image/png;base64,').max(Math.ceil(MAX_SIGNATURE_BYTES * 1.4)),
  })
  .strict()

export default defineRoute({
  access: 'admin',
  // Twenty in fifteen minutes is weeks of handovers; anything faster is not a
  // person at a counter.
  rateLimit: 'checkout',
  body: bodySchema,
  handler: async ({ body, customer }) => {
    const invoice = await issueLinkInvoice(body)
    await audit({
      action: 'link_sale.invoiced',
      actorType: 'admin',
      actorId: customer?.id ?? null,
      resourceType: 'invoice',
      resourceId: invoice.id,
      metadata: {
        sessionId: body.sessionId,
        invoice: invoice.number,
        // A resumed issue finished an earlier attempt's invoice; it numbered
        // nothing new, and what the invoice states is the earlier attempt's.
        resumed: invoice.resumed,
        frameNumber: invoice.frameNumber,
        deliveredOn: invoice.deliveredOn,
        // What was typed and NOT invoiced, field by field: the credit note that
        // corrects the invoice is written from this.
        ...(invoice.differs
          ? {
              differences: invoice.differences,
              submittedFrameNumber: body.frameNumber,
              submittedDeliveredOn: body.deliveredOn,
              submittedBilling: body.billing,
              submittedDeliveryFeeCollected: body.deliveryFeeCollected,
            }
          : {}),
      },
    })
    return { invoice }
  },
})
