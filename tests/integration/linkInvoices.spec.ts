/**
 * Link-sale invoices when an attempt was interrupted — against a real lock.
 *
 * The rule under test is the numbering: a French invoice number may never be
 * issued twice for one sale, nor left dangling. Stripe is played by an
 * in-memory double (fakeStripe.ts); the advisory lock that keeps two attempts
 * apart is PostgreSQL's own, reached through the production accessor.
 */
import type Stripe from 'stripe'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../shared/errors'
import { finishLinkInvoice, issueLinkInvoice, listLinkSales, type Reversal } from '../../server/payments/linkInvoices'
import { closePool, hasDatabase } from './setup'
import { FakeStripe, type SaleSetup } from './fakeStripe'

const state = vi.hoisted(() => ({ fake: null as unknown as { client: unknown } }))
vi.mock('../../server/payments/stripe', () => ({ stripe: () => state.fake.client }))

const SESSION = 'cs_test_interrupted1'
const INTENT = `pi_${SESSION}`
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())

// A 1×1 PNG, padded past decodeSignature's plausibility floor.
const SIGNATURE =
  'data:image/png;base64,' +
  Buffer.concat([
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
    Buffer.alloc(200),
  ]).toString('base64')

const BILLING = { name: 'MAX MUSTERMANN', line1: 'Musterstrasse 1', postalCode: '1010', city: 'Wien', country: 'AT' }

const input = (overrides: Partial<Parameters<typeof issueLinkInvoice>[0]> = {}) => ({
  sessionId: SESSION,
  frameNumber: 'FRAME-1',
  deliveredOn: today,
  billing: { ...BILLING },
  deliveryFeeCollected: false,
  signature: SIGNATURE,
  ...overrides,
})

/** The invoice the first attempt numbered before it was cut off. */
function numberedEarlier(fake: FakeStripe, status: 'open' | 'paid' | 'uncollectible', total = 125000): void {
  fake.addInvoice({
    id: 'in_earlier',
    status,
    number: 'TEST-0001',
    total,
    customer_name: BILLING.name,
    customer_address: { line1: BILLING.line1, postal_code: BILLING.postalCode, city: BILLING.city, country: BILLING.country },
    metadata: { checkout_session: SESSION, frame_number: 'FRAME-1', delivered_on: today, handover_file: 'file_earlier' },
  })
}

let fake: FakeStripe

/** A sale the panel invoiced as TEST-0001, with whatever happened to its charge since. */
function invoicedSale(setup: Partial<SaleSetup>): void {
  fake.addSale({ sessionId: SESSION, amountTotal: 125000, intentMetadata: { invoice_id: 'in_earlier', invoice_number: 'TEST-0001' }, ...setup })
}

/** That invoice, paid, and what its credit notes cover. */
function invoicedEarlier(credited: number): void {
  numberedEarlier(fake, 'paid')
  fake.invoices.get('in_earlier')!.post_payment_credit_notes_amount = credited
}

describe.skipIf(!hasDatabase)('an interrupted link-sale invoice', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(() => {
    fake = new FakeStripe()
    state.fake = fake
  })

  it('finishes an invoice marked uncollectible under its own number, and numbers no second one', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, intentMetadata: { invoice_pending: 'in_earlier' } })
    numberedEarlier(fake, 'uncollectible')

    const result = await issueLinkInvoice(input())

    expect(result).toMatchObject({ number: 'TEST-0001', resumed: true, differs: false })
    expect(fake.calls).not.toContain('invoices.create')
    expect(fake.invoices.get('in_earlier')?.status).toBe('paid')
    expect(fake.intents.get(INTENT)).toMatchObject({ invoice_id: 'in_earlier', handover_file: 'file_earlier' })
    expect(fake.intents.get(INTENT)?.invoice_pending).toBeUndefined()
  })

  it('finishes a numbered invoice with nothing typed and nothing signed', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, intentMetadata: { invoice_pending: 'in_earlier' } })
    numberedEarlier(fake, 'open')

    const result = await finishLinkInvoice(SESSION)

    expect(result).toMatchObject({ number: 'TEST-0001', resumed: true, frameNumber: 'FRAME-1', differences: [] })
    expect(fake.invoices.get('in_earlier')?.status).toBe('paid')
    expect(fake.intents.get(INTENT)).toMatchObject({ invoice_id: 'in_earlier', invoice_number: 'TEST-0001' })
    // German, because the invoice names an Austrian customer.
    expect(result.message.subject).toMatch(/^Ihre Rechnung/)
  })

  it('refuses to "finish" a sale whose interrupted attempt numbered nothing, and clears the leftover draft', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, intentMetadata: { invoice_pending: 'in_draft' } })
    fake.addInvoice({ id: 'in_draft', metadata: { checkout_session: SESSION } })

    const error = await finishLinkInvoice(SESSION).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).messageKey).toBe('admin.nothing_to_finish')
    expect(fake.invoices.has('in_draft')).toBe(false)
    expect(fake.intents.get(INTENT)?.invoice_pending).toBeUndefined()
    expect(fake.calls).not.toContain('invoices.create')
  })

  it('lists what an interrupted attempt numbered, so the panel can offer to finish it', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, intentMetadata: { invoice_pending: 'in_earlier' } })
    numberedEarlier(fake, 'open')

    const { items } = await listLinkSales()

    expect(items[0]).toMatchObject({
      pendingAttempt: true,
      pendingInvoice: {
        id: 'in_earlier',
        number: 'TEST-0001',
        frameNumber: 'FRAME-1',
        deliveredOn: today,
        customerName: BILLING.name,
        total: 125000,
        deliveryFeeIncluded: false,
      },
    })
  })

  it('says whether the invoice waiting to be finished carries the delivery fee', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, fulfilment: 'delivery', deliveryFee: 3500, intentMetadata: { invoice_pending: 'in_earlier' } })
    // Numbered with the fee line: finishing would make it final as it stands.
    numberedEarlier(fake, 'open', 128500)

    expect((await listLinkSales()).items[0]?.pendingInvoice).toMatchObject({ total: 128500, deliveryFeeIncluded: true })
  })

  it('lists no invoice to finish when the attempt left only an unnumbered draft', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, intentMetadata: { invoice_pending: 'in_draft' } })
    fake.addInvoice({ id: 'in_draft', metadata: { checkout_session: SESSION } })

    const { items } = await listLinkSales()

    expect(items[0]).toMatchObject({ pendingAttempt: true, pendingInvoice: null })
  })

  it('asks for a credit note after a refund until the credit notes cover it, and then stops', async () => {
    invoicedSale({ amountRefunded: 5000 })
    invoicedEarlier(2000)

    expect((await listLinkSales()).items[0]).toMatchObject({ invoice: { number: 'TEST-0001' }, blocked: null, reversal: 'credit_note_due' })

    // The owner issues the rest. Stripe still says the charge was refunded.
    fake.invoices.get('in_earlier')!.post_payment_credit_notes_amount = 5000
    expect((await listLinkSales()).items[0]).toMatchObject({ blocked: null, reversal: 'settled' })
  })

  it('asks for an answer only while a dispute waits for one, and counts a lost one as money gone', async () => {
    const cases: Array<[Stripe.Dispute.Status, number, Reversal]> = [
      ['needs_response', 0, 'dispute_open'],
      ['warning_needs_response', 0, 'dispute_open'],
      ['under_review', 0, 'dispute_in_review'],
      ['won', 0, 'settled'],
      ['warning_closed', 0, 'settled'],
      ['lost', 0, 'credit_note_due'],
      ['lost', 125000, 'settled'],
    ]
    for (const [status, credited, expected] of cases) {
      fake = new FakeStripe()
      state.fake = fake
      invoicedSale({ disputes: [{ status, amount: 125000 }] })
      invoicedEarlier(credited)
      expect((await listLinkSales()).items[0]?.reversal, `${status}, ${credited} credited`).toBe(expected)
    }
  })

  it('reports the money on an invoice an interrupted attempt numbered, too', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, amountRefunded: 125000, intentMetadata: { invoice_pending: 'in_earlier' } })
    numberedEarlier(fake, 'open')

    expect((await listLinkSales()).items[0]).toMatchObject({ pendingInvoice: { number: 'TEST-0001' }, reversal: 'credit_note_due' })
  })

  it('keeps the warning when Stripe cannot say what was credited or ruled', async () => {
    invoicedSale({ amountRefunded: 5000, disputes: [{ status: 'won', amount: 125000 }] })
    invoicedEarlier(5000)
    expect((await listLinkSales()).items[0]?.reversal).toBe('settled')

    fake.failNext('disputes.list', Object.assign(new Error('Request timed out'), { type: 'StripeConnectionError' }))
    expect((await listLinkSales()).items[0]?.reversal).toBe('dispute_open')

    fake.failNext('invoices.retrieve', Object.assign(new Error('Request timed out'), { type: 'StripeConnectionError' }))
    expect((await listLinkSales()).items[0]?.reversal).toBe('credit_note_due')
  })

  it('reports nothing for a sale not yet invoiced: what blocks it is still `blocked`', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, amountRefunded: 5000 })

    expect((await listLinkSales()).items[0]).toMatchObject({ invoice: null, blocked: 'refunded', reversal: null })
  })

  it('reports a corrected name, address, country or delivery fee that the finished invoice does not carry', async () => {
    fake.addSale({
      sessionId: SESSION,
      amountTotal: 125000,
      fulfilment: 'delivery',
      deliveryFee: 3500,
      intentMetadata: { invoice_pending: 'in_earlier' },
    })
    // Numbered with the fee line, before the seller noticed it was never collected.
    numberedEarlier(fake, 'open', 128500)

    const result = await issueLinkInvoice(
      input({ billing: { ...BILLING, name: 'ERIKA MUSTERMANN', line1: 'Musterstrasse 2', country: 'DE' }, deliveryFeeCollected: false })
    )

    expect(result).toMatchObject({ number: 'TEST-0001', resumed: true, differs: true, customerName: BILLING.name, total: 128500 })
    expect(result.differences).toEqual(['name', 'address', 'country', 'deliveryFee'])
    expect(fake.calls).not.toContain('invoices.create')
  })

  it('does not double a line when Stripe times out on it: the attempt fails and the next one discards the draft', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000 })
    fake.failNext('invoiceItems.create:price_data', Object.assign(new Error('Request timed out'), { type: 'StripeConnectionError' }))

    await expect(issueLinkInvoice(input())).rejects.toThrow(/timed out/)

    const drafts = [...fake.invoices.values()]
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ status: 'draft', lines: [] })
    expect(fake.calls).not.toContain('invoiceItems.create amount')
    expect(fake.intents.get(INTENT)?.invoice_pending).toBe(drafts[0]!.id)
  })

  it('still invoices a product deleted since the sale, as one amount line', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, productId: 'prod_deleted' })
    fake.deletedProducts.add('prod_deleted')

    const result = await issueLinkInvoice(input())

    expect(result).toMatchObject({ resumed: false, total: 125000 })
    expect(fake.calls).toContain('invoiceItems.create amount')
    expect(fake.invoices.get(result.id)).toMatchObject({ status: 'paid', total: 125000 })
  })
})
