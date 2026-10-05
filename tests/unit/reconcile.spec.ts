import { describe, expect, it } from 'vitest'
import { providerPaymentState, stateOfSession } from '../../server/payments/reconcile'

describe('reading a Checkout Session as a payment state', () => {
  it.each([
    [{ status: 'complete', payment_status: 'paid' }, 'paid'],
    [{ status: 'complete', payment_status: 'no_payment_required' }, 'paid'],
    // SEPA and other delayed methods: complete, money still travelling.
    [{ status: 'complete', payment_status: 'unpaid' }, 'pending'],
    [{ status: 'expired', payment_status: 'unpaid' }, 'unpaid'],
    // Still open: the customer could pay in the next second.
    [{ status: 'open', payment_status: 'unpaid' }, 'unknown'],
  ] as const)('%o → %s', (session, expected) => {
    expect(stateOfSession(session)).toBe(expected)
  })
})

describe('asking about an order without the network', () => {
  const order = { orderNumber: 'ORD-1', stripeSessionId: null, paypalCaptureId: null }

  it('a PayPal capture on our side is money taken', async () => {
    expect(await providerPaymentState({ ...order, paymentMethod: 'paypal', paypalCaptureId: 'CAP-1' })).toBe('paid')
    expect(await providerPaymentState({ ...order, paymentMethod: 'paypal' })).toBe('unpaid')
  })

  it('a Stripe order that never got a session was never payable', async () => {
    expect(await providerPaymentState({ ...order, paymentMethod: 'stripe' })).toBe('unpaid')
  })

  it('a method it does not know is never read as unpaid', async () => {
    expect(await providerPaymentState({ ...order, paymentMethod: 'cod' })).toBe('unknown')
  })
})
