/**
 * A single product, with its other colours and its sellable quantity.
 *
 * An unknown slug is a 404, not an empty 200 — a soft 404 tells search engines
 * the page exists and leaves the visitor staring at nothing.
 */
import { z } from 'zod'
import { getRouterParam } from 'h3'
import { defineRoute } from '../../../security/handler'
import { getProduct } from '../../../catalog'
import { AppError, ERROR_CODES } from '../../../../shared/errors'
import { localeSchema } from '../../../../shared/schemas'
import type { LocaleCode } from '../../../../shared/locales'

const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/)

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  query: z.object({ locale: localeSchema.default('fr') }).strict(),
  handler: async ({ event, query }) => {
    const parsed = slugSchema.safeParse(getRouterParam(event, 'slug'))
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.NOT_FOUND, { internal: 'malformed product slug' })
    }
    return getProduct(parsed.data, query.locale as LocaleCode)
  },
})
