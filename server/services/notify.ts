/**
 * Tell the owner that money or an order has arrived.
 *
 * Before this, nothing did: a customer paid, Stripe knew, the database knew,
 * and the shop found out only by opening the admin panel. Two channels, each
 * switched on by its own environment variables and silent without them:
 *
 *   Telegram  TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID — instant, on the phone
 *   Email     RESEND_API_KEY + NOTIFY_EMAIL_FROM (+ NOTIFY_EMAIL_TO)
 *
 * A notification must never fail what it describes — the same rule as the
 * audit log. It is awaited (a serverless function may be frozen the moment it
 * answers, taking an un-awaited request with it) but bounded by a timeout, and
 * every failure is logged and swallowed. A customer whose payment succeeded is
 * never told otherwise because Telegram was slow.
 *
 * The two channels do not carry the same thing, because they are not the same
 * kind of recipient. Resend is a processor under a data processing agreement
 * with the EU standard clauses, so the email is a pointer: the order number,
 * the amount, the items, how it is paid and handed over, the town, and the
 * link to the order. No name, no email, no phone, no street. Telegram offers no
 * such agreement, so it gets a ping and nothing about anyone: what happened,
 * and the admin list to open. The privacy policy says exactly this.
 *
 * Written in Arabic: it is read by the owner, not by customers.
 */
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { db } from '../db/client'
import { orderItems, orders } from '../db/schema'
import { audit } from './audit'
import { noteOnOrder, OVERSOLD_NOTE } from './orders'
import { firstTime } from './webhookClaims'
import { cents, format } from '../../shared/money'
import { ORGANISATION, SITE_URL } from '../../shared/organisation'

const TIMEOUT_MS = 4_000

export interface OwnerMessage {
  /** What happened, saying nothing about who: the whole Telegram message. */
  ping: string
  /** Where the ping sends the owner: a list, never a record. */
  pingLink: string
  /** The email: its subject, its lines, and the record it points at. */
  title: string
  lines: string[]
  link: string
}

const ADMIN_ORDERS = `${SITE_URL}/admin/commandes`

const PAYMENT_LABELS: Record<string, string> = {
  stripe: 'دفع إلكتروني (Stripe)',
  paypal: 'PayPal',
  cod: 'الدفع عند الاستلام',
  in_store: 'الدفع في المحل',
}

/**
 * A left-to-right value placed in an Arabic line.
 *
 * A line that starts with an Arabic label is laid out right to left, and the
 * bidi algorithm then detaches the edges of a Latin or numeric value: digits
 * right after Arabic become Arabic numbers (a town's postcode lands after the
 * town), and a trailing symbol takes the line's direction (the € of
 * "1 250,00 €" lands on the far side). A left-to-right mark fixes each edge.
 *
 * Only where an edge needs it. A mark is invisible but it is copied: one stuck
 * to an order number or a payment reference makes the pasted search find
 * nothing. Identifiers start with a letter or sit on their own line, so they
 * never get one. LRM rather than the newer isolates because every Telegram and
 * mail client honours it.
 */
const LRM = '‎'
export function ltr(value: string): string {
  const lead = /^[\p{N}+-]/u.test(value) ? LRM : ''
  const tail = /[\p{L}\p{N}]$/u.test(value) ? '' : LRM
  return `${lead}${value}${tail}`
}

/**
 * Text a customer typed, made safe to put in front of the owner.
 *
 * Only letters, digits, spaces, apostrophes and hyphens survive. That is enough
 * to recognise a town, and everything else is how a lure is built: Telegram and
 * mail clients turn "://", a bare "domain.com", "@name" or "/command" into
 * something tappable whatever the formatting mode, a line break lets a typed
 * address pose as a line of the shop's own message, and a bidi control can
 * reorder what is shown. The admin link holds the exact text.
 */
export function plainText(value: string | null | undefined, max = 40): string {
  const kept = (value ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}'’ -]+/gu, ' ')
    // A mark belongs to the letter before it; one whose letter was removed
    // (the emoji selector of "⚠️") goes with it.
    .replace(/(^|[^\p{L}\p{M}\p{N}])\p{M}+/gu, '$1')
    .replace(/ {2,}/g, ' ')
    .trim()
  // By code point, so a cut never splits a character in two.
  const characters = Array.from(kept)
  return characters.length > max ? `${characters.slice(0, max - 1).join('').trimEnd()}…` : kept
}

function money(amount: number): string {
  return ltr(format(cents(amount), 'fr-FR'))
}

function parisTime(date: Date): string {
  // Pinned: the function runs in UTC, the owner reads Paris time.
  return ltr(
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(date)
  )
}

/** "86000 Poitiers FR" from whatever parts the customer gave — or null. */
function town(parts: { postalCode?: string | null; city?: string | null; country?: string | null } | null | undefined): string | null {
  if (!parts?.city) return null
  const text = [plainText(parts.postalCode, 12), plainText(parts.city), plainText(parts.country, 2)].filter(Boolean).join(' ')
  return text ? ltr(text) : null
}

/** Telegram's HTML mode: only these three characters need escaping. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderTelegram(message: OwnerMessage): string {
  return [`<b>${escapeHtml(message.ping)}</b>`, '', escapeHtml(message.pingLink)].join('\n')
}

export function renderEmail(message: OwnerMessage): { subject: string; text: string } {
  return { subject: message.title, text: [...message.lines, '', message.link].join('\n') }
}

async function post(url: string, init: RequestInit): Promise<void> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`)
}

async function sendTelegram(message: OwnerMessage): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  await post(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: renderTelegram(message),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

async function sendEmail(message: OwnerMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_EMAIL_FROM
  if (!key || !from) return
  const to = (process.env.NOTIFY_EMAIL_TO || ORGANISATION.email).split(',').map((entry) => entry.trim()).filter(Boolean)
  const { subject, text } = renderEmail(message)
  await post('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
  })
}

/** Both channels at once; neither can fail the caller. */
export async function notifyOwner(message: OwnerMessage): Promise<void> {
  const results = await Promise.allSettled([sendTelegram(message), sendEmail(message)])
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error(`[notify] ${index === 0 ? 'telegram' : 'email'} failed:`, String(result.reason).slice(0, 300))
    }
  }
}

/** Look the order up and send it; for call sites that must not await a throw. */
export async function notifyOrder(orderNumber: string, event: 'placed' | 'paid'): Promise<void> {
  try {
    const message = await orderMessage(orderNumber, event)
    if (message) await notifyOwner(message)
  } catch (error) {
    console.error(`[notify] order ${orderNumber} (${event}) could not be described:`, String(error).slice(0, 300))
  }
}

// ── What gets said ────────────────────────────────────────────────────────────

/**
 * A shop order, read back from the database — the order as stored, not as the
 * request described it.
 */
export async function orderMessage(orderNumber: string, event: 'placed' | 'paid'): Promise<OwnerMessage | null> {
  const [order] = await db()
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      totalCents: orders.totalCents,
      paymentMethod: orders.paymentMethod,
      shippingMethodCode: orders.shippingMethodCode,
      shippingAddress: orders.shippingAddress,
      adminNotes: orders.adminNotes,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1)
  if (!order) return null

  const items = await db()
    .select({ name: orderItems.nameSnapshot, color: orderItems.colorSnapshot, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))

  // A payment that arrived after its stock hold lapsed, short of stock, leaves
  // its warning in the admin notes (server/services/orders.ts). That is
  // exactly what the owner must see the moment the money is announced — as a
  // fixed sentence: the notes are free text a person can also write in, and
  // whatever they hold stays on the order page.
  const oversold = (order.adminNotes ?? '')
    .split('\n')
    .some((note) => note.startsWith(OVERSOLD_NOTE))
  const warning = oversold ? '⚠️ نقص في المخزون عند وصول الدفعة — التفاصيل في ملاحظات الطلب' : null
  const destination = town(order.shippingAddress as { postalCode?: string; city?: string; country?: string } | null)
  const payment = PAYMENT_LABELS[order.paymentMethod] ?? ltr(order.paymentMethod)

  return {
    ping: [
      event === 'paid' ? `💶 طلب مدفوع جديد — ${payment}` : `🛒 طلب جديد — ${payment} (لم يُدفع بعد)`,
      ...(warning ? [warning] : []),
    ].join('\n'),
    pingLink: ADMIN_ORDERS,
    title:
      event === 'paid'
        ? `💶 طلب مدفوع ${order.orderNumber} — ${money(order.totalCents)}`
        : `🛒 طلب جديد ${order.orderNumber} — ${money(order.totalCents)} (لم يُدفع بعد)`,
    lines: [
      ...items.map((item) => `• ${item.quantity} × ${item.name}${item.color ? ` (${item.color})` : ''}`),
      '',
      destination ? `التسليم: ${destination}` : `التسليم: ${ltr(order.shippingMethodCode)}`,
      `الدفع: ${payment}`,
      `الوقت: ${parisTime(order.createdAt)}`,
      ...(warning ? ['', warning] : []),
    ],
    link: `${ADMIN_ORDERS}/${order.orderNumber}`,
  }
}

/** Money that reached an order after it closed. */
export interface ClosedOrderPayment {
  orderNumber: string
  provider: 'stripe' | 'paypal'
  /** The provider's own reference for the money: a Checkout Session, a PayPal capture. */
  reference: string | null
  /** What the order was when the money arrived. */
  status: string
}

export function closedOrderPaymentMessage(payment: ClosedOrderPayment): OwnerMessage {
  const provider = payment.provider === 'stripe' ? 'Stripe' : 'PayPal'
  return {
    ping: `⚠️ دفعة ${provider} وصلت على طلب ملغى — افتح لوحة الإدارة اليوم`,
    pingLink: ADMIN_ORDERS,
    title: `⚠️ دفعة ${provider} على طلب مغلق ${payment.orderNumber}`,
    lines: [
      `استلم ${provider} المال لكن الطلب كان ${payment.status === 'cancelled' ? 'ملغى' : ltr(payment.status)} عند وصول الدفعة.`,
      `المطلوب: إما استرداد المبلغ من ${provider}، أو تنفيذ الطلب يدويًا.`,
      // On its own line, unmarked: it is what gets pasted into the provider's search.
      'مرجع الدفعة:',
      payment.reference ?? '—',
    ],
    link: `${ADMIN_ORDERS}/${payment.orderNumber}`,
  }
}

/**
 * The customer paid for an order that had already closed — cancelled by the
 * sweep or by hand while they were still paying. Not an order to fulfil and not
 * a failure to ignore: a person must refund it or honour it, today.
 *
 * Every path that can see it reports it (the PayPal capture, both webhooks),
 * and a re-claimed event runs its handler again, so it is said once per
 * payment: logged every time, audited and announced the first.
 */
export async function reportPaymentOnClosedOrder(payment: ClosedOrderPayment): Promise<void> {
  // An order that WAS paid, by this very payment, and was cancelled afterwards
  // on purpose: a late or re-run event for that payment is not new money. The
  // person who cancelled it already decided what happens to it.
  if (await isTheRecordedPayment(payment)) {
    console.warn(`[payments] ${payment.provider} ${payment.reference} for ${payment.orderNumber} already paid it before it was cancelled`)
    return
  }
  console.error(
    `[payments] ${payment.provider} payment ${payment.reference ?? '(no reference)'} landed on ${payment.orderNumber}, ` +
      `which is ${payment.status} — refund or honour it`
  )
  const key = `paid-while-closed:${payment.provider}:${payment.orderNumber}:${payment.reference ?? 'unknown'}`
  if (!(await firstTime(key))) return
  await audit({
    action: 'order.paid_while_closed',
    actorType: 'system',
    resourceType: 'order',
    resourceId: payment.orderNumber,
    metadata: { provider: payment.provider, reference: payment.reference, status: payment.status },
  })
  // On the order itself, where the panel shows it to whoever opens it — the
  // alert may go unread, and a log is read by nobody.
  const provider = payment.provider === 'stripe' ? 'Stripe' : 'PayPal'
  await noteOnOrder(
    payment.orderNumber,
    `ATTENTION : paiement ${provider} encaissé après l'annulation de la commande (référence ${payment.reference ?? 'non communiquée'}). ` +
      `Stock non décompté — à honorer ou à rembourser à la main.`
  ).catch((error: unknown) => {
    console.error(`[payments] ${payment.orderNumber}: could not write the closed-order note`, String(error).slice(0, 200))
  })
  await notifyOwner(closedOrderPaymentMessage(payment))
}

/**
 * Whether the order had been paid, by the payment now reported, before it was
 * cancelled. `paid_at` is stamped only by a transition to paid, and the
 * reference must be the one recorded on the order: a second, different
 * payment on a paid-then-cancelled order is still money to give back.
 * A read that fails answers false — reporting twice beats staying silent.
 */
async function isTheRecordedPayment(payment: ClosedOrderPayment): Promise<boolean> {
  if (!payment.reference) return false
  try {
    const [order] = await db()
      .select({ paidAt: orders.paidAt, stripeSessionId: orders.stripeSessionId, paypalCaptureId: orders.paypalCaptureId })
      .from(orders)
      .where(eq(orders.orderNumber, payment.orderNumber))
      .limit(1)
    if (!order?.paidAt) return false
    const recorded = payment.provider === 'stripe' ? order.stripeSessionId : order.paypalCaptureId
    return recorded === payment.reference
  } catch (error) {
    console.error(`[notify] could not read ${payment.orderNumber}:`, String(error).slice(0, 200))
    return false
  }
}

function customField(session: Stripe.Checkout.Session, key: string): string | null {
  const field = session.custom_fields?.find((entry) => entry.key === key)
  return field?.dropdown?.value ?? field?.text?.value ?? null
}

/**
 * A Payment Link sale. It has no order row, so the session is the whole story;
 * the line items are passed in because a webhook event does not carry them.
 * The buyer and the delivery address stay in Stripe, one tap away.
 */
export function linkSaleMessage(session: Stripe.Checkout.Session, productNames: string[]): OwnerMessage {
  const address = session.customer_details?.address
  const destination = town({ postalCode: address?.postal_code, city: address?.city, country: address?.country })
  const fulfilment = customField(session, 'delivery')
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const dashboard = `https://dashboard.stripe.com${session.livemode === false ? '/test' : ''}/payments`
  return {
    ping: '💶 بيع جديد عبر رابط الدفع',
    pingLink: dashboard,
    title: `💶 بيع عبر رابط الدفع — ${money(session.amount_total ?? 0)}`,
    lines: [
      ...productNames.map((name) => `• ${name}`),
      '',
      ...(destination ? [`المدينة: ${destination}`] : []),
      ...(fulfilment === 'delivery'
        ? ['التسليم: توصيل — العنوان في Stripe']
        : fulfilment === 'pickup'
          ? ['التسليم: استلام من المحل']
          : []),
      `الوقت: ${parisTime(new Date(session.created * 1000))}`,
    ],
    link: intent ? `${dashboard}/${intent}` : dashboard,
  }
}
