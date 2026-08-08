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
  // Identical for every visitor and holds no stock figure, so a shared cache may
  // keep it. The listing route deliberately does not: it carries availability.
  cacheSeconds: 300,
  query: z.object({ locale: localeSchema.default('fr') }).strict(),
  handler: async ({ query }) => ({ categories: await listCategories(query.locale as LocaleCode) }),
})
