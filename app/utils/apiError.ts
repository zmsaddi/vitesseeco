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
export interface ApiErrorPayload {
  code?: string
  messageKey?: string
  details?: {
    issues?: Array<{ path: string; message: string }>
    status?: string
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
