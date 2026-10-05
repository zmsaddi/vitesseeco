import { describe, expect, it } from 'vitest'
import {
  customerMessage,
  feeFromMetadata,
  frenchDay,
  invoiceFooter,
  languageFor,
  paymentMethodLabel,
  planInvoice,
  type IssueInput,
  type PlanSource,
} from '../../server/payments/linkInvoices'
import { acknowledgementLines, buildHandoverPdf, decodeSignature, drawable } from '../../server/payments/handover'
import { cents } from '../../shared/money'

// A 1×1 transparent PNG — the smallest thing decodeSignature must accept once
// padded past its plausibility floor.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const source = (overrides: Partial<PlanSource> = {}): PlanSource => ({
  lineItems: [{ productId: 'prod_1', quantity: 1, subtotal: cents(135000), name: 'V8 ULTRA MAX T' }],
  discountAmount: cents(10000),
  shippingAmount: cents(0),
  amountTotal: cents(125000),
  promotionCode: 'WELCOMEVIENNA',
  fulfilment: 'pickup',
  paidOn: '2026-09-29',
  paymentMethod: 'Klarna',
  paymentIntentId: 'pi_123',
  deliveryFee: cents(3500),
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

const handover = (language: 'fr' | 'de' | 'nl' | 'es' | 'en', name = 'Client') => ({
  reference: 'pi_1',
  productName: 'Vélo',
  frameNumber: 'F1',
  deliveredOn: '01/10/2026',
  deliveredOnIso: '2026-10-01',
  handover: 'delivery' as const,
  language,
  customer: { name, address: 'Rue 1, 1000 Ville, XX', email: 'c@example.com', phone: null },
})

describe('planInvoice', () => {
  it('puts the trimmed frame number on the product line and in a field', () => {
    const plan = planInvoice(source(), input())
    expect(plan.lines).toHaveLength(1)
    expect(plan.lines[0]).toMatchObject({ kind: 'product', productId: 'prod_1', quantity: 1, unitAmount: 135000 })
    expect(plan.lines[0]!.description).toContain('N° de cadre TESTFRAME00001)')
    expect(plan.customFields.find((field) => field.name === 'N° de cadre')?.value).toBe('TESTFRAME00001')
  })

  it('builds the line from what was charged, per unit when it divides evenly', () => {
    const plan = planInvoice(source({ lineItems: [{ productId: 'prod_1', quantity: 2, subtotal: cents(270000), name: 'X' }] }), input())
    expect(plan.lines[0]).toMatchObject({ quantity: 2, unitAmount: 135000 })
  })

  it('invoices an uneven lot as one line that still equals what was charged', () => {
    const plan = planInvoice(source({ lineItems: [{ productId: 'prod_1', quantity: 3, subtotal: cents(1000), name: 'X' }] }), input())
    expect(plan.lines[0]).toMatchObject({ quantity: 1, unitAmount: 1000 })
    expect(plan.lines[0]!.description.startsWith('3 × X')).toBe(true)
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
    expect(collected.lines.find((line) => line.kind === 'delivery')?.unitAmount).toBe(3500)
    expect(collected.lines.find((line) => line.kind === 'delivery')?.description).not.toMatch(/Vienne|Wien/)
    expect(collected.description).toContain('frais de livraison réglés le 30/09/2026')
  })

  it('states the total the invoice must reach: what was paid, plus a fee collected at the door', () => {
    expect(planInvoice(source(), input()).expectedTotal).toBe(125000)
    expect(planInvoice(source({ fulfilment: 'delivery' }), input({ deliveryFeeCollected: true })).expectedTotal).toBe(128500)
    expect(planInvoice(source({ fulfilment: 'delivery' }), input({ deliveryFeeCollected: false })).expectedTotal).toBe(125000)
  })

  it('carries Stripe shipping as its own line', () => {
    const plan = planInvoice(source({ shippingAmount: cents(1290), amountTotal: cents(126290) }), input())
    expect(plan.lines.find((line) => line.kind === 'shipping')?.unitAmount).toBe(1290)
    expect(plan.expectedTotal).toBe(126290)
  })

  it('states that the invoice is settled, dated by the payment, and records the signed handover', () => {
    const plan = planInvoice(source(), input())
    expect(plan.description).toMatch(/^FACTURE ACQUITTÉE – réglée le 29\/09\/2026 \(Klarna\)/)
    expect(plan.description).toContain('pi_123')
    expect(plan.customFields.map((field) => field.name)).toEqual(['N° de cadre', 'Date de livraison', 'Paiement', 'Bon de livraison'])
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

describe('the legal footer', () => {
  it('carries the legal name, address, SIREN, RCS and VAT number', () => {
    const footer = invoiceFooter()
    expect(footer).toContain('VITESSE ECO SAS')
    expect(footer).toContain('SIREN 100 732 247')
    expect(footer).toContain('RCS Poitiers 100 732 247')
    expect(footer).toContain('FR43 100 732 247')
    expect(footer.length).toBeLessThanOrEqual(5000)
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
})

describe('a link states its own settings', () => {
  it('reads the delivery fee from the link metadata, in whole cents', () => {
    expect(feeFromMetadata({ delivery_fee_cents: '3500' })).toBe(3500)
    expect(feeFromMetadata({ delivery_fee_cents: ' 1290 ' })).toBe(1290)
  })

  it('refuses anything that is not a positive whole number of cents', () => {
    for (const raw of ['', '0', '-100', '35.00', '35€', 'abc', '99999999']) {
      expect(feeFromMetadata({ delivery_fee_cents: raw })).toBeNull()
    }
    expect(feeFromMetadata({})).toBeNull()
    expect(feeFromMetadata(null)).toBeNull()
  })

  it('invoices no delivery line for a link without a fee, even when ticked', () => {
    const plan = planInvoice(source({ fulfilment: 'delivery', deliveryFee: null }), input({ deliveryFeeCollected: true }))
    expect(plan.lines.some((line) => line.kind === 'delivery')).toBe(false)
  })

  it('uses whatever fee another link states', () => {
    const plan = planInvoice(source({ fulfilment: 'delivery', deliveryFee: cents(4900) }), input({ deliveryFeeCollected: true }))
    expect(plan.lines.find((line) => line.kind === 'delivery')?.unitAmount).toBe(4900)
  })
})

describe('the customer is written to in their language', () => {
  it.each([
    ['AT', 'de'], ['DE', 'de'], ['CH', 'de'],
    ['FR', 'fr'], ['BE', 'fr'], ['LU', 'fr'],
    ['NL', 'nl'], ['ES', 'es'],
    ['IT', 'en'], ['', 'en'], [null, 'en'], ['at', 'de'],
  ] as const)('%s → %s', (country, language) => {
    expect(languageFor(country)).toBe(language)
  })

  it.each([
    ['fr', /^Bonjour/, 'Votre facture'],
    ['de', /^Guten Tag/, 'Ihre Rechnung'],
    ['nl', /^Goedendag/, 'Uw factuur'],
    ['es', /^Hola/, 'Su factura'],
    ['en', /^Hello/, 'Your invoice'],
  ] as const)('%s message', (language, greeting, subject) => {
    const message = customerMessage('INV-1', 'https://invoice.stripe.com/i/x', language)
    expect(message.body).toMatch(greeting)
    expect(message.subject.startsWith(subject)).toBe(true)
    expect(message.body).toContain('INV-1')
    expect(message.body).toContain('https://invoice.stripe.com/i/x')
  })

  it('shows the customer what they sign: French, then their own language', () => {
    expect(acknowledgementLines('fr')).toHaveLength(1)
    const german = acknowledgementLines('de')
    expect(german).toHaveLength(2)
    expect(german[0]).toMatch(/^Le client confirme/)
    expect(german[1]).toMatch(/^Der Kunde bestätigt/)
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

  it('draws what the standard font can, drops control characters, marks the rest', () => {
    expect(drawable('Müller – 35 €')).toBe('Müller – 35 €')
    expect(drawable('محمود Ali')).toBe('????? Ali')
    expect(drawable('Ann\u0007a\u0000\u009b Smith​')).toBe('Anna Smith?')
  })

  it.each(['fr', 'de', 'nl', 'es', 'en'] as const)('builds the receipt in French + %s', async (language) => {
    const bytes = await buildHandoverPdf(handover(language), PNG_1PX)
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-')
  })

  it('builds the same bytes for the same handover — a retried upload is the same request', async () => {
    const first = Buffer.from(await buildHandoverPdf(handover('de'), PNG_1PX))
    await new Promise((resolve) => setTimeout(resolve, 1100))
    const second = Buffer.from(await buildHandoverPdf(handover('de'), PNG_1PX))
    expect(first.equals(second)).toBe(true)
  })

  it('survives a name in another script and with control characters', async () => {
    const bytes = await buildHandoverPdf(handover('en', 'محمود\u0007'), PNG_1PX)
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-')
  })
})
