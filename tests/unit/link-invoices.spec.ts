import { describe, expect, it } from 'vitest'
import {
  VIENNA_DELIVERY_FEE,
  customerMessage,
  frenchDay,
  paymentMethodLabel,
  planInvoice,
  type IssueInput,
  type PlanSource,
} from '../../server/payments/linkInvoices'
import { decodeSignature, drawable, buildHandoverPdf } from '../../server/payments/handover'
import { cents } from '../../shared/money'

// A 1×1 transparent PNG — the smallest thing decodeSignature must accept once
// padded past its plausibility floor.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const source = (overrides: Partial<PlanSource> = {}): PlanSource => ({
  lineItems: [{ priceId: 'price_1', quantity: 1, name: 'V8 ULTRA MAX T' }],
  discountAmount: cents(10000),
  promotionCode: 'WELCOMEVIENNA',
  fulfilment: 'pickup',
  paidOn: '2026-09-29',
  paymentMethod: 'Klarna',
  paymentIntentId: 'pi_123',
  ...overrides,
})

const input = (overrides: Partial<IssueInput> = {}): IssueInput => ({
  sessionId: 'cs_live_abc',
  frameNumber: '  TESTFRAME00001 ',
  deliveredOn: '2026-09-30',
  billing: { name: 'A B', line1: 'Musterstrasse 1', postalCode: '1030', city: 'Wien', country: 'AT' },
  deliveryFeeCollected: true,
  signature: 'data:image/png;base64,',
  ...overrides,
})

describe('planInvoice', () => {
  it('puts the trimmed frame number on the product line and in a field', () => {
    const plan = planInvoice(source(), input())
    expect(plan.lines).toHaveLength(1)
    expect(plan.lines[0]).toMatchObject({ kind: 'product', priceId: 'price_1', quantity: 1 })
    expect(plan.lines[0]!.description).toContain('N° de cadre TESTFRAME00001)')
    expect(plan.customFields.find((field) => field.name === 'N° de cadre')?.value).toBe('TESTFRAME00001')
  })

  it('names the promotion code on the discount', () => {
    expect(planInvoice(source(), input()).discount).toEqual({ amount: 10000, label: 'Code WELCOMEVIENNA' })
    expect(planInvoice(source({ promotionCode: null }), input()).discount?.label).toBe('Remise')
    expect(planInvoice(source({ discountAmount: cents(0) }), input()).discount).toBeNull()
  })

  it('adds the delivery fee only for a delivery whose fee was collected', () => {
    const pickup = planInvoice(source(), input({ deliveryFeeCollected: true }))
    expect(pickup.lines.some((line) => line.kind === 'delivery')).toBe(false)

    const uncollected = planInvoice(source({ fulfilment: 'delivery' }), input({ deliveryFeeCollected: false }))
    expect(uncollected.lines.some((line) => line.kind === 'delivery')).toBe(false)

    const collected = planInvoice(source({ fulfilment: 'delivery' }), input({ deliveryFeeCollected: true }))
    expect(collected.lines.find((line) => line.kind === 'delivery')?.amount).toBe(VIENNA_DELIVERY_FEE)
    expect(collected.description).toContain('frais de livraison réglés le 30/09/2026')
  })

  it('states that the invoice is settled and records the signed handover', () => {
    const plan = planInvoice(source(), input())
    expect(plan.description).toMatch(/^FACTURE ACQUITTÉE – réglée le 29\/09\/2026 \(Klarna\)/)
    expect(plan.description).toContain('pi_123')
    expect(plan.customFields.map((field) => field.name)).toEqual([
      'N° de cadre',
      'Date de livraison',
      'Paiement',
      'Bon de livraison',
    ])
  })

  it('keeps every custom field inside Stripe’s limits', () => {
    const plan = planInvoice(source({ fulfilment: 'delivery' }), input({ frameNumber: 'X'.repeat(40) }))
    expect(plan.customFields.length).toBeLessThanOrEqual(4)
    for (const field of plan.customFields) {
      expect(field.name.length).toBeLessThanOrEqual(40)
      expect(field.value.length).toBeLessThanOrEqual(140)
    }
  })
})

describe('small formatters', () => {
  it('turns an ISO day into a French one without a Date', () => {
    expect(frenchDay('2026-09-29')).toBe('29/09/2026')
  })

  it('labels payment methods and falls back to the raw type', () => {
    expect(paymentMethodLabel('klarna')).toBe('Klarna')
    expect(paymentMethodLabel('card')).toBe('Carte bancaire')
    expect(paymentMethodLabel('twint')).toBe('twint')
    expect(paymentMethodLabel(null)).toBe('Paiement en ligne')
  })

  it('writes the customer message in German with the link', () => {
    const message = customerMessage('KH1VPJZA-0002', 'https://pay.stripe.com/x')
    expect(message.subject).toContain('KH1VPJZA-0002')
    expect(message.body).toContain('https://pay.stripe.com/x')
    expect(message.body).toMatch(/^Guten Tag/)
  })
})

describe('signature and receipt', () => {
  it('refuses anything that is not a PNG of plausible size', () => {
    expect(() => decodeSignature('data:image/jpeg;base64,AAAA')).toThrow()
    expect(() => decodeSignature('data:image/png;base64,' + Buffer.from('not a png at all'.repeat(10)).toString('base64'))).toThrow()
    expect(() => decodeSignature('data:image/png;base64,' + Buffer.alloc(400_000, 1).toString('base64'))).toThrow()
  })

  it('accepts a real PNG', () => {
    const padded = Buffer.concat([PNG_1PX, Buffer.alloc(200)])
    expect(decodeSignature('data:image/png;base64,' + padded.toString('base64')).subarray(0, 4).toString('latin1')).toBe('\x89PNG')
  })

  it('replaces characters the standard PDF fonts cannot draw', () => {
    expect(drawable('Müller – 35 €')).toBe('Müller – 35 €')
    expect(drawable('محمود Ali')).toBe('????? Ali')
  })

  it('builds a one-page PDF even for a name in another script', async () => {
    const bytes = await buildHandoverPdf(
      {
        reference: 'pi_123',
        productName: 'V8 ULTRA MAX T',
        frameNumber: 'TESTFRAME00001',
        deliveredOn: '30/09/2026',
        handover: 'pickup',
        customer: { name: 'محمود', address: 'Musterstrasse 1, 1030 Wien, AT', email: null, phone: '+43' },
      },
      PNG_1PX
    )
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-')
  })
})
