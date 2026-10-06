/**
 * The signed bon de livraison, streamed through the server.
 *
 * Evidence files are private to the Stripe account and readable only with the
 * secret key, which never leaves this side — so the admin gets the bytes, not
 * a link.
 */
import { z } from 'zod'
import { setResponseHeader } from 'h3'
import { defineRoute } from '../../../security/handler'
import { readHandover } from '../../../payments/handover'

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: z.object({ file: z.string().regex(/^file_[A-Za-z0-9]+$/) }).strict(),
  handler: async ({ event, query }) => {
    const { bytes, name } = await readHandover(query.file)
    setResponseHeader(event, 'Content-Type', 'application/pdf')
    setResponseHeader(event, 'Content-Disposition', `inline; filename="${name.replace(/[^A-Za-z0-9._-]/g, '')}"`)
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
    return bytes
  },
})
