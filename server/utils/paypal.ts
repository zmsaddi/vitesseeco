/**
 * PayPal client + helpers.
 *
 * Centralises SDK setup so adapters/endpoints don't duplicate config and so
 * sandbox vs live is decided in exactly one place (PAYPAL_MODE).
 *
 * Webhook signature verification is done via PayPal's REST endpoint directly
 * — the SDK does not expose a typed wrapper for it.
 */
import { Client, Environment, OrdersController, LogLevel } from '@paypal/paypal-server-sdk'

const PAYPAL_API = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
} as const

type PayPalMode = keyof typeof PAYPAL_API

function readMode(): PayPalMode {
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase()
  return mode === 'live' ? 'live' : 'sandbox'
}

function readCreds(): { clientId: string; clientSecret: string } {
  // .trim() defends against trailing whitespace/newlines that the Vercel UI
  // sometimes appends when secrets are pasted in.
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim()
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim()
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials missing — set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET')
  }
  return { clientId, clientSecret }
}

let _client: Client | null = null

export function getPayPalClient(): Client {
  if (_client) return _client
  const { clientId, clientSecret } = readCreds()
  const env = readMode() === 'live' ? Environment.Production : Environment.Sandbox
  _client = new Client({
    clientCredentialsAuthCredentials: { oAuthClientId: clientId, oAuthClientSecret: clientSecret },
    environment: env,
    logging: {
      logLevel: LogLevel.Error,
      logRequest: { logBody: false },
      logResponse: { logHeaders: false, logBody: false },
    },
  })
  return _client
}

export function getOrdersController(): OrdersController {
  return new OrdersController(getPayPalClient())
}

export function getPayPalBaseUrl(): string {
  return PAYPAL_API[readMode()]
}

/**
 * Get a raw OAuth access token. Used for endpoints not wrapped by the SDK
 * (notifications/verify-webhook-signature). Tokens are short-lived (~9h) but
 * we don't cache here — webhooks are rare enough that the token call is cheap.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = readCreds()
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    throw new Error(`PayPal OAuth failed: ${res.status}`)
  }
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export interface WebhookVerifyInput {
  headers: Record<string, string | undefined>
  rawBody: string
}

/**
 * Verifies a PayPal webhook by replaying the payload to PayPal's
 * `notifications/verify-webhook-signature` endpoint. Returns true only when
 * PayPal explicitly confirms `verification_status === "SUCCESS"`. Any error
 * is treated as failure — never optimistically accept.
 */
export async function verifyPayPalWebhook({ headers, rawBody }: WebhookVerifyInput): Promise<boolean> {
  const webhookId = (process.env.PAYPAL_WEBHOOK_ID || '').trim()
  if (!webhookId) {
    console.error('[PAYPAL] PAYPAL_WEBHOOK_ID missing — rejecting webhook')
    return false
  }

  // PayPal sends these headers; names are case-insensitive but lowercase in H3.
  const transmissionId = headers['paypal-transmission-id']
  const transmissionTime = headers['paypal-transmission-time']
  const transmissionSig = headers['paypal-transmission-sig']
  const certUrl = headers['paypal-cert-url']
  const authAlgo = headers['paypal-auth-algo']

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    console.error('[PAYPAL] webhook missing required headers')
    return false
  }

  let webhookEvent: unknown
  try {
    webhookEvent = JSON.parse(rawBody)
  } catch {
    return false
  }

  let token: string
  try {
    token = await getPayPalAccessToken()
  } catch (err) {
    console.error('[PAYPAL] could not fetch OAuth token for webhook verify:', err)
    return false
  }

  const res = await fetch(`${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      transmission_sig: transmissionSig,
      cert_url: certUrl,
      auth_algo: authAlgo,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  })

  if (!res.ok) {
    console.error(`[PAYPAL] verify-webhook-signature returned ${res.status}`)
    return false
  }
  const data = (await res.json()) as { verification_status?: string }
  return data.verification_status === 'SUCCESS'
}

export function isPayPalEnabled(): boolean {
  return process.env.ENABLE_PAYPAL === 'true'
}
