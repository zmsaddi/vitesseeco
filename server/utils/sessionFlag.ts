/**
 * Companion flag for the httpOnly session cookie.
 *
 * `auth_token` is httpOnly, so the browser cannot tell a guest from a returning
 * customer without asking the server — and asking on every page load means a
 * 401 in every guest's console. This non-httpOnly flag carries no authority
 * whatsoever (the server never reads it for authentication); it exists purely
 * so the client knows whether a session is worth fetching.
 */
import type { H3Event } from 'h3'

export const SESSION_FLAG_COOKIE = 'has_session'

export function setSessionFlag(event: H3Event, maxAge: number) {
  setCookie(event, SESSION_FLAG_COOKIE, '1', {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge,
    path: '/',
  })
}

export function clearSessionFlag(event: H3Event) {
  deleteCookie(event, SESSION_FLAG_COOKIE, { path: '/' })
}
