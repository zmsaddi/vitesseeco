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
 * Written in Arabic: it is read by the owner, not by customers.
 */
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { db } from '../db/client'
import { orderItems, orders } from '../db/schema'
import { cents, format } from '../../shared/money'
import { ORGANISATION, SITE_URL } from '../../shared/organisation'

const TIMEOUT_MS = 4_000

export interface OwnerMessage {
  title: string
  lines: string[]
  /** Where the owner acts on it — the admin page for the order. */
  link: string
}

const PAYMENT_LABELS: Record<string, string> = {
  stripe: 'دفع إلكتروني (Stripe)',
  paypal: 'PayPal',
  cod: 'الدفع عند الاستلام',
  in_store: 'الدفع في المحل',
}

function money(amount: number): string {
  return format(cents(amount), 'fr-FR')
}

function parisTime(date: Date): string {
  // Pinned: the function runs in UTC, the owner reads Paris time.
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(date)
}

/** Telegram's HTML mode: only these three characters need escaping. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderTelegram(message: OwnerMessage): string {
  return [`<b>${escapeHtml(message.title)}</b>`, '', ...message.lines.map(escapeHtml), '', escapeHtml(message.link)].join('\n')
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
      customerSnapshot: orders.customerSnapshot,
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

  const customer = (order.customerSnapshot ?? {}) as { name?: string; email?: string | null; phone?: string }
  const address = order.shippingAddress as { line1?: string; postalCode?: string; city?: string; country?: string } | null

  return {
    title:
      event === 'paid'
        ? `💶 طلب مدفوع ${order.orderNumber} — ${money(order.totalCents)}`
        : `🛒 طلب جديد ${order.orderNumber} — ${money(order.totalCents)} (لم يُدفع بعد)`,
    lines: [
      ...items.map((item) => `• ${item.quantity} × ${item.name}${item.color ? ` (${item.color})` : ''}`),
      '',
      `الزبون: ${customer.name ?? '—'}`,
      `الهاتف: ${customer.phone ?? '—'}`,
      `البريد: ${customer.email ?? '—'}`,
      address?.city
        ? `العنوان: ${[address.line1, `${address.postalCode ?? ''} ${address.city}`.trim(), address.country].filter(Boolean).join('، ')}`
        : `التسليم: ${order.shippingMethodCode}`,
      `الدفع: ${PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}`,
      `الوقت: ${parisTime(order.createdAt)}`,
    ],
    link: `${SITE_URL}/admin/commandes/${order.orderNumber}`,
  }
}

/**
 * PayPal captured money on an order that had already closed — the sweep
 * cancelled it while the payer was approving. Not an order to fulfil and not a
 * failure to ignore: a person must refund it or honour it, today.
 */
export function closedOrderPaymentMessage(orderNumber: string, captureId: string | null, status: string): OwnerMessage {
  return {
    title: `⚠️ دفعة PayPal على طلب مغلق ${orderNumber}`,
    lines: [
      `استلم PayPal المال لكن الطلب كان ${status === 'cancelled' ? 'ملغى' : status} عند وصول الدفعة.`,
      'المطلوب: إما استرداد المبلغ من PayPal، أو تنفيذ الطلب يدويًا.',
      `رقم عملية PayPal: ${captureId ?? '—'}`,
    ],
    link: `${SITE_URL}/admin/commandes/${orderNumber}`,
  }
}

function customField(session: Stripe.Checkout.Session, key: string): string | null {
  const field = session.custom_fields?.find((entry) => entry.key === key)
  return field?.dropdown?.value ?? field?.text?.value ?? null
}

/**
 * A Payment Link sale. It has no order row, so the session is the whole story;
 * the line items are passed in because a webhook event does not carry them.
 */
export function linkSaleMessage(session: Stripe.Checkout.Session, productNames: string[]): OwnerMessage {
  const details = session.customer_details
  const address = details?.address
  const fulfilment = customField(session, 'delivery')
  const deliveryAddress = customField(session, 'address')
  return {
    title: `💶 بيع عبر رابط الدفع — ${money(session.amount_total ?? 0)}`,
    lines: [
      ...productNames.map((name) => `• ${name}`),
      '',
      `الزبون: ${details?.individual_name ?? details?.name ?? '—'}`,
      `الهاتف: ${details?.phone ?? '—'}`,
      `البريد: ${details?.email ?? '—'}`,
      ...(address?.city ? [`عنوان الفوترة: ${[address.line1, `${address.postal_code ?? ''} ${address.city}`.trim(), address.country].filter(Boolean).join('، ')}`] : []),
      ...(fulfilment === 'delivery'
        ? [`التسليم: توصيل${deliveryAddress ? ` إلى ${deliveryAddress}` : ''}`]
        : fulfilment === 'pickup'
          ? ['التسليم: استلام من المحل']
          : []),
      `الوقت: ${parisTime(new Date(session.created * 1000))}`,
    ],
    link: 'https://dashboard.stripe.com/payments',
  }
}
