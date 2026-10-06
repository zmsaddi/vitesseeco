/**
 * Invoices for sales made through a Stripe Payment Link — any link.
 *
 * A Payment Link sells outside the shop: no order row, no stock movement, and
 * the webhook drops its sessions as "not ours". Stripe sends the buyer a
 * receipt, but a receipt carries no sequential number, no SIREN and no VAT
 * breakdown — it is not an invoice. This module issues the real one, from the
 * admin panel, once the item has been handed over.
 *
 * Issued AFTER delivery on purpose: the frame number and the handover date are
 * only known then, and an invoice that states both is also the proof of
 * delivery a Klarna "item not received" dispute is lost without.
 *
 * Stripe is the ledger here, not PostgreSQL. What protects the numbering — a
 * French invoice number may never be issued twice for one sale, nor left
 * dangling — is, in order:
 *
 *   1. an advisory lock on the sale, so two submissions cannot run at once;
 *   2. a pending marker on the PaymentIntent, written the moment a draft exists
 *      and BEFORE it is numbered, so any later attempt finds and resumes or
 *      discards it instead of numbering another;
 *   3. a total check before finalising: the invoice must equal what was paid,
 *      or it is discarded while still an unnumbered draft;
 *   4. the final invoice id on the PaymentIntent, which refuses re-issue.
 */
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type Stripe from 'stripe'
import { stripe } from './stripe'
import { cents, type Cents } from '../../shared/money'
import { ORGANISATION } from '../../shared/organisation'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { withTransaction } from '../db/client'
import { buildHandoverPdf, decodeSignature, uploadEvidence } from './handover'
import { languageFor, type ReceiptLanguage } from '../../shared/receiptLanguage'
import { isHandoverDay, parisDay } from '../../shared/handoverForm'

/**
 * Per-link settings live on the Payment Link itself, as metadata, so a new link
 * for any product in any city needs no code change:
 *
 *   delivery_fee_cents  the home-delivery fee collected ON delivery (cash or
 *                       card at the door), never through the link. It goes on
 *                       the invoice only when the admin confirms it was
 *                       collected — and the amount comes from here, never from
 *                       the browser. It is read when the invoice is issued, so
 *                       changing it on a link applies to that link's sales not
 *                       yet invoiced.
 */
export const LINK_METADATA = { deliveryFeeCents: 'delivery_fee_cents' } as const

/** A positive whole number of cents, or null for anything else. */
export function feeFromMetadata(metadata: Record<string, string> | null | undefined): Cents | null {
  const raw = metadata?.[LINK_METADATA.deliveryFeeCents]
  if (!raw || !/^\d{1,7}$/.test(raw.trim())) return null
  const value = Number(raw.trim())
  return value > 0 ? cents(value) : null
}

/** The language the customer is written to in — the rule lives in shared/, beside the signing screen's. */
export type MessageLanguage = ReceiptLanguage
export { languageFor }

/** French VAT, inclusive: link prices are what the customer pays. */
const VAT_PERCENT = 20
const ACCOUNT_VAT_ID = ORGANISATION.vatNumber.replace(/\s/g, '')

/** How far back the panel looks for sales to invoice. */
const LIST_WINDOW_DAYS = 400
const LIST_MAX = 200

export type Fulfilment = 'pickup' | 'delivery' | null

/**
 * Why a paid sale cannot be invoiced here — or, once it has been, why its
 * invoice now needs a credit note: money that went back after it was numbered.
 */
export type Blocked = 'refunded' | 'disputed' | 'stripe_invoice' | null

export interface BillingAddress {
  name: string
  line1: string
  postalCode: string
  city: string
  /** ISO 3166-1 alpha-2. */
  country: string
}

export interface IssuedInvoice {
  id: string
  number: string
  /** Stripe's hosted invoice page: lasting, and it offers the PDF. */
  hostedUrl: string | null
  /** Ready to send, in the customer's language. */
  message: { subject: string; body: string }
}

export interface LinkSale {
  sessionId: string
  paymentIntentId: string
  /** When the money arrived — the charge, not the opening of checkout. */
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
  /** Pre-fills the form; missing fields must be asked from the customer. */
  billing: Partial<BillingAddress>
  invoice: IssuedInvoice | null
  /** The signed bon de livraison, when the sale was invoiced from the panel. */
  handoverFileId: string | null
  /** From the link's metadata; null when the link offers no paid delivery. */
  deliveryFee: Cents | null
  /** The link's settings could not be read; a delivery sale waits until they can. */
  feeUnknown: boolean
  language: MessageLanguage
  /** An earlier attempt stopped part-way; issuing again finishes or discards it. */
  pendingAttempt: boolean
  /**
   * What that attempt left when it had already numbered the invoice: finishing
   * it needs no form and no signature. Null for an unnumbered draft, and when
   * Stripe could not say — issuing then sorts it out under the lock.
   */
  pendingInvoice: PendingInvoice | null
  blocked: Blocked
  /** The invoice Stripe itself issued for this sale, when the link asks it to. */
  stripeInvoiceNumber: string | null
}

/** A numbered invoice an interrupted attempt left unfinished, as it states itself. */
export interface PendingInvoice {
  id: string
  number: string
  frameNumber: string
  /** YYYY-MM-DD */
  deliveredOn: string
  customerName: string | null
  /** Cents. */
  total: number
}

export interface IssueInput {
  sessionId: string
  frameNumber: string
  /** YYYY-MM-DD, the day the item changed hands. */
  deliveredOn: string
  billing: BillingAddress
  deliveryFeeCollected: boolean
  /** The customer's finger signature, data:image/png;base64,… */
  signature: string
}

// ── Customer message ──────────────────────────────────────────────────────────

const MESSAGES: Record<MessageLanguage, { subject: string; greeting: string; thanks: string; here: string; regards: string }> = {
  fr: { subject: 'Votre facture', greeting: 'Bonjour,', thanks: 'Merci pour votre achat chez Vitesse Eco.', here: 'Votre facture {number} est disponible ici :', regards: 'Bien cordialement,' },
  de: { subject: 'Ihre Rechnung', greeting: 'Guten Tag,', thanks: 'vielen Dank für Ihren Kauf bei Vitesse Eco.', here: 'Ihre Rechnung {number} finden Sie hier:', regards: 'Mit freundlichen Grüßen' },
  nl: { subject: 'Uw factuur', greeting: 'Goedendag,', thanks: 'Hartelijk dank voor uw aankoop bij Vitesse Eco.', here: 'Uw factuur {number} vindt u hier:', regards: 'Met vriendelijke groet,' },
  es: { subject: 'Su factura', greeting: 'Hola:', thanks: 'Gracias por su compra en Vitesse Eco.', here: 'Su factura {number} está disponible aquí:', regards: 'Saludos cordiales,' },
  en: { subject: 'Your invoice', greeting: 'Hello,', thanks: 'Thank you for your purchase from Vitesse Eco.', here: 'Your invoice {number} is available here:', regards: 'Kind regards,' },
}

export function customerMessage(number: string, link: string | null, language: MessageLanguage = 'fr'): IssuedInvoice['message'] {
  const text = MESSAGES[language]
  return {
    subject: `${text.subject} ${number} – Vitesse Eco`,
    body: [
      text.greeting,
      '',
      text.thanks,
      text.here.replace('{number}', number),
      link ?? '',
      '',
      text.regards,
      'Vitesse Eco',
      `${ORGANISATION.phone} · ${ORGANISATION.email}`,
    ].join('\n'),
  }
}

function issued(id: string, number: string, hostedUrl: string | null, language: MessageLanguage): IssuedInvoice {
  return { id, number, hostedUrl, message: customerMessage(number, hostedUrl, language) }
}

// ── Pure planning ─────────────────────────────────────────────────────────────

export interface PlannedLine {
  kind: 'product' | 'delivery' | 'shipping'
  /** Product lines: built from what the session charged, not from a price that may since be archived. */
  productId?: string | null
  quantity: number
  /** Per unit, in cents. */
  unitAmount: Cents
  description: string
}

export interface InvoicePlan {
  lines: PlannedLine[]
  discount: { amount: Cents; label: string } | null
  customFields: Array<{ name: string; value: string }>
  description: string
  /** What the finalised invoice must total — what was paid, plus a fee collected at the door. */
  expectedTotal: Cents
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
  lineItems: Array<{ productId: string | null; quantity: number; subtotal: Cents; name: string }>
  discountAmount: Cents
  shippingAmount: Cents
  amountTotal: Cents
  promotionCode: string | null
  fulfilment: Fulfilment
  /** YYYY-MM-DD in Paris time, from the charge. */
  paidOn: string
  paymentMethod: string
  paymentIntentId: string
  /** The link's delivery fee, from its metadata. */
  deliveryFee: Cents | null
}

/**
 * Everything the invoice will say, decided without touching Stripe — so the
 * rules (delivery fee only when collected, frame number on the line, the paid
 * statement, the total it must reach) are unit-tested rather than discovered on
 * a live invoice.
 */
export function planInvoice(source: PlanSource, input: IssueInput): InvoicePlan {
  const frame = input.frameNumber.trim()
  const lines: PlannedLine[] = source.lineItems.map((item) => {
    const quantity = Math.max(1, item.quantity)
    // A price that does not divide evenly is invoiced as one line for the lot,
    // so the line still equals exactly what was charged.
    const even = item.subtotal % quantity === 0
    return {
      kind: 'product',
      productId: item.productId,
      quantity: even ? quantity : 1,
      unitAmount: cents(even ? item.subtotal / quantity : item.subtotal),
      description: `${even || quantity === 1 ? '' : `${quantity} × `}${item.name} (N° de cadre ${frame})`,
    }
  })

  if (source.shippingAmount > 0) {
    lines.push({ kind: 'shipping', quantity: 1, unitAmount: source.shippingAmount, description: 'Frais de port' })
  }

  const feeCollected =
    source.fulfilment === 'delivery' && input.deliveryFeeCollected && source.deliveryFee !== null && source.deliveryFee > 0
  if (feeCollected) {
    lines.push({
      kind: 'delivery',
      quantity: 1,
      unitAmount: source.deliveryFee!,
      description: 'Livraison à domicile (réglée à la livraison)',
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
      // SIREN, RCS and VAT number are in the footer; this slot proves the handover.
      { name: 'Bon de livraison', value: `signé par le client le ${deliveredOn}` },
    ],
    description:
      `FACTURE ACQUITTÉE – réglée le ${paidOn} (${source.paymentMethod}` +
      `${feeCollected ? ', frais de livraison réglés le ' + deliveredOn : ''}). ` +
      `Aucun montant restant dû. Réf. paiement ${source.paymentIntentId}.`,
    expectedTotal: cents(source.amountTotal + (feeCollected ? source.deliveryFee! : 0)),
  }
}

/** The legal footer every invoice carries. */
export function invoiceFooter(): string {
  const capital = (ORGANISATION as { shareCapital?: string | null }).shareCapital
  return [
    `${ORGANISATION.legalName}${capital ? `, SAS au capital de ${capital}` : ''}`,
    `${ORGANISATION.address.street}, ${ORGANISATION.address.postalCode} ${ORGANISATION.address.city}, France`,
    `SIREN ${ORGANISATION.siren} · RCS ${ORGANISATION.address.city} ${ORGANISATION.siren}`,
    `TVA intracommunautaire ${ORGANISATION.vatNumber}`,
    `${ORGANISATION.email} · ${ORGANISATION.phone}`,
  ].join(' · ')
}

// ── Stripe reads ──────────────────────────────────────────────────────────────

/** A Stripe timestamp as the shop's calendar day. */
function dayOf(unixSeconds: number): string {
  return parisDay(new Date(unixSeconds * 1000))
}

function customField(session: Stripe.Checkout.Session, key: string): string | null {
  const field = session.custom_fields?.find((entry) => entry.key === key)
  if (!field) return null
  return field.dropdown?.value ?? field.text?.value ?? null
}

/** One read per link per request, however many of its sales are listed. */
type LinkCache = Map<string, Promise<Record<string, string> | null>>

/** The link's metadata, or null when it could not be read — never "no settings". */
function linkMetadata(session: Stripe.Checkout.Session, cache: LinkCache): Promise<Record<string, string> | null> {
  const id = typeof session.payment_link === 'string' ? session.payment_link : session.payment_link?.id
  if (!id) return Promise.resolve({})
  if (!cache.has(id)) {
    cache.set(
      id,
      stripe()
        .paymentLinks.retrieve(id)
        .then((link) => link.metadata ?? {})
        .catch((error) => {
          console.warn(`[link-invoices] could not read link ${id}:`, String(error).slice(0, 200))
          return null
        })
    )
  }
  return cache.get(id)!
}

function blockedReason(session: Stripe.Checkout.Session, charge: Stripe.Charge | null): Blocked {
  if (session.invoice) return 'stripe_invoice'
  if (charge?.disputed) return 'disputed'
  if (charge && (charge.refunded || charge.amount_refunded > 0)) return 'refunded'
  return null
}

const SESSION_EXPAND = ['line_items', 'payment_intent.latest_charge', 'discounts.promotion_code'] as const

/**
 * The statuses of an invoice that holds a number nobody has cancelled. Open and
 * paid, and uncollectible too: that is Stripe's bad-debt mark, not a
 * cancellation — the invoice stays valid and can still be paid. Only `void`
 * cancels a number.
 */
const LIVE_NUMBER = new Set<string>(['open', 'paid', 'uncollectible'])

/**
 * The pending invoice when it already carries a number, else null: a draft, an
 * invoice of another sale, one gone or voided — or one Stripe could not be asked
 * about right now, which issuing will settle under the lock.
 */
async function numberedPending(id: string, sessionId: string): Promise<PendingInvoice | null> {
  const invoice = await invoiceOrNull(id).catch(() => null)
  if (!invoice || invoice.metadata?.checkout_session !== sessionId || !LIVE_NUMBER.has(invoice.status ?? '')) return null
  return {
    id,
    number: invoice.number ?? id,
    frameNumber: invoice.metadata?.frame_number ?? '',
    deliveredOn: invoice.metadata?.delivered_on ?? '',
    customerName: invoice.customer_name ?? null,
    total: invoice.total,
  }
}

/** `readPending`: the list asks what an interrupted attempt left; issuing settles it itself and need not. */
async function toSale(session: Stripe.Checkout.Session, cache: LinkCache, readPending = false): Promise<LinkSale> {
  const intent = session.payment_intent as Stripe.PaymentIntent
  const charge = intent.latest_charge as Stripe.Charge | null
  const details = session.customer_details
  const address = details?.address
  const promo = session.discounts?.[0]?.promotion_code
  const metadata = await linkMetadata(session, cache)
  const language = languageFor(address?.country)
  const invoiceId = intent.metadata?.invoice_id
  const pendingId = intent.metadata?.invoice_pending
  const stripeInvoice = session.invoice

  return {
    sessionId: session.id,
    paymentIntentId: intent.id,
    paidAt: new Date((charge?.created ?? session.created) * 1000).toISOString(),
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? 'eur',
    productName: (session.line_items?.data ?? []).map((item) => item.description).join(', '),
    email: details?.email ?? null,
    phone: details?.phone ?? null,
    fulfilment: fulfilmentOf(session),
    deliveryAddress: customField(session, 'address'),
    promotionCode: typeof promo === 'object' && promo ? promo.code : null,
    paymentMethod: paymentMethodLabel(charge?.payment_method_details?.type ?? intent.payment_method_types[0]),
    billing: {
      ...(details?.individual_name || details?.name ? { name: (details.individual_name ?? details.name)! } : {}),
      ...(address?.line1 ? { line1: [address.line1, address.line2].filter(Boolean).join(', ') } : {}),
      ...(address?.postal_code ? { postalCode: address.postal_code } : {}),
      ...(address?.city ? { city: address.city } : {}),
      ...(address?.country ? { country: address.country } : {}),
    },
    // Read from what issuing wrote on the PaymentIntent: no extra call per row.
    invoice: invoiceId
      ? issued(invoiceId, intent.metadata.invoice_number || invoiceId, intent.metadata.invoice_url || null, language)
      : null,
    handoverFileId: intent.metadata?.handover_file || null,
    deliveryFee: feeFromMetadata(metadata),
    feeUnknown: metadata === null,
    language,
    pendingAttempt: Boolean(pendingId),
    // One read, and only for the rare sale an attempt left part-way.
    pendingInvoice: readPending && pendingId && !invoiceId ? await numberedPending(pendingId, session.id) : null,
    // Reported for invoiced sales too. A refund made after the invoice was
    // numbered needs a credit note, and hiding it once the invoice exists is how
    // a settled invoice would be sent to a customer who got their money back.
    blocked: blockedReason(session, charge),
    stripeInvoiceNumber:
      typeof stripeInvoice === 'object' && stripeInvoice ? (stripeInvoice.number ?? stripeInvoice.id ?? null) : stripeInvoice ?? null,
  }
}

async function paidLinkSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: [...SESSION_EXPAND] })
  // Only a paid Payment Link sale. A shop checkout already has an order, and
  // invoicing it here would number the same sale twice.
  if (!session.payment_link || session.payment_status !== 'paid' || !session.payment_intent) {
    throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `${sessionId} is not a paid payment-link sale` })
  }
  return session
}

/** Run at most `limit` at once; a failure is that item's, not the whole list's. */
async function settleBounded<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<Array<R | null>> {
  const results: Array<R | null> = new Array(items.length).fill(null)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = await work(items[index]!)
      } catch (error) {
        console.warn('[link-invoices] a sale could not be read:', String(error).slice(0, 200))
      }
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Paid Payment Link sales, newest first.
 *
 * One list call carries the line items, the charge and the promotion code; the
 * only other reads are one per distinct link, bounded. A sale that cannot be
 * read is left out of the answer rather than failing every other row.
 */
export async function listLinkSales(): Promise<{ items: LinkSale[]; unreadable: number }> {
  const since = Math.floor(Date.now() / 1000) - LIST_WINDOW_DAYS * 86_400
  const sessions: Stripe.Checkout.Session[] = []
  for await (const session of stripe().checkout.sessions.list({
    status: 'complete',
    limit: 100,
    created: { gte: since },
    expand: SESSION_EXPAND.map((path) => `data.${path}`),
  })) {
    if (session.payment_link && session.payment_status === 'paid' && session.payment_intent) sessions.push(session)
    if (sessions.length >= LIST_MAX) break
  }
  const cache: LinkCache = new Map()
  const sales = await settleBounded(sessions, 5, (session) => toSale(session, cache, true))
  const items = sales.filter((sale): sale is LinkSale => sale !== null)
  return { items, unreadable: sales.length - items.length }
}

/** A fresh link to the invoice PDF — Stripe's PDF links are not permanent. */
export async function invoicePdfUrl(invoiceId: string): Promise<string> {
  const invoice = await stripe().invoices.retrieve(invoiceId)
  // Only invoices this module issued: the panel must not become a reader for
  // every invoice in the account.
  if (!invoice.metadata?.checkout_session || !invoice.invoice_pdf) {
    throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `${invoiceId} is not a link-sale invoice` })
  }
  return invoice.invoice_pdf
}

// ── Issuing ───────────────────────────────────────────────────────────────────

async function ensureVatRate(): Promise<string> {
  const rates = await stripe().taxRates.list({ active: true, limit: 100 })
  const existing = rates.data.find((rate) => rate.percentage === VAT_PERCENT && rate.inclusive && rate.country === 'FR')
  if (existing) return existing.id
  const created = await stripe().taxRates.create(
    { display_name: 'TVA', percentage: VAT_PERCENT, inclusive: true, country: 'FR', jurisdiction: 'FR', description: 'TVA France 20 %' },
    { idempotencyKey: 'link-invoice:tax-rate:fr-20-inclusive' }
  )
  return created.id
}

async function ensureAccountVatId(): Promise<string> {
  const ids = await stripe().taxIds.list({ owner: { type: 'self' }, limit: 20 })
  const existing = ids.data.find((entry) => entry.value.replace(/\s/g, '') === ACCOUNT_VAT_ID)
  if (existing) return existing.id
  return (await stripe().taxIds.create({ owner: { type: 'self' }, type: 'eu_vat', value: ACCOUNT_VAT_ID })).id
}

/**
 * Hold the sale for the length of one issue. Two submissions for the same sale
 * — two devices, a double tap that escaped the button — cannot both reach the
 * numbering step. Advisory, transaction-scoped: released when the work ends,
 * whether it succeeded, failed or the function died.
 */
async function withSaleLock<T>(sessionId: string, work: () => Promise<T>): Promise<T> {
  return withTransaction(async (tx) => {
    const result = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${'link-invoice:' + sessionId})) AS ok`)
    if (!(result.rows[0] as { ok?: boolean } | undefined)?.ok) {
      throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
        messageKey: 'admin.invoice_in_progress',
        internal: `${sessionId}: an invoice is already being issued`,
      })
    }
    return work()
  })
}

async function markPaymentIntent(intentId: string, metadata: Record<string, string>): Promise<void> {
  await stripe().paymentIntents.update(intentId, { metadata })
}

function stripeUnavailable(what: string, cause: unknown): AppError {
  return new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
    messageKey: 'admin.stripe_unavailable',
    internal: what,
    cause,
  })
}

/**
 * An invoice by id, or null only when Stripe says it does not exist. Anything
 * else — a timeout, a 5xx, a rate limit — is not an answer, and treating it as
 * "gone" is how a numbered invoice would be forgotten and another numbered.
 */
async function invoiceOrNull(id: string): Promise<Stripe.Invoice | null> {
  try {
    return await stripe().invoices.retrieve(id)
  } catch (error) {
    if ((error as { code?: string })?.code === 'resource_missing') return null
    throw stripeUnavailable(`could not read invoice ${id}`, error)
  }
}

/** A field a finished earlier invoice states differently from the form just submitted. */
export type ResumeDifference = 'frameNumber' | 'deliveredOn' | 'name' | 'address' | 'country' | 'deliveryFee'

export interface ResumedInvoice extends IssuedInvoice {
  resumed: boolean
  /** What the issued invoice actually states — on a resume, the earlier attempt's values. */
  frameNumber: string
  deliveredOn: string
  customerName: string
  /** Cents. */
  total: number
  /** What a resume finished differently from what was just typed; empty when nothing was typed. */
  differences: ResumeDifference[]
  differs: boolean
}

/**
 * Everything a numbered invoice states that the new submission contradicts.
 *
 * Frame and date are on the invoice's metadata. Name and address are the
 * snapshot Stripe froze on the invoice when it was numbered — editing the
 * customer since changes nothing on it. The delivery fee is read from the total:
 * an invoice only reaches a number if it equals what was paid plus the fee
 * collected at the door, so a total above the amount paid IS the fee line.
 */
export function resumeDifferences(
  invoice: Pick<Stripe.Invoice, 'metadata' | 'customer_name' | 'customer_address' | 'total'>,
  sale: { amountTotal: number; fulfilment: Fulfilment },
  input: IssueInput
): ResumeDifference[] {
  const same = (stated: string | null | undefined, typed: string) => (stated ?? '').trim() === typed.trim()
  const address = invoice.customer_address
  const differences: ResumeDifference[] = []
  if (!same(invoice.metadata?.frame_number, input.frameNumber)) differences.push('frameNumber')
  if (!same(invoice.metadata?.delivered_on, input.deliveredOn)) differences.push('deliveredOn')
  if (!same(invoice.customer_name, input.billing.name)) differences.push('name')
  if (
    !same(address?.line1, input.billing.line1) ||
    !same(address?.postal_code, input.billing.postalCode) ||
    !same(address?.city, input.billing.city)
  ) {
    differences.push('address')
  }
  if (!same(address?.country?.toUpperCase(), input.billing.country.toUpperCase())) differences.push('country')
  const feeOnInvoice = invoice.total !== sale.amountTotal
  const feeTyped = sale.fulfilment === 'delivery' && input.deliveryFeeCollected
  if (feeOnInvoice !== feeTyped) differences.push('deliveryFee')
  return differences
}

/**
 * An earlier attempt that stopped part-way. A draft is unnumbered and is
 * discarded; a numbered invoice is FINISHED — never left dangling, never
 * doubled. Runs before every other check: once a number exists it must be
 * settled, whatever has happened to the sale since.
 *
 * `input` is the form just submitted, compared with what the finished invoice
 * states; null when the seller only asked to finish, and typed nothing.
 *
 * The pending marker is cleared only when no candidate still holds a live
 * number: each was deleted, is missing, was voided, or belongs to another sale.
 * Any doubt leaves it in place and fails the request.
 */
async function resumeEarlierAttempt(
  session: Stripe.Checkout.Session,
  intent: Stripe.PaymentIntent,
  input: IssueInput | null
): Promise<ResumedInvoice | null> {
  const candidates = new Set<string>()
  if (intent.metadata?.invoice_pending) candidates.add(intent.metadata.invoice_pending)
  try {
    const found = await stripe().invoices.search({ query: `metadata['checkout_session']:'${session.id}'`, limit: 10 })
    for (const invoice of found.data) if (invoice.id) candidates.add(invoice.id)
  } catch {
    // Search is a second net under the pending marker; its absence is not fatal.
  }

  for (const id of candidates) {
    let invoice = await invoiceOrNull(id)
    if (!invoice || invoice.metadata?.checkout_session !== session.id) continue

    if (invoice.status === 'draft') {
      try {
        await stripe().invoices.del(id)
        continue
      } catch (error) {
        // Not deleted: find out what it became before deciding anything.
        invoice = await invoiceOrNull(id)
        if (!invoice) continue
        if (invoice.status === 'draft') throw stripeUnavailable(`could not delete draft ${id}`, error)
      }
    }

    if (LIVE_NUMBER.has(invoice.status ?? '')) {
      let paid = invoice
      if (invoice.status !== 'paid') {
        // Open — or marked uncollectible in the Dashboard by someone who saw an
        // unpaid invoice for a sale already paid. Stripe lets both be marked
        // paid, and the money did arrive, through the link.
        try {
          paid = await stripe().invoices.pay(id, { paid_out_of_band: true })
        } catch (error) {
          throw stripeUnavailable(`could not settle resumed invoice ${id}`, error)
        }
      }
      const number = paid.number ?? id
      await markPaymentIntent(intent.id, {
        invoice_id: id,
        invoice_number: number,
        invoice_url: paid.hosted_invoice_url ?? '',
        invoice_pending: '',
        ...(invoice.metadata?.handover_file ? { handover_file: invoice.metadata.handover_file } : {}),
      })
      const differences = input
        ? resumeDifferences(invoice, { amountTotal: session.amount_total ?? 0, fulfilment: fulfilmentOf(session) }, input)
        : []
      return {
        // Written to in the language of the customer the invoice names.
        ...issued(id, number, paid.hosted_invoice_url ?? null, languageFor(invoice.customer_address?.country)),
        resumed: true,
        frameNumber: invoice.metadata?.frame_number ?? '',
        deliveredOn: invoice.metadata?.delivered_on ?? '',
        customerName: invoice.customer_name ?? '',
        total: paid.total,
        differences,
        differs: differences.length > 0,
      }
    }
    // void: someone cancelled that number, and a cancelled number is settled.
  }
  if (intent.metadata?.invoice_pending) await markPaymentIntent(intent.id, { invoice_pending: '' })
  return null
}

function fulfilmentOf(session: Stripe.Checkout.Session): Fulfilment {
  const value = customField(session, 'delivery')
  return value === 'pickup' || value === 'delivery' ? value : null
}

function todayInParis(): string {
  return parisDay(new Date())
}

/**
 * Finish the invoice an interrupted attempt numbered — and nothing else.
 *
 * Nothing is typed and nothing is signed: the invoice already states the frame
 * number, the date and the customer, and its signed receipt is already on file.
 * Asking for a new signature here asked the seller for something the server
 * then threw away, from a customer who had usually left with the bike.
 *
 * When no numbered invoice is waiting, a leftover draft is discarded as any
 * attempt would, and the sale is handed back to the ordinary form.
 */
export async function finishLinkInvoice(sessionId: string): Promise<ResumedInvoice> {
  return withSaleLock(sessionId, async () => {
    const session = await paidLinkSession(sessionId)
    const intent = session.payment_intent as Stripe.PaymentIntent
    if (intent.metadata?.invoice_id) {
      throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
        internal: `${session.id} already invoiced as ${intent.metadata.invoice_id}`,
      })
    }
    const finished = await resumeEarlierAttempt(session, intent, null)
    if (!finished) {
      throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
        messageKey: 'admin.nothing_to_finish',
        internal: `${session.id}: no numbered invoice was waiting to be finished`,
      })
    }
    return finished
  })
}

/**
 * Stripe's answer when a line names a product it no longer has — deleted since
 * the sale (an archived one is still accepted). Only that falls back to an
 * amount line. A timeout, a 429 or a 5xx may have written the line all the
 * same, and a second line under another key would double it on the invoice.
 */
export function productIsGone(error: unknown): boolean {
  const failure = error as { type?: string; param?: string } | null
  return failure?.type === 'StripeInvalidRequestError' && (failure.param ?? '').startsWith('price_data[product]')
}

/** Every line the session charged — beyond the first page when there are more. */
async function allLineItems(session: Stripe.Checkout.Session): Promise<Stripe.LineItem[]> {
  const first = session.line_items
  if (first && !first.has_more) return first.data
  const items: Stripe.LineItem[] = []
  for await (const item of stripe().checkout.sessions.listLineItems(session.id, { limit: 100 })) items.push(item)
  return items
}

/** Issue the invoice for one sale, finalised and marked paid. */
export async function issueLinkInvoice(input: IssueInput): Promise<ResumedInvoice> {
  return withSaleLock(input.sessionId, async () => {
    const session = await paidLinkSession(input.sessionId)
    const intent = session.payment_intent as Stripe.PaymentIntent
    const charge = intent.latest_charge as Stripe.Charge | null
    const language = languageFor(input.billing.country)

    if (intent.metadata?.invoice_id) {
      throw new AppError(ERROR_CODES.ALREADY_PROCESSED, {
        internal: `${session.id} already invoiced as ${intent.metadata.invoice_id}`,
      })
    }

    const resumed = await resumeEarlierAttempt(session, intent, input)
    if (resumed) return resumed

    const blocked = blockedReason(session, charge)
    if (blocked) {
      throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, {
        messageKey: 'admin.invoice_blocked',
        internal: `${session.id} cannot be invoiced here: ${blocked}`,
      })
    }
    if ((session.total_details?.amount_tax ?? 0) > 0) {
      // Stripe Tax on the link: its tax is not the inclusive French rate this
      // module applies, and an invoice that restates it differently is wrong.
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, { internal: `${session.id}: links with Stripe Tax are not supported` })
    }

    const paidOn = dayOf(charge?.created ?? session.created)
    if (!isHandoverDay(input.deliveredOn, paidOn, todayInParis())) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
        messageKey: 'admin.invoice_date_invalid',
        internal: `${session.id}: handover date ${input.deliveredOn} outside ${paidOn}..today`,
      })
    }

    const sale = await toSale(session, new Map())
    if (sale.fulfilment === 'delivery' && input.deliveryFeeCollected) {
      if (sale.feeUnknown) {
        throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
          messageKey: 'admin.fee_unknown',
          internal: `${session.id}: link settings unreadable`,
        })
      }
      if (sale.deliveryFee === null) {
        // The box can only be ticked for a link that states its fee; a request
        // that ticks it anyway is refused rather than invoicing an invented amount.
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
          internal: `${session.id}: delivery fee collected, but the link has no ${LINK_METADATA.deliveryFeeCents}`,
        })
      }
    }

    const items = await allLineItems(session)
    const plan = planInvoice(
      {
        lineItems: items.map((item) => ({
          productId: typeof item.price?.product === 'string' ? item.price.product : (item.price?.product as Stripe.Product | undefined)?.id ?? null,
          quantity: item.quantity ?? 1,
          subtotal: cents(item.amount_subtotal),
          name: item.description ?? 'Article',
        })),
        discountAmount: cents(session.total_details?.amount_discount ?? 0),
        shippingAmount: cents(session.total_details?.amount_shipping ?? 0),
        amountTotal: cents(session.amount_total ?? 0),
        promotionCode: sale.promotionCode,
        fulfilment: sale.fulfilment,
        paidOn,
        paymentMethod: sale.paymentMethod,
        paymentIntentId: intent.id,
        deliveryFee: sale.deliveryFee,
      },
      input
    )

    // One key per ATTEMPT, never per form. The lock stops two attempts running
    // at once and the pending marker carries what one attempt leaves for the
    // next, so keys only have to make stripe-node's own retries safe. A key
    // derived from the form would, after a draft was deleted, replay that
    // deleted draft for 24 hours.
    const attempt = randomUUID()
    const key = (step: string) => `link-invoice:${session.id}:${attempt}:${step}`
    const currency = session.currency ?? 'eur'

    // The signed receipt first: it is not a numbered document, so a failure
    // after it leaves a harmless orphan file rather than a gap in the invoices.
    const receipt = await buildHandoverPdf(
      {
        reference: intent.id,
        productName: items.map((item) => item.description).join(', '),
        frameNumber: input.frameNumber.trim(),
        deliveredOn: frenchDay(input.deliveredOn),
        deliveredOnIso: input.deliveredOn,
        handover: sale.fulfilment === 'delivery' ? 'delivery' : 'pickup',
        language,
        customer: {
          name: input.billing.name,
          address: `${input.billing.line1}, ${input.billing.postalCode} ${input.billing.city}, ${input.billing.country}`,
          email: sale.email,
          phone: sale.phone,
        },
      },
      decodeSignature(input.signature)
    )
    const handoverFile = await uploadEvidence(receipt, `handover-${intent.id}.pdf`, 'application/pdf', key('handover'))

    const [taxRate, accountVatId] = await Promise.all([ensureVatRate(), ensureAccountVatId()])

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
          { name: plan.discount.label, amount_off: plan.discount.amount, currency, duration: 'once', max_redemptions: 1 },
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
        // Lines read before VAT, the VAT stated once: the French layout.
        rendering: { amount_tax_display: 'exclude_tax' },
        ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
        custom_fields: plan.customFields,
        description: plan.description,
        footer: invoiceFooter(),
        metadata: {
          checkout_session: session.id,
          payment_intent: intent.id,
          frame_number: input.frameNumber.trim(),
          delivered_on: input.deliveredOn,
          handover_file: handoverFile,
          attempt,
        },
      },
      { idempotencyKey: key('invoice') }
    )
    // Before anything is numbered: any later attempt finds this draft first.
    await markPaymentIntent(intent.id, { invoice_pending: draft.id! })

    for (const [index, line] of plan.lines.entries()) {
      const base = { customer: customer.id, invoice: draft.id!, description: line.description, tax_rates: [taxRate] }
      try {
        await stripe().invoiceItems.create(
          line.productId
            ? { ...base, price_data: { currency, product: line.productId, unit_amount: line.unitAmount }, quantity: line.quantity }
            : { ...base, amount: line.unitAmount * line.quantity, currency },
          { idempotencyKey: key(`line-${index}`) }
        )
      } catch (error) {
        // Anything but a product Stripe no longer has goes up, and the pending
        // marker makes the next attempt discard this draft whole.
        if (!line.productId || !productIsGone(error)) throw error
        // The catalogue product was deleted since the sale. The line still
        // states exactly what was charged, as one amount.
        await stripe().invoiceItems.create(
          {
            ...base,
            description: line.quantity > 1 ? `${line.quantity} × ${line.description}` : line.description,
            amount: line.unitAmount * line.quantity,
            currency,
          },
          { idempotencyKey: key(`line-${index}-amount`) }
        )
      }
    }

    // The invoice must say what was paid. If it does not, it is thrown away
    // while still an unnumbered draft — never finalised and then explained.
    const built = await stripe().invoices.retrieve(draft.id!)
    if (built.total !== plan.expectedTotal || built.currency !== currency) {
      await stripe().invoices.del(draft.id!).catch(() => {})
      await markPaymentIntent(intent.id, { invoice_pending: '' })
      throw new AppError(ERROR_CODES.INTERNAL, {
        messageKey: 'admin.invoice_total_mismatch',
        internal: `${session.id}: invoice total ${built.total} ${built.currency} ≠ paid ${plan.expectedTotal} ${currency}`,
      })
    }

    const finalised = await stripe().invoices.finalizeInvoice(draft.id!, { auto_advance: false }, { idempotencyKey: key('finalize') })
    // Paid out of band: the money already arrived through the link. Attaching
    // the PaymentIntent itself is refused — a link session has no customer, and
    // Stripe requires the two to match.
    const paid = await stripe().invoices.pay(finalised.id!, { paid_out_of_band: true }, { idempotencyKey: key('pay') })
    const number = paid.number ?? paid.id!

    await markPaymentIntent(intent.id, {
      invoice_id: paid.id!,
      invoice_number: number,
      invoice_url: paid.hosted_invoice_url ?? '',
      invoice_pending: '',
      handover_file: handoverFile,
    })

    return {
      ...issued(paid.id!, number, paid.hosted_invoice_url ?? null, language),
      resumed: false,
      frameNumber: input.frameNumber.trim(),
      deliveredOn: input.deliveredOn,
      customerName: input.billing.name.trim(),
      total: paid.total,
      differences: [],
      differs: false,
    }
  })
}
