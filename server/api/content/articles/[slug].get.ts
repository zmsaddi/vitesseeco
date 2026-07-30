/** One article, with the products it talks about priced live. */
import { z } from 'zod'
import { getRouterParam } from 'h3'
import { defineRoute } from '../../../security/handler'
import { getArticle } from '../../../catalog'
import { localeSchema } from '../../../../shared/schemas'
import { AppError, ERROR_CODES } from '../../../../shared/errors'
import type { LocaleCode } from '../../../../shared/locales'

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/)

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  query: z.object({ locale: localeSchema.default('fr') }).strict(),
  handler: async ({ event, query }) => {
    const slug = slugSchema.safeParse(getRouterParam(event, 'slug'))
    if (!slug.success) {
      throw new AppError(ERROR_CODES.NOT_FOUND, { internal: 'malformed article slug' })
    }
    return getArticle(slug.data, query.locale as LocaleCode)
  },
})
