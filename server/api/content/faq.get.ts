/** Published FAQ entries, ordered as the owner arranged them in the Studio. */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { listFaqs } from '../../catalog'
import { localeSchema } from '../../../shared/schemas'
import type { LocaleCode } from '../../../shared/locales'

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  // Identical for every visitor and holds no stock figure, so a shared cache may
  // keep it. The listing route deliberately does not: it carries availability.
  cacheSeconds: 600,
  query: z.object({ locale: localeSchema.default('fr') }).strict(),
  handler: async ({ query }) => ({ faqs: await listFaqs(query.locale as LocaleCode) }),
})
