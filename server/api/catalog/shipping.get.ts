/**
 * Delivery options for a destination.
 *
 * Only methods that will actually be accepted at checkout are returned. Quoting
 * one the order endpoint later refuses walks the customer to the payment step
 * before failing — which is what the previous build did for every German and
 * Spanish address, by falling back to the French methods.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { shippingMethodsFor } from '../../catalog'
import { countrySchema, localeSchema, postalCodeSchema } from '../../../shared/schemas'
import { toDecimalString } from '../../../shared/money'
import type { LocaleCode } from '../../../shared/locales'

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  query: z
    .object({
      country: countrySchema,
      postalCode: postalCodeSchema.optional(),
      locale: localeSchema.default('fr'),
    })
    .strict(),
  handler: async ({ query }) => {
    const methods = await shippingMethodsFor(
      { country: query.country, ...(query.postalCode ? { postalCode: query.postalCode } : {}) },
      query.locale as LocaleCode
    )

    // Cents stay server-side; the wire carries a decimal string the client
    // formats per locale, so no float ever round-trips through JSON.
    return {
      methods: methods.map((method) => ({
        code: method.code,
        name: method.name,
        description: method.description,
        price: toDecimalString(method.price),
        priceCents: method.price,
        freeAbove: method.freeAbove === null ? null : toDecimalString(method.freeAbove),
        estimatedDays: method.estimatedDays,
      })),
    }
  },
})
