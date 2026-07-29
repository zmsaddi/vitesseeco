/**
 * Save an address.
 *
 * The "only one default" rule is enforced by a partial unique index in the
 * database, so this clears the previous default inside the same transaction
 * rather than hoping no two requests arrive together.
 */
import { and, eq, sql } from 'drizzle-orm'
import { defineRoute } from '../../security/handler'
import { saveAddressSchema, LIMITS } from '../../../shared/schemas'
import { withTransaction, queryRows } from '../../db/client'
import { addresses } from '../../db/schema'
import { AppError, ERROR_CODES } from '../../../shared/errors'

export default defineRoute({
  access: 'customer',
  rateLimit: 'standard',
  body: saveAddressSchema,
  handler: async ({ body, customer }) =>
    withTransaction(async (tx) => {
      const counted = await queryRows<{ count: string }>(
        tx,
        sql`SELECT COUNT(*)::text AS count FROM addresses WHERE customer_id = ${customer!.id}`
      )
      if (Number(counted[0]?.count ?? 0) >= LIMITS.MAX_ADDRESSES_PER_CUSTOMER) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
          details: { issues: [{ path: 'address', message: 'errors.too_many_addresses' }] },
          internal: 'address limit reached',
        })
      }

      // The first address a customer saves is their default, whether or not
      // they thought to say so.
      const shouldBeDefault = body.isDefault === true || Number(counted[0]?.count ?? 0) === 0

      if (shouldBeDefault) {
        await tx
          .update(addresses)
          .set({ isDefault: false })
          .where(and(eq(addresses.customerId, customer!.id), eq(addresses.isDefault, true)))
      }

      const [created] = await tx
        .insert(addresses)
        .values({
          customerId: customer!.id,
          label: body.label ?? null,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone ?? null,
          line1: body.line1,
          line2: body.line2 ?? null,
          postalCode: body.postalCode,
          city: body.city,
          country: body.country,
          isDefault: shouldBeDefault,
        })
        .returning()

      return created
    }),
})
