/**
 * Just enough of Stripe for the link-sale invoices to run against.
 *
 * The advisory lock is the database's and runs for real; Stripe is the part a
 * test cannot own, so this keeps its objects in memory with the semantics the
 * module depends on: an invoice is numbered only when finalised and freezes its
 * customer's name and address then; a metadata key set to '' is deleted; an
 * unknown id answers `resource_missing`; uncollectible can still be paid.
 *
 * `failNext` makes one call throw what Stripe or the network would.
 */
import type Stripe from 'stripe'

type Invoice = {
  id: string
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
  number: string | null
  customer: string
  currency: string
  total: number
  metadata: Record<string, string>
  customer_name: string | null
  customer_address: { line1: string; postal_code: string; city: string; country: string } | null
  hosted_invoice_url: string | null
  lines: Array<{ amount: number; description: string; product: string | null }>
  coupon: number
}

type Customer = { id: string; name: string; address: { line1: string; postal_code: string; city: string; country: string } }

export interface SaleSetup {
  sessionId: string
  amountTotal: number
  fulfilment?: 'pickup' | 'delivery'
  /** The link's delivery_fee_cents. */
  deliveryFee?: number
  productId?: string
  refunded?: boolean
  intentMetadata?: Record<string, string>
}

export class FakeStripe {
  sessions = new Map<string, SaleSetup>()
  intents = new Map<string, Record<string, string>>()
  invoices = new Map<string, Invoice>()
  customers = new Map<string, Customer>()
  /** Products deleted since the sale: a price_data line naming one is refused. */
  deletedProducts = new Set<string>()
  calls: string[] = []
  private sequence = 0
  private numbered = 0
  private failures = new Map<string, unknown>()

  /** The next call to `method` (e.g. 'invoiceItems.create:price_data') throws `error`. */
  failNext(method: string, error: unknown): void {
    this.failures.set(method, error)
  }

  private maybeFail(method: string): void {
    const error = this.failures.get(method)
    if (error !== undefined) {
      this.failures.delete(method)
      throw error
    }
  }

  private id(prefix: string): string {
    return `${prefix}_fake${++this.sequence}`
  }

  addSale(sale: SaleSetup): void {
    this.sessions.set(sale.sessionId, sale)
    this.intents.set(`pi_${sale.sessionId}`, { ...(sale.intentMetadata ?? {}) })
  }

  /** An invoice an earlier attempt left behind, in whatever state that attempt reached. */
  addInvoice(invoice: Partial<Invoice> & { id: string; metadata: Record<string, string> }): void {
    this.invoices.set(invoice.id, {
      status: 'draft',
      number: null,
      customer: 'cus_earlier',
      currency: 'eur',
      total: 0,
      customer_name: null,
      customer_address: null,
      hosted_invoice_url: null,
      lines: [],
      coupon: 0,
      ...invoice,
    })
  }

  private session(id: string): Stripe.Checkout.Session {
    const sale = this.sessions.get(id)
    if (!sale) throw Object.assign(new Error(`No such checkout.session: ${id}`), { code: 'resource_missing' })
    const intentId = `pi_${id}`
    return {
      id,
      object: 'checkout.session',
      payment_link: 'plink_fake',
      payment_status: 'paid',
      status: 'complete',
      created: Math.floor(Date.now() / 1000) - 86_400,
      currency: 'eur',
      amount_total: sale.amountTotal,
      invoice: null,
      total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
      customer_details: {
        email: 'max.mustermann@example.com',
        phone: '+436601234567',
        name: 'MAX MUSTERMANN',
        address: { line1: 'Musterstrasse 1', line2: null, postal_code: '1010', city: 'Wien', country: 'AT', state: null },
      },
      custom_fields: [{ key: 'delivery', type: 'dropdown', dropdown: { value: sale.fulfilment ?? 'pickup' } }],
      discounts: [],
      line_items: {
        object: 'list',
        has_more: false,
        data: [
          {
            id: 'li_1',
            description: 'V8 ULTRA MAX T',
            quantity: 1,
            amount_subtotal: sale.amountTotal,
            price: { product: sale.productId ?? 'prod_bike' },
          },
        ],
      },
      payment_intent: {
        id: intentId,
        metadata: { ...this.intents.get(intentId) },
        payment_method_types: ['card'],
        latest_charge: {
          id: `ch_${id}`,
          created: Math.floor(Date.now() / 1000) - 86_400,
          disputed: false,
          refunded: Boolean(sale.refunded),
          amount_refunded: sale.refunded ? sale.amountTotal : 0,
          payment_method_details: { type: 'card' },
        },
      },
    } as unknown as Stripe.Checkout.Session
  }

  private invoice(id: string): Invoice {
    const invoice = this.invoices.get(id)
    if (!invoice) throw Object.assign(new Error(`No such invoice: ${id}`), { code: 'resource_missing', type: 'StripeInvalidRequestError' })
    return invoice
  }

  private view(invoice: Invoice): Stripe.Invoice {
    return { ...invoice, object: 'invoice' } as unknown as Stripe.Invoice
  }

  private retotal(invoice: Invoice): void {
    invoice.total = invoice.lines.reduce((sum, line) => sum + line.amount, 0) - invoice.coupon
  }

  readonly client = {
    checkout: {
      sessions: {
        retrieve: async (id: string) => this.session(id),
        list: () => {
          const all = [...this.sessions.keys()].map((id) => this.session(id))
          return { async *[Symbol.asyncIterator]() { yield* all } }
        },
        listLineItems: (id: string) => {
          const items = this.session(id).line_items!.data
          return { async *[Symbol.asyncIterator]() { yield* items } }
        },
      },
    },
    paymentLinks: {
      retrieve: async () => {
        const fee = [...this.sessions.values()][0]?.deliveryFee
        return { metadata: fee ? { delivery_fee_cents: String(fee) } : {} }
      },
    },
    paymentIntents: {
      update: async (id: string, params: { metadata: Record<string, string> }) => {
        this.calls.push(`paymentIntents.update ${Object.keys(params.metadata).join(',')}`)
        const metadata = this.intents.get(id)!
        for (const [key, value] of Object.entries(params.metadata)) {
          if (value === '') delete metadata[key]
          else metadata[key] = value
        }
        return { id, metadata }
      },
    },
    invoices: {
      search: async ({ query }: { query: string }) => {
        const sessionId = /'([^']+)'$/.exec(query)?.[1]
        return { data: [...this.invoices.values()].filter((i) => i.metadata.checkout_session === sessionId).map((i) => this.view(i)) }
      },
      retrieve: async (id: string) => this.view(this.invoice(id)),
      del: async (id: string) => {
        const invoice = this.invoice(id)
        if (invoice.status !== 'draft') throw new Error('only drafts can be deleted')
        this.invoices.delete(id)
        this.calls.push(`invoices.del ${id}`)
        return { id, deleted: true }
      },
      create: async (params: { customer: string; currency: string; metadata: Record<string, string>; discounts?: Array<{ coupon: string }> }) => {
        this.calls.push('invoices.create')
        const id = this.id('in')
        this.invoices.set(id, {
          id,
          status: 'draft',
          number: null,
          customer: params.customer,
          currency: params.currency,
          total: 0,
          metadata: { ...params.metadata },
          customer_name: null,
          customer_address: null,
          hosted_invoice_url: null,
          lines: [],
          coupon: 0,
        })
        return this.view(this.invoices.get(id)!)
      },
      finalizeInvoice: async (id: string) => {
        const invoice = this.invoice(id)
        const customer = this.customers.get(invoice.customer)
        invoice.status = 'open'
        invoice.number = `TEST-${String(++this.numbered).padStart(4, '0')}`
        // Stripe freezes the customer on the invoice when it is numbered.
        invoice.customer_name = customer?.name ?? invoice.customer_name
        invoice.customer_address = customer?.address ?? invoice.customer_address
        invoice.hosted_invoice_url = `https://invoice.stripe.com/i/${id}`
        this.calls.push(`invoices.finalize ${id}`)
        return this.view(invoice)
      },
      pay: async (id: string) => {
        this.maybeFail('invoices.pay')
        const invoice = this.invoice(id)
        if (invoice.status !== 'open' && invoice.status !== 'uncollectible') throw new Error(`cannot pay a ${invoice.status} invoice`)
        invoice.status = 'paid'
        this.calls.push(`invoices.pay ${id}`)
        return this.view(invoice)
      },
    },
    invoiceItems: {
      create: async (params: {
        invoice: string
        description: string
        amount?: number
        price_data?: { product: string; unit_amount: number }
        quantity?: number
      }) => {
        if (params.price_data) {
          this.maybeFail('invoiceItems.create:price_data')
          if (this.deletedProducts.has(params.price_data.product)) {
            throw Object.assign(new Error(`No such product: '${params.price_data.product}'`), {
              type: 'StripeInvalidRequestError',
              code: 'resource_missing',
              param: 'price_data[product]',
            })
          }
        }
        const invoice = this.invoice(params.invoice)
        const amount = params.price_data ? params.price_data.unit_amount * (params.quantity ?? 1) : params.amount!
        invoice.lines.push({ amount, description: params.description, product: params.price_data?.product ?? null })
        this.retotal(invoice)
        this.calls.push(`invoiceItems.create ${params.price_data ? 'price_data' : 'amount'}`)
        return { id: this.id('ii') }
      },
    },
    customers: {
      create: async (params: { name: string; address: { line1: string; postal_code: string; city: string; country: string } }) => {
        const id = this.id('cus')
        this.customers.set(id, { id, name: params.name, address: params.address })
        return { id }
      },
    },
    coupons: { create: async () => ({ id: this.id('coupon') }) },
    taxRates: { list: async () => ({ data: [{ id: 'txr_fake', percentage: 20, inclusive: true, country: 'FR' }] }), create: async () => ({ id: 'txr_fake' }) },
    taxIds: { list: async () => ({ data: [{ id: 'txi_fake', value: 'FR43100732247' }] }), create: async () => ({ id: 'txi_fake' }) },
    files: { create: async () => ({ id: this.id('file') }) },
  }
}
