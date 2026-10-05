import { describe, expect, it } from 'vitest'
import { providerPaymentState, sessionModeMatchesKey, stateOfPayPalOrder, stateOfSession } from '../../server/payments/reconcile'

describe('reading a Checkout Session as a payment state', () => {
  it.each([
    [{ status: 'complete', payment_status: 'paid' }, 'paid'],
    [{ status: 'complete', payment_status: 'no_payment_required' }, 'paid'],
    [{ status: 'expired', payment_status: 'unpaid' }, 'unpaid'],
    // Still open: the customer could pay in the next second.
    [{ status: 'open', payment_status: 'unpaid' }, 'unknown'],
  ] as const)('%o → %s', (session, expected) => {
    expect(stateOfSession(session)).toBe(expected)
  })

  describe('complete but unpaid: the PaymentIntent decides', () => {
    it.each([
      ['succeeded', 'paid'],
      ['processing', 'pending'],
      ['requires_action', 'pending'],
      // A failed SEPA debit: deferring it would hold a place in the sweep forever.
      ['requires_payment_method', 'unpaid'],
      ['canceled', 'unpaid'],
    ] as const)('%s → %s', (status, expected) => {
      expect(stateOfSession({ status: 'complete', payment_status: 'unpaid', payment_intent: { status } })).toBe(expected)
    })

    it('stays pending when the intent was not expanded', () => {
      expect(stateOfSession({ status: 'complete', payment_status: 'unpaid', payment_intent: 'pi_1' })).toBe('pending')
    })
  })
})

describe('reading a PayPal order as a payment state', () => {
  it.each([
    [{ status: 'COMPLETED', captureId: 'CAP-1' }, 'paid'],
    // Completed with no capture listed is not something to act on.
    [{ status: 'COMPLETED', captureId: null }, 'unknown'],
    [{ status: 'CREATED', captureId: null }, 'unpaid'],
    [{ status: 'VOIDED', captureId: null }, 'unpaid'],
    [{ status: 'PAYER_ACTION_REQUIRED', captureId: null }, 'unpaid'],
    [{ status: 'UNKNOWN', captureId: null }, 'unknown'],
  ] as const)('%o → %s', (order, expected) => {
    expect(stateOfPayPalOrder(order)).toBe(expected)
  })

  it.each([
    ['COMPLETED', 'paid'],
    ['PENDING', 'pending'],
    ['DECLINED', 'unpaid'],
    ['FAILED', 'unpaid'],
    // Money moved and moved back: a person decides.
    ['REFUNDED', 'unknown'],
    ['PARTIALLY_REFUNDED', 'unknown'],
  ] as const)('a COMPLETED order whose capture is %s → %s', (captureStatus, expected) => {
    expect(stateOfPayPalOrder({ status: 'COMPLETED', captureId: 'CAP-1', captureStatus })).toBe(expected)
  })

  describe('an approved order that was never captured', () => {
    const now = new Date('2026-10-06T12:00:00Z')

    it('is not judged while a late capture may still be running', () => {
      expect(stateOfPayPalOrder({ status: 'APPROVED', captureId: null, updateTime: '2026-10-06T11:55:00Z' }, now)).toBe('unknown')
    })

    it('is abandoned once it has sat past the grace period', () => {
      expect(stateOfPayPalOrder({ status: 'APPROVED', captureId: null, updateTime: '2026-10-06T11:30:00Z' }, now)).toBe('unpaid')
    })

    it('is not judged when PayPal does not say when it changed', () => {
      expect(stateOfPayPalOrder({ status: 'APPROVED', captureId: null }, now)).toBe('unknown')
    })
  })
})

describe('a session looked up in the wrong Stripe mode', () => {
  it.each([
    ['cs_live_abc', 'sk_live_x', true],
    ['cs_live_abc', 'rk_live_x', true],
    ['cs_test_abc', 'sk_test_x', true],
    ['cs_live_abc', 'sk_test_x', false],
    ['cs_test_abc', 'sk_live_x', false],
  ] as const)('%s with %s → matches %s', (session, key, expected) => {
    expect(sessionModeMatchesKey(session, key)).toBe(expected)
  })
})

describe('asking about an order without the network', () => {
  const order = { orderNumber: 'ORD-1', stripeSessionId: null, paypalOrderId: null, paypalCaptureId: null }

  it('a PayPal capture on our side is money taken', async () => {
    expect(await providerPaymentState({ ...order, paymentMethod: 'paypal', paypalCaptureId: 'CAP-1' })).toBe('paid')
  })

  it('a PayPal order that was never created was never payable', async () => {
    expect(await providerPaymentState({ ...order, paymentMethod: 'paypal' })).toBe('unpaid')
  })

  it('a PayPal order exists but PayPal is not configured here: no answer, never "unpaid"', async () => {
    const saved = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET }
    delete process.env.PAYPAL_CLIENT_ID
    delete process.env.PAYPAL_CLIENT_SECRET
    try {
      expect(await providerPaymentState({ ...order, paymentMethod: 'paypal', paypalOrderId: 'PP-1' })).toBe('unknown')
    } finally {
      if (saved.id !== undefined) process.env.PAYPAL_CLIENT_ID = saved.id
      if (saved.secret !== undefined) process.env.PAYPAL_CLIENT_SECRET = saved.secret
    }
  })

  it('a Stripe order that never got a session was never payable', async () => {
    expect(await providerPaymentState({ ...order, paymentMethod: 'stripe' })).toBe('unpaid')
  })

  it('a method it does not know is never read as unpaid', async () => {
    expect(await providerPaymentState({ ...order, paymentMethod: 'cod' })).toBe('unknown')
  })
})
