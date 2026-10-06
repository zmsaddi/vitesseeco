/**
 * Process an order.
 *
 * Status changes go through the same transition machine the webhooks use, so a
 * click cannot move an order somewhere a payment event could not — including
 * backwards. Marking a cash order paid is a separate, explicitly audited action
 * rather than a status the admin can simply pick, because it asserts that money
 * changed hands.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getRouterParam } from 'h3'
import { defineRoute } from '../../../security/handler'
import { db } from '../../../db/client'
import { orders } from '../../../db/schema'
import { orderNumberSchema, orderStatusSchema, LIMITS } from '../../../../shared/schemas'
import { ADMIN_SETTABLE } from '../../../services/orderState'
import { transitionOrder } from '../../../services/orders'
import { isOnline } from '../../../payments'
import { closeCheckout } from '../../../payments/reconcile'
import { AppError, ERROR_CODES } from '../../../../shared/errors'
import { audit } from '../../../services/audit'

const bodySchema = z
  .object({
    status: z.enum(ADMIN_SETTABLE as unknown as [string, ...string[]]).optional(),
    /**
     * The status the admin was looking at when they chose. A page left open
     * while the customer paid still offers "cancel" on what is now a paid
     * order; without this the click cancelled it and put the bike back on sale.
     */
    expectedStatus: orderStatusSchema.optional(),
    /** Records that cash was collected. Deliberately not a status choice. */
    markCashReceived: z.literal(true).optional(),
    trackingNumber: z.string().trim().max(120).optional(),
    carrier: z.string().trim().max(80).optional(),
    adminNotes: z.string().trim().max(LIMITS.MAX_NOTE_LENGTH).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'nothing to change')

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  body: bodySchema,
  handler: async ({ event, body, customer }) => {
    const parsed = orderNumberSchema.safeParse(getRouterParam(event, 'orderNumber'))
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.NOT_FOUND, { internal: 'malformed order number' })
    }
    const orderNumber = parsed.data

    const [before] = await db()
      .select({
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        stripeSessionId: orders.stripeSessionId,
        paypalOrderId: orders.paypalOrderId,
        paypalCaptureId: orders.paypalCaptureId,
      })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1)

    if (!before) throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `no order ${orderNumber}` })

    if (body.status && body.expectedStatus && before.status !== body.expectedStatus && before.status !== body.status) {
      throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
        messageKey: 'admin.order_changed',
        internal: `${orderNumber} is ${before.status}, the admin saw ${body.expectedStatus}`,
      })
    }

    const closingPayment =
      body.status === 'cancelled' && before.status === 'awaiting_payment' && isOnline(before.paymentMethod)
    if (closingPayment) {
      // The customer may still be paying. Close the payment first and cancel
      // only on a positive "nothing is coming" — the same answer the sweep
      // waits for — or the money lands on a cancelled order.
      const state = await closeCheckout({
        orderNumber,
        paymentMethod: before.paymentMethod,
        stripeSessionId: before.stripeSessionId,
        paypalOrderId: before.paypalOrderId,
        paypalCaptureId: before.paypalCaptureId,
      })
      if (state !== 'unpaid') {
        throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
          messageKey: `admin.cancel_refused_${state}`,
          internal: `${orderNumber} not cancelled: the payment provider reports ${state}`,
        })
      }
    }

    if (body.markCashReceived) {
      if (isOnline(before.paymentMethod)) {
        // An online order — Stripe, or the temporary PayPal bridge — is paid
        // when the provider says so. Letting an admin assert it by hand would
        // make the audit trail a matter of opinion.
        throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
          internal: 'an online order cannot be marked paid by hand',
        })
      }
      const result = await transitionOrder(orderNumber, 'paid', { expectFrom: 'awaiting_payment' })
      await audit({
        action: 'order.cash_received',
        actorType: 'admin',
        actorId: customer!.email,
        resourceType: 'order',
        resourceId: orderNumber,
        before: { status: before.status },
        after: { status: 'paid' },
        metadata: { changed: result.changed, paymentMethod: before.paymentMethod },
      })
    }

    if (body.status) {
      // Bound to what was checked: the status the admin saw, or — when the
      // payment was just closed — the awaiting_payment the provider was asked
      // about. Anything that moved the order in between wins, and is said.
      const expectFrom = body.expectedStatus ?? (closingPayment ? 'awaiting_payment' : undefined)
      const result = await transitionOrder(orderNumber, body.status as never, expectFrom ? { expectFrom } : {})
      if (!result.changed && result.from !== body.status) {
        throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
          messageKey: 'admin.order_changed',
          internal: `${orderNumber} moved to ${result.from} before it could become ${body.status}`,
        })
      }
      if (closingPayment && result.changed) await closeReplacementSession(orderNumber, before.stripeSessionId)
      await audit({
        action: 'order.status_change',
        actorType: 'admin',
        actorId: customer!.email,
        resourceType: 'order',
        resourceId: orderNumber,
        before: { status: result.from },
        after: { status: body.status },
        metadata: { changed: result.changed },
      })
    }

    // Tracking and notes are plain edits; they assert nothing about money and
    // are not part of the state machine.
    const edits: Record<string, string | Date | null> = {}
    if (body.trackingNumber !== undefined) edits.trackingNumber = body.trackingNumber || null
    if (body.carrier !== undefined) edits.carrier = body.carrier || null
    if (body.adminNotes !== undefined) edits.adminNotes = body.adminNotes || null

    if (Object.keys(edits).length > 0) {
      edits.updatedAt = new Date()
      await db().update(orders).set(edits).where(eq(orders.orderNumber, orderNumber))
    }

    const [after] = await db()
      .select({
        orderNumber: orders.orderNumber,
        status: orders.status,
        trackingNumber: orders.trackingNumber,
        carrier: orders.carrier,
        adminNotes: orders.adminNotes,
      })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1)

    return after
  },
})

/**
 * A checkout replay running at the same moment can attach a fresh Checkout
 * Session after the old one was expired and before the cancel landed. The
 * order is cancelled now, so that session is shut as well; money that reached
 * it in between is reported by the webhook as a payment on a closed order.
 */
async function closeReplacementSession(orderNumber: string, closed: string | null): Promise<void> {
  const [now] = await db()
    .select({ stripeSessionId: orders.stripeSessionId, paymentMethod: orders.paymentMethod })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1)
  if (!now?.stripeSessionId || now.stripeSessionId === closed) return
  await closeCheckout({
    orderNumber,
    paymentMethod: now.paymentMethod,
    stripeSessionId: now.stripeSessionId,
    paypalOrderId: null,
    paypalCaptureId: null,
  })
}
