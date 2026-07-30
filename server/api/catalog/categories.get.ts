/**
 * Categories, for the home page tiles and the listing filters.
 *
 * Read through the API like everything else so the dataset stays private and
 * the browser never learns that a document store is involved.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { listCategories } from '../../catalog'
import { localeSchema } from '../../../shared/schemas'
import type { LocaleCode } from '../../../shared/locales'

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  query: z.object({ locale: localeSchema.default('fr') }).strict(),
  handler: async ({ query }) => ({ categories: await listCategories(query.locale as LocaleCode) }),
})
