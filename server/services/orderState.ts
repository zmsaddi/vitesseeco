/**
 * The order lifecycle.
 *
 * Declared once, as data. Every transition in the system is checked against
 * this table, so an order cannot move somewhere the business does not allow —
 * and, critically, cannot move BACKWARDS.
 *
 * That last point is not theoretical. Stripe redelivers webhooks for up to
 * three days, and the previous build wrote `status = 'paid'` unconditionally:
 * an event redelivered after an order had shipped reset it to paid, and the
 * admin queue showed it as awaiting processing a second time.
 */
import type { OrderStatus } from '../../shared/schemas'
import { AppError, ERROR_CODES } from '../../shared/errors'

/** What each status may become. A status with no exits is terminal. */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  // Created, nothing charged, nothing promised.
  draft: ['awaiting_payment', 'cancelled'],
  // The customer is at the payment provider, or the cash is yet to be collected.
  awaiting_payment: ['paid', 'cancelled'],
  // Money is ours. Stock is consumed.
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  // Once it is on the van, cancelling is a return, which is a different process.
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

/**
 * Statuses that hold reserved or consumed stock.
 *
 * Cancelling out of one of these must give the units back; cancelling out of
 * anything else must not, or stock is credited twice. `delivered` is absent on
 * purpose — the goods physically left, and a post-delivery return is an
 * explicit inventory decision, not an automatic one.
 */
const STOCK_HOLDING: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'draft',
  'awaiting_payment',
  'paid',
  'processing',
])

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
      internal: `an order cannot move from ${from} to ${to}`,
    })
  }
}

export function holdsStock(status: OrderStatus): boolean {
  return STOCK_HOLDING.has(status)
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0
}

/** Statuses an admin may set by hand, in the order they appear in the panel. */
export const ADMIN_SETTABLE: readonly OrderStatus[] = [
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

/** The timestamp column a status change should stamp, if any. */
export function timestampFor(status: OrderStatus): 'paidAt' | 'shippedAt' | 'deliveredAt' | 'cancelledAt' | null {
  switch (status) {
    case 'paid':
      return 'paidAt'
    case 'shipped':
      return 'shippedAt'
    case 'delivered':
      return 'deliveredAt'
    case 'cancelled':
      return 'cancelledAt'
    default:
      return null
  }
}
