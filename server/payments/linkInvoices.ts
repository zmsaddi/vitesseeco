/**
 * Invoices for sales made through a Stripe Payment Link.
 *
 * A Payment Link sells outside the shop: no order row, no stock movement, and
 * the webhook drops its sessions as "not ours". Stripe sends the buyer a
 * receipt, but a receipt carries no sequential number, no SIREN and no VAT
 * breakdown — it is not an invoice. This module issues the real one, from the
 * admin panel, once the bike has been handed over.
 *
 * Issued AFTER delivery on purpose: the frame number and the handover date are
 * only known then, and an invoice that states both is also the proof of
 * delivery a Klarna "item not received" dispute is lost without.
 *
 * Stripe is the ledger here, not PostgreSQL. The invoice id is written back
 * onto the PaymentIntent, which is what makes a second issue for the same sale
 * refuse rather than number a duplicate.
 */
import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import { stripe } from './stripe'
import { cents, type Cents } from '../../shared/money'
import { ORGANISATION } from '../../shared/organisation'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { buildHandoverPdf, decodeSignature, uploadEvidence } from './handover'

/**
 * The Vienna home-delivery fee. Paid to the driver on delivery, never through
 * the link, so it appears on the invoice only when it was actually collected.
 * The link's own dropdown label states the same amount — change both together.
 */
export const VIENNA_DELIVERY_FEE: Cents = cents(3500)

/** French VAT, inclusive: link prices are what the customer pays. */
const VAT_PERCENT = 20
const ACCOUNT_VAT_ID = ORGANISATION.vatNumber.replace(/\s/g, '')

export type Fulfilment = 'pickup' | 'delivery' | null

export interface BillingAddress {
  name: string
  line1: string
  postalCode: string
  city: string
  /** ISO 3166-1 alpha-2. */
  country: string
}

export interface LinkSale {
  sessionId: string
  paymentIntentId: string
  paidAt: string
  amountTotal: number
  currency: string
  productName: string
  email: string | null
  phone: string | null
  fulfilment: Fulfilment
  deliveryAddress: string | null
  promotionCode: string | null
  paymentMethod: string
  /** Pre-fills the form; null fields must be asked from the customer. */
  billing: Partial<BillingAddress>
  invoice: IssuedInvoice | null
  /** The signed bon de livraison, when the sale was invoiced from the panel. */
  handoverFileId: string | null
}

export interface IssuedInvoice {
  id: string
  number: string
  pdfUrl: string | null
  hostedUrl: string | null
  /** Ready to send: the buyers are in Vienna, so it is written in German. */
  message: { subject: string; body: string }
}

export function customerMessage(number: string, link: string | null): IssuedInvoice['message'] {
  return {
    subject: `Ihre Rechnung ${number} – Vitesse Eco`,
    body:
      `Guten Tag,

vielen Dank für Ihren Kauf bei Vitesse Eco. ` +
      `Ihre Rechnung ${number} finden Sie hier:
${link ?? ''}

` +
      `Mit freundlichen Grüßen
Vitesse Eco
${ORGANISATION.phone} · ${ORGANISATION.email}`,
  }
}

function toIssued(invoice: Stripe.Invoice): IssuedInvoice {
  const number = invoice.number ?? invoice.id!
  return {
    id: invoice.id!,
    number,
    pdfUrl: invoice.invoice_pdf ?? null,
    hostedUrl: invoice.hosted_invoice_url ?? null,
    message: customerMessage(number, invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null),
  }
}

export interface IssueInput {
  sessionId: string
  frameNumber: string
  /** YYYY-MM-DD, the day the bike changed hands. */
  deliveredOn: string
  billing: BillingAddress
  deliveryFeeCollected: boolean
  /** The customer's finger signature, data:image/png;base64,… */
  signature: string
}

// ── Pure planning ─────────────────────────────────────────────────────────────

export interface PlannedLine {
  kind: 'product' | 'delivery'
  priceId?: string
  quantity: number
  amount?: Cents
  description: string
}

export interface InvoicePlan {
  lines: PlannedLine[]
  discount: { amount: Cents; label: string } | null
  customFields: Array<{ name: string; value: string }>
  description: string
}

/** "2026-09-29" → "29/09/2026", without a Date and therefore without a time zone. */
export function frenchDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-')
  return `${day}/${month}/${year}`
}

const METHOD_LABELS: Record<string, string> = {
  card: 'Carte bancaire',
  klarna: 'Klarna',
  paypal: 'PayPal',
  eps: 'EPS',
  sepa_debit: 'Prélèvement SEPA',
  bancontact: 'Bancontact',
  ideal: 'iDEAL',
  link: 'Link',
  revolut_pay: 'Revolut Pay',
}

export function paymentMethodLabel(type: string | null | undefined): string {
  if (!type) return 'Paiement en ligne'
  return METHOD_LABELS[type] ?? type
}

export interface PlanSource {
  lineItems: Array<{ priceId: string; quantity: number; name: string }>
  discountAmount: Cents
  promotionCode: string | null
  fulfilment: Fulfilment
  paidOn: string
  paymentMethod: string
  paymentIntentId: string
}

/**
 * Everything the invoice will say, decided without touching Stripe — so the
 * rules (delivery fee only when collected, frame number on the line, the paid
 * statement) are unit-tested rather than discovered on a live invoice.
 */
export function planInvoice(source: PlanSource, input: IssueInput): InvoicePlan {
  const frame = input.frameNumber.trim()
  const lines: PlannedLine[] = source.lineItems.map((item) => ({
    kind: 'product',
    priceId: item.priceId,
    quantity: item.quantity,
    description: `${item.name} (N° de cadre ${frame})`,
  }))

  const feeCollected = source.fulfilment === 'delivery' && input.deliveryFeeCollected
  if (feeCollected) {
    lines.push({
      kind: 'delivery',
      quantity: 1,
      amount: VIENNA_DELIVERY_FEE,
      description: 'Livraison à domicile, Vienne (réglée à la livraison)',
    })
  }

  const paidOn = frenchDay(source.paidOn)
  const deliveredOn = frenchDay(input.deliveredOn)
  const handover = source.fulfilment === 'delivery' ? 'livraison à domicile' : 'remise en main propre'

  return {
    lines,
    discount:
      source.discountAmount > 0
        ? {
            amount: source.discountAmount,
            label: source.promotionCode ? `Code ${source.promotionCode}` : 'Remise',
          }
        : null,
    customFields: [
      { name: 'N° de cadre', value: frame },
      { name: 'Date de livraison', value: `${deliveredOn} – ${handover}` },
      {
        name: 'Paiement',
        value: `${source.paymentMethod}, ${paidOn}${feeCollected ? ' + livraison réglée à la livraison' : ''}`,
      },
      // SIREN and VAT number are in the footer; this slot proves the handover.
      { name: 'Bon de livraison', value: `signé par le client le ${deliveredOn}` },
    ],
    description:
      `FACTURE ACQUITTÉE – réglée le ${paidOn} (${source.paymentMethod}` +
      `${feeCollected ? ', frais de livraison réglés le ' + deliveredOn : ''}). ` +
      `Aucun montant restant dû. Réf. paiement ${source.paymentIntentId}.`,
  }
}

// ── Stripe reads ──────────────────────────────────────────────────────────────

function parisDay(unixSeconds: number): string {
  // en-CA renders YYYY-MM-DD; the zone is pinned so a sale at 00:30 in Vienna
  // is not dated the day before by a server running in UTC.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(unixSeconds * 1000))
}

function customField(session: Stripe.Checkout.Session, key: string): string | null {
  const field = session.custom_fields?.find((entry) => entry.key === key)
  if (!field) return null
  return field.dropdown?.value ?? field.text?.value ?? null
}

async function issuedInvoice(invoiceId: string | undefined): Promise<IssuedInvoice | null> {
  if (!invoiceId) return null
  // Retrieved fresh each time: the PDF link Stripe hands out is not permanent.
  return toIssued(await stripe().invoices.retrieve(invoiceId))
}

async function toSale(session: Stripe.Checkout.Session): Promise<LinkSale> {
  const intent = session.payment_intent as Stripe.PaymentIntent
  const charge = intent.latest_charge as Stripe.Charge | null
  const details = session.customer_details
  const address = details?.address
  const items = await stripe().checkout.sessions.listLineItems(session.id, { limit: 10 })

  let promotionCode: string | null = null
  const promo = session.discounts?.[0]?.promotion_code
  if (typeof promo === 'string') promotionCode = (await stripe().promotionCodes.retrieve(promo)).code
  else if (promo) promotionCode = promo.code

  const fulfilment = customField(session, 'delivery')
  return {
    sessionId: session.id,
    paymentIntentId: intent.id,
    paidAt: new Date(session.created * 1000).toISOString(),
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? 'eur',
    productName: items.data.map((item) => item.description).join(', '),
    email: details?.email ?? null,
    phone: details?.phone ?? null,
    fulfilment: fulfilment === 'pickup' || fulfilment === 'delivery' ? fulfilment : null,
    deliveryAddress: customField(session, 'address'),
    promotionCode,
    paymentMethod: paymentMethodLabel(charge?.payment_method_details?.type ?? intent.payment_method_types[0]),
    billing: {
      ...(details?.individual_name || details?.name
        ? { name: (details.individual_name ?? details.name)! }
        : {}),
      ...(address?.line1 ? { line1: [address.line1, address.line2].filter(Boolean).join(', ') } : {}),
      ...(address?.postal_code ? { postalCode: address.postal_code } : {}),
      ...(address?.city ? { city: address.city } : {}),
      ...(address?.country ? { country: address.country } : {}),
    },
    invoice: await issuedInvoice(intent.metadata?.invoice_id),
    handoverFileId: intent.metadata?.handover_file || null,
  }
}

async function paidLinkSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  })
  // Only a paid Payment Link sale. A shop checkout already has an order, and
  // invoicing it here would number the same sale twice.
  if (!session.payment_link || session.payment_status !== 'paid' || !session.payment_intent) {
    throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `${sessionId} is not a paid payment-link sale` })
  }
  return session
}

/** Paid Payment Link sales, newest first. Capped: this is a handful a week. */
export async function listLinkSales(max = 200): Promise<LinkSale[]> {
  const sessions: Stripe.Checkout.Session[] = []
  for await (const session of stripe().checkout.sessions.list({
    status: 'complete',
    limit: 100,
    expand: ['data.payment_intent.latest_charge'],
  })) {
    if (session.payment_link && session.payment_status === 'paid' && session.payment_intent) sessions.push(session)
    if (sessions.length >= max) break
  }
  return Promise.all(sessions.map(toSale))
}

// ── Issuing ───────────────────────────────────────────────────────────────────

async function ensureVatRate(): Promise<string> {
  const rates = await stripe().taxRates.list({ active: true, limit: 100 })
  const existing = rates.data.find(
    (rate) => rate.percentage === VAT_PERCENT && rate.inclusive && rate.country === 'FR'
  )
  if (existing) return existing.id
  const created = await stripe().taxRates.create({
    display_name: 'TVA',
    percentage: VAT_PERCENT,
    inclusive: true,
    country: 'FR',
    jurisdiction: 'FR',
    description: 'TVA France 20 %',
  })
  return created.id
}

async function ensureAccountVatId(): Promise<string> {
  const ids = await stripe().taxIds.list({ owner: { type: 'self' }, limit: 20 })
  const existing = ids.data.find((entry) => entry.value.replace(/\s/g, '') === ACCOUNT_VAT_ID)
  if (existing) return existing.id
  return (await stripe().taxIds.create({ owner: { type: 'self' }, type: 'eu_vat', value: ACCOUNT_VAT_ID })).id
}

/**
 * Issue the invoice for one sale, finalised and marked paid.
 *
 * Every Stripe write carries an idempotency key derived from the sale AND the
 * submitted form, so a double tap on a phone replays the same objects instead
 * of numbering a second invoice. A corrected resubmission (a different frame
 * number, say) gets fresh keys — and is refused by the PaymentIntent check once
 * the first attempt has completed.
 */
export async function issueLinkInvoice(input: IssueInput): Promise<IssuedInvoice> {
  const session = await paidLinkSession(input.sessionId)
  const intent = session.payment_intent as Stripe.PaymentIntent

  if (intent.metadata?.invoice_id) {
    throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
      internal: `${session.id} already invoiced as ${intent.metadata.invoice_id}`,
    })
  }

  const sale = await toSale(session)
  const items = await stripe().checkout.sessions.listLineItems(session.id, { limit: 10 })
  const plan = planInvoice(
    {
      lineItems: items.data.map((item) => ({
        priceId: item.price!.id,
        quantity: item.quantity ?? 1,
        name: item.description ?? 'Article',
      })),
      discountAmount: cents(session.total_details?.amount_discount ?? 0),
      promotionCode: sale.promotionCode,
      fulfilment: sale.fulfilment,
      paidOn: parisDay(session.created),
      paymentMethod: sale.paymentMethod,
      paymentIntentId: intent.id,
    },
    input
  )

  // The signed receipt first: it is not a numbered document, so a failure
  // after it leaves a harmless orphan file rather than a gap in the invoices.
  const signaturePng = decodeSignature(input.signature)
  const receipt = await buildHandoverPdf(
    {
      reference: intent.id,
      productName: items.data.map((item) => item.description).join(', '),
      frameNumber: input.frameNumber.trim(),
      deliveredOn: frenchDay(input.deliveredOn),
      handover: sale.fulfilment === 'delivery' ? 'delivery' : 'pickup',
      customer: {
        name: input.billing.name,
        address: `${input.billing.line1}, ${input.billing.postalCode} ${input.billing.city}, ${input.billing.country}`,
        email: sale.email,
        phone: sale.phone,
      },
    },
    signaturePng
  )
  const handoverFile = await uploadEvidence(receipt, `handover-${intent.id}.pdf`, 'application/pdf')

  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16)
  const key = (step: string) => `link-invoice:${session.id}:${fingerprint}:${step}`

  const [taxRate, accountVatId] = await Promise.all([ensureVatRate(), ensureAccountVatId()])
  const currency = session.currency ?? 'eur'

  const customer = await stripe().customers.create(
    {
      name: input.billing.name,
      ...(sale.email ? { email: sale.email } : {}),
      ...(sale.phone ? { phone: sale.phone } : {}),
      address: {
        line1: input.billing.line1,
        postal_code: input.billing.postalCode,
        city: input.billing.city,
        country: input.billing.country,
      },
      preferred_locales: ['fr'],
      metadata: { checkout_session: session.id, payment_intent: intent.id },
    },
    { idempotencyKey: key('customer') }
  )

  const coupon = plan.discount
    ? await stripe().coupons.create(
        {
          name: plan.discount.label,
          amount_off: plan.discount.amount,
          currency,
          duration: 'once',
          max_redemptions: 1,
        },
        { idempotencyKey: key('coupon') }
      )
    : null

  const draft = await stripe().invoices.create(
    {
      customer: customer.id,
      currency,
      collection_method: 'send_invoice',
      days_until_due: 0,
      auto_advance: false,
      account_tax_ids: [accountVatId],
      ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
      custom_fields: plan.customFields,
      description: plan.description,
      footer:
        `${ORGANISATION.legalName} · ${ORGANISATION.address.street}, ${ORGANISATION.address.postalCode} ` +
        `${ORGANISATION.address.city}, France · SIREN ${ORGANISATION.siren} · ` +
        `TVA intracommunautaire ${ORGANISATION.vatNumber} · ${ORGANISATION.email} · ${ORGANISATION.phone}`,
      metadata: {
        checkout_session: session.id,
        payment_intent: intent.id,
        frame_number: input.frameNumber.trim(),
        delivered_on: input.deliveredOn,
        handover_file: handoverFile,
      },
    },
    { idempotencyKey: key('invoice') }
  )

  for (const [index, line] of plan.lines.entries()) {
    await stripe().invoiceItems.create(
      {
        customer: customer.id,
        invoice: draft.id!,
        description: line.description,
        tax_rates: [taxRate],
        ...(line.priceId
          ? { pricing: { price: line.priceId }, quantity: line.quantity }
          : { amount: line.amount!, currency }),
      },
      { idempotencyKey: key(`line-${index}`) }
    )
  }

  const finalised = await stripe().invoices.finalizeInvoice(
    draft.id!,
    { auto_advance: false },
    { idempotencyKey: key('finalize') }
  )
  // Paid out of band: the money already arrived through the link. Attaching
  // the PaymentIntent itself is refused — a link session has no customer, and
  // Stripe requires the two to match.
  const paid = await stripe().invoices.pay(finalised.id!, { paid_out_of_band: true }, { idempotencyKey: key('pay') })

  await stripe().paymentIntents.update(intent.id, {
    metadata: { invoice_id: paid.id!, invoice_number: paid.number ?? '', handover_file: handoverFile },
  })

  return toIssued(paid)
}
