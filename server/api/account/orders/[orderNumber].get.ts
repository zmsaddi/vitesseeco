/**
 * One order, for the customer who placed it.
 *
 * Ownership is part of the WHERE clause rather than a check on the result, so
 * there is no instant at which another customer's row has been read. An order
 * that exists but belongs to someone else answers exactly as one that never
 * existed — any other answer turns this route into an oracle for which order
 * numbers are real.
 *
 * Only orders attached to the account are returned. A guest order is not
 * matched on its email: nothing verifies that a registration owns the address
 * it was given, so that would hand a stranger's order to whoever signed up with
 * their address.
 */
import { and, asc, eq, inArray } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { defineRoute } from '../../../security/handler'
import { db } from '../../../db/client'
import { orderItems, orders } from '../../../db/schema'
import { getProductsByIds } from '../../../catalog'
import { AppError, ERROR_CODES } from '../../../../shared/errors'
import { DEFAULT_LOCALE, isLocaleCode } from '../../../../shared/locales'
import { cents, toDecimalString } from '../../../../shared/money'
import { orderNumberSchema } from '../../../../shared/schemas'

/** The delivery address as it was stored, projected field by field. */
interface StoredAddress {
  firstName: string | null
  lastName: string | null
  phone: string | null
  line1: string | null
  line2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
}

/**
 * Never `...address`. The column is jsonb, so it holds whatever an older
 * version of the checkout happened to write; naming the eight fields means a
 * stray one cannot travel to the browser and the page's typed shape is the
 * wire shape.
 */
function projectAddress(value: unknown): StoredAddress | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const text = (key: string): string | null =>
    typeof raw[key] === 'string' && raw[key] !== '' ? (raw[key] as string) : null

  return {
    firstName: text('firstName'),
    lastName: text('lastName'),
    phone: text('phone'),
    line1: text('line1'),
    line2: text('line2'),
    postalCode: text('postalCode'),
    city: text('city'),
    country: text('country'),
  }
}

export default defineRoute({
  access: 'customer',
  rateLimit: 'standard',
  handler: async ({ event, customer, market }) => {
    const parsed = orderNumberSchema.safeParse(
      String(getRouterParam(event, 'orderNumber') ?? '').trim().toUpperCase()
    )
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.NOT_FOUND, { internal: 'malformed order number' })
    }

    const me = customer!
    const email = me.email.toLowerCase()

    const [order] = await db()
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        locale: orders.locale,
        paymentMethod: orders.paymentMethod,
        shippingMethodCode: orders.shippingMethodCode,
        subtotalCents: orders.subtotalCents,
        discountCents: orders.discountCents,
        shippingCents: orders.shippingCents,
        totalCents: orders.totalCents,
        vatRateBp: orders.vatRateBp,
        vatCents: orders.vatCents,
        promoCode: orders.promoCode,
        shippingAddress: orders.shippingAddress,
        trackingNumber: orders.trackingNumber,
        carrier: orders.carrier,
        notes: orders.notes,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        shippedAt: orders.shippedAt,
        deliveredAt: orders.deliveredAt,
        cancelledAt: orders.cancelledAt,
      })
      .from(orders)
      // Ownership is part of the WHERE clause, never a check on the result:
      // there is no moment at which someone else's row has been fetched.
      //
      // A guest order is NOT matched on its email address. Registration does not
      // verify that a signup owns the address they typed — emailVerifiedAt is
      // written only by the Google callback and read nowhere — so matching on it
      // would mean anyone who registers with a victim's address is handed that
      // victim's order in full: name, phone, street, items, tracking. Giving a
      // guest access needs a signed link in their confirmation email, which is
      // a thing to build, not a condition to relax here.
      .where(and(eq(orders.orderNumber, parsed.data), eq(orders.customerId, me.id)))
      .limit(1)

    // An order that exists but belongs to someone else answers exactly as one
    // that never existed. Any other answer turns this route into an oracle for
    // which order numbers are real.
    if (!order) {
      throw new AppError(ERROR_CODES.NOT_FOUND, {
        internal: `${me.id} requested order ${parsed.data}, which is not theirs`,
      })
    }

    const lines = await db()
      .select({
        productId: orderItems.productId,
        name: orderItems.nameSnapshot,
        color: orderItems.colorSnapshot,
        image: orderItems.imageSnapshot,
        quantity: orderItems.quantity,
        unitPriceCents: orderItems.unitPriceCents,
        lineTotalCents: orderItems.lineTotalCents,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.createdAt))

    /**
     * What each line is worth buying again today.
     *
     * The line itself is frozen — name, colour, image and price are what was
     * bought, and must not change because the catalogue was edited since. The
     * reorder button needs the opposite: whether the product is still sold and
     * how many are left. Both travel, and the page never has to guess.
     *
     * Priced in the locale the order was placed in, so a product withdrawn from
     * one market does not read as withdrawn from all of them.
     */
    const catalogueLocale = isLocaleCode(order.locale) ? order.locale : DEFAULT_LOCALE
    let live: Map<string, { slug: string; available: number }> | null = null
    try {
      const current = await getProductsByIds(
        lines.map((line) => line.productId),
        catalogueLocale,
        market
      )
      live = new Map(
        [...current.values()].map((product) => [
          product.id,
          { slug: product.slug, available: product.available },
        ])
      )
    } catch (error) {
      // A catalogue outage must not hide someone's order from them. Availability
      // becomes null — "not checked" rather than "gone" — and the basket, which
      // reprices server-side anyway, remains the authority on what can be bought.
      console.error('[account/order] catalogue unreachable, availability unknown', error)
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      shippingMethod: order.shippingMethodCode,
      subtotal: toDecimalString(cents(order.subtotalCents)),
      discount: toDecimalString(cents(order.discountCents)),
      shipping: toDecimalString(cents(order.shippingCents)),
      total: toDecimalString(cents(order.totalCents)),
      // VAT is contained in the total, never added to it: EU consumer prices
      // are quoted gross, and the customer is entitled to see how much of what
      // they paid was tax.
      vat: {
        ratePercent: order.vatRateBp / 100,
        amount: toDecimalString(cents(order.vatCents)),
      },
      promoCode: order.promoCode,
      shippingAddress: projectAddress(order.shippingAddress),
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      notes: order.notes,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      items: lines.map((line) => {
        const now = live?.get(line.productId) ?? null
        return {
          productId: line.productId,
          name: line.name,
          color: line.color,
          image: line.image,
          quantity: line.quantity,
          unitPrice: toDecimalString(cents(line.unitPriceCents)),
          lineTotal: toDecimalString(cents(line.lineTotalCents)),
          /** Null when the product is no longer published — nothing to link to. */
          slug: now?.slug ?? null,
          /** Null when we could not ask the catalogue at all. */
          available: live ? (now?.available ?? 0) : null,
        }
      }),
    }
  },
})
