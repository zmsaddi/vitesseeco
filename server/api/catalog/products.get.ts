/**
 * Product listing.
 *
 * The browser calls this instead of talking to the catalogue directly, which is
 * what allows the dataset to stay private. Every filter is validated before it
 * reaches a query, and every value is bound as a parameter — a search term
 * cannot alter the query it appears in.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { listProducts } from '../../catalog'
import { localeSchema } from '../../../shared/schemas'
import type { LocaleCode } from '../../../shared/locales'

const querySchema = z
  .object({
    locale: localeSchema.default('fr'),
    productType: z.enum(['bike', 'spare_part', 'accessory', 'kids_car', 'other']).optional(),
    category: z
      .string()
      .trim()
      .max(120)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    brand: z
      .string()
      .trim()
      .max(120)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    // Bounded and stripped of GROQ's operators, so it can only ever be a term.
    q: z
      .string()
      .trim()
      .max(80)
      .transform((value) => value.replace(/[^\p{L}\p{N}\s-]/gu, ''))
      .optional(),
    inStock: z.coerce.boolean().optional(),
    sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).default('relevance'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    perPage: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict()

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  query: querySchema,
  handler: async ({ query }) =>
    listProducts({
      locale: query.locale as LocaleCode,
      ...(query.productType ? { productType: query.productType } : {}),
      ...(query.category ? { categorySlug: query.category } : {}),
      ...(query.brand ? { brandSlug: query.brand } : {}),
      ...(query.q ? { search: query.q } : {}),
      ...(query.inStock ? { inStockOnly: true } : {}),
      sort: query.sort,
      page: query.page,
      perPage: query.perPage,
    }),
})
