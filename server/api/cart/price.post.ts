/**
 * Price a basket.
 *
 * The client sends product ids and quantities; everything with a currency sign
 * comes back from here. That is the whole contract — there is no price to
 * tamper with in transit, and no signed snapshot to verify later, because the
 * browser was never trusted with a number in the first place.
 *
 * Amounts cross the wire as decimal strings. A float in JSON is a rounding
 * error waiting to be introduced by whoever parses it.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { cartSchema, countrySchema, localeSchema, postalCodeSchema } from '../../../shared/schemas'
import { priceBasket } from '../../services/pricing'
import { toDecimalString } from '../../../shared/money'
import type { LocaleCode } from '../../../shared/locales'

const bodySchema = z
  .object({
    cart: cartSchema,
    locale: localeSchema.default('fr'),
    shipping: z
      .object({
        methodCode: z.string().trim().min(1).max(60).regex(/^[a-z0-9_-]+$/),
        country: countrySchema,
        postalCode: postalCodeSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export default defineRoute({
  access: 'public',
  rateLimit: 'lookup',
  body: bodySchema,
  handler: async ({ body }) => {
    const breakdown = await priceBasket({
      lines: body.cart.lines,
      locale: body.locale as LocaleCode,
      ...(body.cart.promoCode ? { promoCode: body.cart.promoCode } : {}),
      ...(body.shipping
        ? {
            shipping: {
              methodCode: body.shipping.methodCode,
              country: body.shipping.country,
              ...(body.shipping.postalCode ? { postalCode: body.shipping.postalCode } : {}),
            },
          }
        : {}),
    })

    return {
      lines: breakdown.lines.map((line) => ({
        productId: line.productId,
        slug: line.slug,
        name: line.name,
        color: line.color,
        image: line.image,
        quantity: line.quantity,
        unitPrice: toDecimalString(line.unitPrice),
        lineTotal: toDecimalString(line.lineTotal),
        // What the customer can actually still buy, so the cart can correct
        // itself rather than failing at the payment step.
        available: line.available,
      })),
      subtotal: toDecimalString(breakdown.subtotal),
      discount: toDecimalString(breakdown.discount),
      shipping: toDecimalString(breakdown.shipping),
      total: toDecimalString(breakdown.total),
      promo: breakdown.promo,
      shippingMethod: breakdown.shippingMethod,
    }
  },
})
