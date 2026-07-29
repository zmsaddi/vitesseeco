/**
 * Begin the Google sign-in flow.
 *
 * The `state` value is random, stored in an httpOnly cookie, and compared on
 * the way back. Without it, an attacker can complete their own Google flow and
 * have the callback fired in a victim's browser, binding the victim's session
 * to the attacker's account.
 */
import { sendRedirect, setCookie } from 'h3'
import { defineEventHandler } from 'h3'
import { randomToken } from '../../../security/crypto'
import { applyApiHeaders } from '../../../security/headers'

export const OAUTH_STATE_COOKIE = 'vs_oauth_state'

export default defineEventHandler(async (event) => {
  applyApiHeaders(event)

  const clientId = process.env.GOOGLE_CLIENT_ID
  const siteUrl = process.env.NUXT_PUBLIC_SITE_URL ?? 'https://vitesse-eco.fr'
  if (!clientId) {
    return sendRedirect(event, '/connexion?error=oauth_unavailable', 302)
  }

  const state = randomToken(24)
  setCookie(event, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${siteUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Ask for a fresh consent rather than silently reusing a stale grant.
    prompt: 'select_account',
  })

  return sendRedirect(event, `https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
})
