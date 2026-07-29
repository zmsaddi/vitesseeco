/**
 * CAPTCHA verification.
 *
 * Cloudflare Turnstile, checked on the server before any expensive work runs.
 * The widget on the page is not the control — the server call is. The previous
 * build rendered the widget on login and registration and never verified the
 * token anywhere, so credential stuffing and mass account creation were
 * unthrottled while the page implied otherwise.
 *
 * Tokens are single-use at Cloudflare. A rejected attempt therefore needs a
 * fresh one, which is why every caller is expected to reset its widget.
 */
import { AppError, ERROR_CODES } from '../../shared/errors'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

/**
 * Verify a token, or throw.
 *
 * When no secret is configured the check is REFUSED rather than skipped. A
 * missing environment variable must not quietly disable a control — that turns
 * a deployment mistake into an open door.
 */
export async function verifyCaptcha(token: string, remoteIp?: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
      internal: 'TURNSTILE_SECRET_KEY is not set; refusing to accept unverified submissions',
    })
  }

  if (!token) throw new AppError(ERROR_CODES.CAPTCHA_REQUIRED)

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  let result: TurnstileResponse
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      // Cloudflare being slow must not hold a request open indefinitely.
      signal: AbortSignal.timeout(8000),
    })
    result = (await response.json()) as TurnstileResponse
  } catch (error) {
    // Fail CLOSED. An outage at the verifier is not a reason to accept
    // unverified traffic on the endpoints this protects.
    throw new AppError(ERROR_CODES.CAPTCHA_FAILED, {
      internal: `Turnstile unreachable: ${error instanceof Error ? error.message : String(error)}`,
      cause: error,
    })
  }

  if (!result.success) {
    throw new AppError(ERROR_CODES.CAPTCHA_FAILED, {
      internal: `Turnstile rejected the token: ${(result['error-codes'] ?? []).join(', ')}`,
    })
  }
}
