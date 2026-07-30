/**
 * Published articles.
 *
 * The browser reads editorial content through here for the same reason it reads
 * the catalogue through an API: the dataset stays private, and nothing about
 * the document store reaches the page.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { listArticles } from '../../catalog'
import { localeSchema } from '../../../shared/schemas'
import type { LocaleCode } from '../../../shared/locales'

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  query: z.object({ locale: localeSchema.default('fr') }).strict(),
  handler: async ({ query }) => ({ articles: await listArticles(query.locale as LocaleCode) }),
})
