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
import { orderNumberSchema, LIMITS } from '../../../../shared/schemas'
import { ADMIN_SETTABLE } from '../../../services/orderState'
import { transitionOrder } from '../../../services/orders'
import { isOnline } from '../../../payments'
import { AppError, ERROR_CODES } from '../../../../shared/errors'
import { audit } from '../../../services/audit'

const bodySchema = z
  .object({
    status: z.enum(ADMIN_SETTABLE as unknown as [string, ...string[]]).optional(),
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
      .select({ status: orders.status, paymentMethod: orders.paymentMethod })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1)

    if (!before) throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `no order ${orderNumber}` })

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
      const result = await transitionOrder(orderNumber, body.status as never)
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
