import { describe, expect, it } from 'vitest'
import {
  ADMIN_SETTABLE,
  assertTransition,
  canTransition,
  holdsStock,
  isTerminal,
  timestampFor,
} from '../../server/services/orderState'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { ORDER_STATUSES, type OrderStatus } from '../../shared/schemas'
import { availableMethods, assertMethodAllowed, isOnline, PAYMENT_METHODS } from '../../server/payments'
import { cents } from '../../shared/money'

describe('order transitions', () => {
  it('allows the normal path through to delivery', () => {
    const path: OrderStatus[] = ['draft', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered']
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i] as OrderStatus, path[i + 1] as OrderStatus)).toBe(true)
    }
  })

  it('never allows an order to move backwards', () => {
    // This is the defect that mattered: Stripe redelivers for three days, and
    // the old build wrote status='paid' unconditionally, so an event arriving
    // after dispatch reset a shipped order and it was queued for packing twice.
    const order: OrderStatus[] = ['draft', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered']
    for (let later = 1; later < order.length; later++) {
      for (let earlier = 0; earlier < later; earlier++) {
        expect(canTransition(order[later] as OrderStatus, order[earlier] as OrderStatus)).toBe(false)
      }
    }
  })

  it('refuses to skip payment', () => {
    expect(canTransition('draft', 'paid')).toBe(false)
    expect(canTransition('awaiting_payment', 'shipped')).toBe(false)
    expect(canTransition('draft', 'delivered')).toBe(false)
  })

  it('treats delivered and cancelled as final', () => {
    expect(isTerminal('delivered')).toBe(true)
    expect(isTerminal('cancelled')).toBe(true)
    for (const status of ORDER_STATUSES) {
      if (status !== 'delivered' && status !== 'cancelled') {
        expect(isTerminal(status)).toBe(false)
      }
    }
  })

  it('cannot resurrect a cancelled order', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition('cancelled', status)).toBe(false)
    }
  })

  it('allows cancelling up to dispatch, and not after', () => {
    for (const status of ['draft', 'awaiting_payment', 'paid', 'processing'] as OrderStatus[]) {
      expect(canTransition(status, 'cancelled')).toBe(true)
    }
    // Once it is on the van it is a return, which is a different process.
    expect(canTransition('shipped', 'cancelled')).toBe(false)
    expect(canTransition('delivered', 'cancelled')).toBe(false)
  })

  it('throws a typed error on an impossible move', () => {
    expect(() => assertTransition('shipped', 'paid')).toThrow(AppError)
    try {
      assertTransition('shipped', 'paid')
    } catch (error) {
      expect((error as AppError).code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION)
    }
  })

  it('declares every status in the table', () => {
    // A status with no entry would throw at runtime on first use.
    for (const status of ORDER_STATUSES) {
      expect(() => canTransition(status, 'cancelled')).not.toThrow()
    }
  })
})

describe('stock-holding statuses', () => {
  it('holds stock from creation until dispatch', () => {
    for (const status of ['draft', 'awaiting_payment', 'paid', 'processing'] as OrderStatus[]) {
      expect(holdsStock(status)).toBe(true)
    }
  })

  it('does not hold stock once delivered or cancelled', () => {
    // `delivered` is excluded deliberately: the goods physically left, so a
    // return is an explicit inventory decision, not an automatic credit.
    expect(holdsStock('delivered')).toBe(false)
    expect(holdsStock('cancelled')).toBe(false)
  })
})

describe('timestamps', () => {
  it('stamps the milestones and nothing else', () => {
    expect(timestampFor('paid')).toBe('paidAt')
    expect(timestampFor('shipped')).toBe('shippedAt')
    expect(timestampFor('delivered')).toBe('deliveredAt')
    expect(timestampFor('cancelled')).toBe('cancelledAt')
    expect(timestampFor('draft')).toBeNull()
    expect(timestampFor('awaiting_payment')).toBeNull()
    expect(timestampFor('processing')).toBeNull()
  })
})

describe('admin-settable statuses', () => {
  it('does not let an admin mark an order paid by hand', () => {
    // Payment is asserted by the provider, not by a click. Marking cash orders
    // paid is a separate, audited action.
    expect(ADMIN_SETTABLE).not.toContain('paid')
    expect(ADMIN_SETTABLE).not.toContain('draft')
    expect(ADMIN_SETTABLE).not.toContain('awaiting_payment')
  })
})

describe('payment methods', () => {
  const BIKE_TOTAL = cents(95000)

  it('offers online payment everywhere we ship', () => {
    for (const country of ['FR', 'BE', 'NL', 'DE', 'ES']) {
      const codes = availableMethods({ country, shippingCode: 'standard', total: BIKE_TOTAL }).map((m) => m.code)
      expect(codes).toContain('stripe')
    }
  })

  it('offers cash on delivery only where our own van goes', () => {
    for (const country of ['BE', 'NL']) {
      const codes = availableMethods({ country, shippingCode: 'own-fleet', total: BIKE_TOTAL }).map((m) => m.code)
      expect(codes).toContain('cod')
    }
    for (const country of ['FR', 'DE', 'ES']) {
      const codes = availableMethods({ country, shippingCode: 'standard', total: BIKE_TOTAL }).map((m) => m.code)
      expect(codes).not.toContain('cod')
    }
  })

  it('caps cash on delivery, because a driver should not carry unlimited notes', () => {
    const codes = availableMethods({ country: 'BE', shippingCode: 'own-fleet', total: cents(400000) }).map((m) => m.code)
    expect(codes).not.toContain('cod')
  })

  it('offers paying at the counter only when the customer is collecting', () => {
    expect(
      availableMethods({ country: 'FR', shippingCode: 'pickup', total: BIKE_TOTAL }).map((m) => m.code)
    ).toContain('in_store')
    expect(
      availableMethods({ country: 'FR', shippingCode: 'standard', total: BIKE_TOTAL }).map((m) => m.code)
    ).not.toContain('in_store')
  })

  it('offers nothing for a zero total', () => {
    expect(availableMethods({ country: 'FR', shippingCode: 'pickup', total: cents(0) })).toEqual([])
  })

  it('re-checks on the server, so a client cannot name a method it was not offered', () => {
    // The browser chooses from a list; the list is not the authority.
    expect(() =>
      assertMethodAllowed('cod', { country: 'ES', shippingCode: 'standard', total: BIKE_TOTAL })
    ).toThrow(AppError)
    expect(() =>
      assertMethodAllowed('cod', { country: 'BE', shippingCode: 'own-fleet', total: cents(500000) })
    ).toThrow(AppError)
    expect(() =>
      assertMethodAllowed('in_store', { country: 'FR', shippingCode: 'standard', total: BIKE_TOTAL })
    ).toThrow(AppError)
  })

  it('accepts a legitimate choice', () => {
    expect(() =>
      assertMethodAllowed('stripe', { country: 'NL', shippingCode: 'standard', total: BIKE_TOTAL })
    ).not.toThrow()
    expect(() =>
      assertMethodAllowed('cod', { country: 'NL', shippingCode: 'own-fleet', total: BIKE_TOTAL })
    ).not.toThrow()
  })

  it('knows which methods send the customer to a payment form', () => {
    expect(isOnline('stripe')).toBe(true)
    expect(isOnline('cod')).toBe(false)
    expect(isOnline('in_store')).toBe(false)
  })

  it('names no card brand or wallet in code', () => {
    // Card, iDEAL, Bancontact, Klarna, PayPal, SEPA and the wallets all arrive
    // through the one online method and are enabled in the Stripe Dashboard.
    // Hard-coding any of them here would make each addition a deployment.
    const codes = Object.keys(PAYMENT_METHODS)
    expect(codes).toEqual(['stripe', 'cod', 'in_store'])
  })
})
