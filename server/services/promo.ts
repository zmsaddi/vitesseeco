/**
 * Promotion redemption.
 *
 * The definition lives in the catalogue, where the owner edits it. The count of
 * uses lives here, because deciding who gets the last remaining use of a code
 * between two simultaneous checkouts is a thing only a relational database can
 * do.
 *
 * There is no counter column. The count IS the number of redemption rows, so
 * there is no second number that can drift from the first — which is what the
 * previous build's 224-line reserve-and-compensate saga existed to paper over.
 */
import { and, eq, sql } from 'drizzle-orm'
import { db, queryRows, type SqlExecutor, type Transaction } from '../db/client'
import { promoRedemptions } from '../db/schema'
import { AppError, ERROR_CODES } from '../../shared/errors'
import type { Cents } from '../../shared/money'

/** How many times a code has been used. */
export async function countPromoRedemptions(
  code: string,
  executor: SqlExecutor = db()
): Promise<number> {
  const rows = await queryRows<{ count: string }>(
    executor,
    sql`SELECT COUNT(*)::text AS count FROM promo_redemptions WHERE code = ${code.toUpperCase()}`
  )
  return Number(rows[0]?.count ?? 0)
}

/**
 * Record a redemption inside the order transaction.
 *
 * `maxUses` is enforced here, under the same lock that writes the row, so two
 * checkouts racing for the final use cannot both succeed. Enforcing it earlier
 * — when the basket was priced — would only be advisory, because the world can
 * move between pricing and paying.
 *
 * The unique index on order_id means a retried order cannot consume a second
 * use of the same code.
 */
export async function redeemPromo(
  tx: Transaction,
  input: {
    code: string
    orderId: string
    customerId: string | null
    discount: Cents
    maxUses: number | null
  }
): Promise<void> {
  const code = input.code.toUpperCase()

  if (input.maxUses !== null) {
    // Serialise everyone interested in this code. Advisory locks are keyed on a
    // number, so the code is hashed to one — cheaper than locking a table and
    // it releases with the transaction.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`promo:${code}`}))`)

    const used = await countPromoRedemptions(code, tx)
    if (used >= input.maxUses) {
      throw new AppError(ERROR_CODES.PROMO_EXHAUSTED, {
        internal: `promo ${code} is used up (${used}/${input.maxUses})`,
      })
    }
  }

  await tx.insert(promoRedemptions).values({
    code,
    orderId: input.orderId,
    customerId: input.customerId,
    discountCents: input.discount,
  })
}

/**
 * Give a use back when an order is cancelled before it was ever paid.
 *
 * Deleting the row restores the count exactly, because the count is the rows.
 */
export async function releasePromo(tx: Transaction, orderId: string): Promise<number> {
  const removed = await tx
    .delete(promoRedemptions)
    .where(eq(promoRedemptions.orderId, orderId))
    .returning({ id: promoRedemptions.id })
  return removed.length
}

/** Whether a specific customer has already used a code. */
export async function hasCustomerRedeemed(
  code: string,
  customerId: string,
  executor: SqlExecutor = db()
): Promise<boolean> {
  const rows = await queryRows<{ exists: boolean }>(
    executor,
    sql`
      SELECT EXISTS (
        SELECT 1 FROM promo_redemptions
         WHERE code = ${code.toUpperCase()} AND customer_id = ${customerId}
      ) AS exists
    `
  )
  return Boolean(rows[0]?.exists)
}

export { and }
