/**
 * What an API error says, read from where it actually is.
 *
 * Every route answers an error as `AppError.toPublic()` — code, messageKey,
 * details — but h3's createError puts that object under the response body's
 * `data`, so a $fetch error carries it at `err.data.data`. Twelve call sites
 * read `err.data.messageKey`, found nothing, and showed every customer "an
 * error on our side": a wrong password, an empty basket and a sold-out bike all
 * read as the shop being broken. One reader, so that cannot drift again.
 *
 * An error that never reached a route — the network, a platform 502 page — has
 * no payload, and reads as empty.
 */
import { DEFAULT_LOCALE, getLocale, isLocaleCode } from '../../shared/locales'

export interface ApiErrorPayload {
  code?: string
  messageKey?: string
  details?: {
    issues?: Array<{ path: string; message: string }>
    status?: string
    retryAfterSeconds?: number
    [key: string]: unknown
  }
}

export function apiError(err: unknown): ApiErrorPayload {
  const body = (err as { data?: unknown } | null)?.data as Record<string, unknown> | undefined
  if (!body || typeof body !== 'object') return {}
  const candidate = (typeof body.data === 'object' && body.data !== null ? body.data : body) as ApiErrorPayload
  return typeof candidate.messageKey === 'string' ? candidate : {}
}

/** vue-i18n's `t`, as much of it as these readers use. */
export type Translate = (key: string, named?: Record<string, unknown>) => string

/**
 * One field issue, in the visitor's language.
 *
 * The server sends an i18n key for every issue (formatIssues in
 * server/security/handler.ts). Anything else is never printed as it came: the
 * pages used to, and what came was zod's English — under a field on the Arabic
 * site, with the server's regex quoted in it.
 */
export function issueText(message: string, t: Translate): string {
  return t(message.startsWith('errors.') ? message : 'errors.field_invalid')
}

/**
 * The sentence for a failed request, for a page with one place to say it.
 *
 * The payload carries more than its code's generic key, and each extra is the
 * difference between a message the customer can act on and one they cannot:
 *
 *  - A validation failure names its fields. "Ce numéro de téléphone n'est pas
 *    valide." is said instead of "Certaines informations sont incorrectes.",
 *    which left a customer at checkout guessing among eight inputs — and left
 *    the stock page unable to say that a new price had reached the
 *    struck-through one.
 *  - A rate limit says how long it lasts. "Réessayez dans un instant" was
 *    shown in front of blocks of up to an hour, and every retry inside one
 *    was refused again.
 *
 * A form that shows issues beside their fields reads them itself, and calls
 * this for what no field can carry.
 */
export function apiErrorMessage(err: unknown, t: Translate, locale: string): string {
  const payload = apiError(err)
  const issues = [...new Set((payload.details?.issues ?? []).map((issue) => issueText(issue.message, t)))]
  if (issues.length > 0) return issues.join(' · ')

  const seconds = Number(payload.details?.retryAfterSeconds)
  if (payload.code === 'RATE_LIMITED' && Number.isFinite(seconds) && seconds > 0) {
    return t('errors.rate_limited_for', { wait: minutes(seconds, locale) })
  }
  return t(payload.messageKey ?? 'errors.internal')
}

/**
 * "15 minutes", "15 Minuten", "15 دقيقة" — Intl carries each language's plural
 * rules, which a locale file cannot: vue-i18n's plural separator is banned
 * there (check:langs).
 */
function minutes(seconds: number, locale: string): string {
  const { formatLocale } = getLocale(isLocaleCode(locale) ? locale : DEFAULT_LOCALE)
  return new Intl.NumberFormat(formatLocale, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(
    Math.max(1, Math.ceil(seconds / 60))
  )
}
