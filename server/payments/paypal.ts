/**
 * PayPal — a TEMPORARY direct integration, not a fourth way of thinking.
 *
 * Stripe already carries PayPal as one of its dynamic payment methods; that is
 * the destination. This module exists only because Stripe's PayPal activation
 * is sitting in a review queue and the shop sold through its own PayPal account
 * for a year before the rebuild. The moment the Stripe Dashboard shows PayPal
 * active, this bridge is removed: delete this file, the two routes that import
 * it, the `paypal` entries in `index.ts`, the checkout branch, and the
 * PAYPAL_* environment variables. Nothing else references it.
 *
 * It is REST against api-m.paypal.com with no SDK: three endpoints (create,
 * read, capture an order) and the webhook verification call. A dependency for
 * that would outlive the bridge it serves.
 *
 * The method hides itself the way Stripe's card form does: no credentials, no
 * PayPal offered. Enabling it in production is setting the environment
 * variables the old build already had; disabling it is deleting them.
 */
import { AppError, ERROR_CODES } from '../../shared/errors'
import { toDecimalString, type Cents } from '../../shared/money'

const PAYPAL_API = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
} as const

/** Anything that is not exactly 'live' is sandbox — the safe misread. */
function baseUrl(): string {
  return (process.env.PAYPAL_MODE ?? '').trim().toLowerCase() === 'live'
    ? PAYPAL_API.live
    : PAYPAL_API.sandbox
}

/**
 * .trim() defends against the trailing whitespace the Vercel UI sometimes
 * appends to pasted secrets — it cost a deploy on the previous build.
 */
function credentials(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.PAYPAL_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET ?? '').trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

/** The switch the whole bridge hangs off: credentials present = offered. */
export function paypalConfigured(): boolean {
  return credentials() !== null
}

function requireCredentials(): { clientId: string; clientSecret: string } {
  const creds = credentials()
  if (!creds) {
    throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
      internal: 'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set',
    })
  }
  return creds
}

/**
 * OAuth tokens live ~9 hours; cached with a five-minute safety margin so a
 * token is not used at the edge of its life mid-request.
 */
let cachedToken: { value: string; expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value

  const { clientId, clientSecret } = requireCredentials()
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
      internal: `PayPal OAuth answered ${response.status}`,
    })
  }
  const data = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    value: data.access_token,
    expiresAt: now + Math.max(0, data.expires_in - 300) * 1000,
  }
  return data.access_token
}

async function api<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; requestId?: string }
): Promise<{ status: number; data: T }> {
  const token = await accessToken()
  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      // PayPal's own idempotency: a retried create with the same id returns
      // the same order instead of a second one.
      ...(init.requestId ? { 'PayPal-Request-Id': init.requestId } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(20_000),
  })
  const text = await response.text()
  let data: T
  try {
    data = (text ? JSON.parse(text) : {}) as T
  } catch {
    throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
      internal: `PayPal ${init.method} ${path} answered ${response.status} with a non-JSON body`,
    })
  }
  return { status: response.status, data }
}

export interface CreatePayPalOrderInput {
  orderNumber: string
  /** From the pricing service via the order row — never from a browser. */
  total: Cents
}

/**
 * Create a PayPal order for an already-placed local order.
 *
 * Only the total is sent, deliberately: PayPal validates an itemised breakdown
 * to the cent and rejects the whole order over a rounding disagreement it did
 * not cause. The authoritative breakdown lives on our order row; PayPal's job
 * here is to move one amount.
 *
 * invoice_id carries our order number so PayPal-side records reconcile to
 * ours, and so capture can verify the binding without trusting the browser.
 */
export async function createPayPalOrder(input: CreatePayPalOrderInput): Promise<{ paypalOrderId: string }> {
  const { status, data } = await api<{ id?: string }>(`/v2/checkout/orders`, {
    method: 'POST',
    requestId: `create:${input.orderNumber}`,
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.orderNumber,
          invoice_id: input.orderNumber,
          description: `Vitesse Eco ${input.orderNumber}`,
          amount: { currency_code: 'EUR', value: toDecimalString(input.total) },
        },
      ],
      application_context: {
        brand_name: 'Vitesse Eco',
        // The delivery address was collected and validated on our own form;
        // letting PayPal show a stored one would put two addresses on one sale.
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    },
  })
  if (status >= 400 || !data.id) {
    throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
      internal: `PayPal createOrder for ${input.orderNumber} answered ${status}`,
    })
  }
  return { paypalOrderId: data.id }
}

interface RawPayPalOrder {
  id?: string
  status?: string
  purchase_units?: Array<{
    invoice_id?: string
    amount?: { currency_code?: string; value?: string }
    payments?: { captures?: Array<{ id?: string; status?: string }> }
  }>
}

export interface PayPalOrderState {
  status: string
  invoiceId: string | null
  amountValue: string | null
  currency: string | null
  captureId: string | null
}

function toState(data: RawPayPalOrder): PayPalOrderState {
  const unit = data.purchase_units?.[0]
  return {
    status: data.status ?? 'UNKNOWN',
    invoiceId: unit?.invoice_id ?? null,
    amountValue: unit?.amount?.value ?? null,
    currency: unit?.amount?.currency_code ?? null,
    captureId: unit?.payments?.captures?.[0]?.id ?? null,
  }
}

export async function getPayPalOrder(paypalOrderId: string): Promise<PayPalOrderState> {
  const { status, data } = await api<RawPayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
    { method: 'GET' }
  )
  if (status >= 400) {
    throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
      internal: `PayPal getOrder ${paypalOrderId} answered ${status}`,
    })
  }
  return toState(data)
}

/**
 * Capture an approved order. The customer is charged here and only here.
 *
 * ORDER_ALREADY_CAPTURED is success wearing an error status: the money moved
 * on an earlier attempt (a double click, a webhook race), and the caller needs
 * the capture id, not an exception — so it is answered with a re-read.
 */
export async function capturePayPalOrder(paypalOrderId: string): Promise<PayPalOrderState> {
  const { status, data } = await api<RawPayPalOrder & { details?: Array<{ issue?: string }> }>(
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    { method: 'POST', requestId: `capture:${paypalOrderId}` }
  )
  if (status >= 400) {
    const issue = data.details?.[0]?.issue
    if (issue === 'ORDER_ALREADY_CAPTURED') return getPayPalOrder(paypalOrderId)
    throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, {
      internal: `PayPal capture ${paypalOrderId} answered ${status}${issue ? ` (${issue})` : ''}`,
    })
  }
  return toState(data)
}

/**
 * Verify a webhook by replaying it to PayPal's verification endpoint.
 *
 * True only when PayPal explicitly answers SUCCESS; every failure mode —
 * missing header, missing PAYPAL_WEBHOOK_ID, network error, any other
 * verification_status — is a rejection. A webhook is never accepted
 * optimistically.
 */
export async function verifyPayPalWebhook(
  headers: Record<string, string | undefined>,
  rawBody: string
): Promise<boolean> {
  const webhookId = (process.env.PAYPAL_WEBHOOK_ID ?? '').trim()
  if (!webhookId) {
    console.error('[paypal] PAYPAL_WEBHOOK_ID is not set — webhook rejected')
    return false
  }

  const transmissionId = headers['paypal-transmission-id']
  const transmissionTime = headers['paypal-transmission-time']
  const transmissionSig = headers['paypal-transmission-sig']
  const certUrl = headers['paypal-cert-url']
  const authAlgo = headers['paypal-auth-algo']
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) return false

  let event: unknown
  try {
    event = JSON.parse(rawBody)
  } catch {
    return false
  }

  try {
    const { status, data } = await api<{ verification_status?: string }>(
      `/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        body: {
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          transmission_sig: transmissionSig,
          cert_url: certUrl,
          auth_algo: authAlgo,
          webhook_id: webhookId,
          webhook_event: event,
        },
      }
    )
    return status < 400 && data.verification_status === 'SUCCESS'
  } catch (error) {
    console.error('[paypal] webhook verification errored', error)
    return false
  }
}

/**
 * The one webhook event that moves money for this flow. Everything else —
 * approvals, refund lifecycle, disputes — is acknowledged and left to the
 * capture endpoint and the admin. The capture endpoint is the primary paid
 * path; the webhook is the safety net for a tab closed between approval and
 * capture.
 */
export function paidOrderNumberFromWebhook(rawBody: string): string | null {
  let parsed: {
    event_type?: string
    resource?: { invoice_id?: string; purchase_units?: Array<{ invoice_id?: string }> }
  }
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return null
  }
  if (parsed.event_type !== 'PAYMENT.CAPTURE.COMPLETED' && parsed.event_type !== 'CHECKOUT.ORDER.COMPLETED') {
    return null
  }
  // The two event shapes put the invoice id in different places.
  return parsed.resource?.invoice_id ?? parsed.resource?.purchase_units?.[0]?.invoice_id ?? null
}
