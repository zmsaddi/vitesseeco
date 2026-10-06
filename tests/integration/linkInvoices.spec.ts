/**
 * Link-sale invoices when an attempt was interrupted — against a real lock.
 *
 * The rule under test is the numbering: a French invoice number may never be
 * issued twice for one sale, nor left dangling. Stripe is played by an
 * in-memory double (fakeStripe.ts); the advisory lock that keeps two attempts
 * apart is PostgreSQL's own, reached through the production accessor.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../shared/errors'
import { finishLinkInvoice, issueLinkInvoice, listLinkSales } from '../../server/payments/linkInvoices'
import { closePool, hasDatabase } from './setup'
import { FakeStripe } from './fakeStripe'

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
      pendingInvoice: { id: 'in_earlier', number: 'TEST-0001', frameNumber: 'FRAME-1', deliveredOn: today, customerName: BILLING.name, total: 125000 },
    })
  })

  it('lists no invoice to finish when the attempt left only an unnumbered draft', async () => {
    fake.addSale({ sessionId: SESSION, amountTotal: 125000, intentMetadata: { invoice_pending: 'in_draft' } })
    fake.addInvoice({ id: 'in_draft', metadata: { checkout_session: SESSION } })

    const { items } = await listLinkSales()

    expect(items[0]).toMatchObject({ pendingAttempt: true, pendingInvoice: null })
  })

  it('keeps a refund made after the invoice was numbered visible on the invoiced sale', async () => {
    fake.addSale({
      sessionId: SESSION,
      amountTotal: 125000,
      refunded: true,
      intentMetadata: { invoice_id: 'in_earlier', invoice_number: 'TEST-0001' },
    })

    const { items } = await listLinkSales()

    expect(items[0]).toMatchObject({ invoice: { number: 'TEST-0001' }, blocked: 'refunded' })
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
