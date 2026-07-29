/**
 * Complete the Google sign-in flow.
 *
 * Three checks decide whether this is safe, and the previous build was missing
 * the third:
 *
 *  1. `state` matches the cookie — otherwise the callback was not started by
 *     this browser.
 *  2. The authorisation code is exchanged server-side, so the token never
 *     touches the page.
 *  3. `email_verified` is TRUE. Without this, anyone who can obtain a Google
 *     token for an unverified address matching a customer's email takes over
 *     that account — the identity provider is only an identity provider for
 *     addresses it has actually confirmed.
 */
import { deleteCookie, defineEventHandler, getCookie, getQuery, sendRedirect } from 'h3'
import { and, eq } from 'drizzle-orm'
import { db, withTransaction } from '../../../db/client'
import { customers, oauthIdentities } from '../../../db/schema'
import { createSession } from '../../../security/session'
import { applyApiHeaders } from '../../../security/headers'
import { audit } from '../../../services/audit'
import { OAUTH_STATE_COOKIE } from './index.get'

interface GoogleTokenResponse {
  access_token?: string
  error?: string
}

interface GoogleUserInfo {
  sub?: string
  email?: string
  email_verified?: boolean
  given_name?: string
  family_name?: string
}

export default defineEventHandler(async (event) => {
  applyApiHeaders(event)

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : null
  const state = typeof query.state === 'string' ? query.state : null
  const expectedState = getCookie(event, OAUTH_STATE_COOKIE)
  deleteCookie(event, OAUTH_STATE_COOKIE, { path: '/' })

  if (!code || !state || !expectedState || state !== expectedState) {
    return sendRedirect(event, '/connexion?error=invalid_state', 302)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const siteUrl = process.env.NUXT_PUBLIC_SITE_URL ?? 'https://vitesse-eco.fr'
  if (!clientId || !clientSecret) {
    return sendRedirect(event, '/connexion?error=oauth_unavailable', 302)
  }

  let profile: GoogleUserInfo
  try {
    const tokenResponse = (await $fetch<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${siteUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })) as GoogleTokenResponse

    if (!tokenResponse.access_token) {
      return sendRedirect(event, '/connexion?error=oauth_failed', 302)
    }

    profile = (await $fetch<GoogleUserInfo>('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })) as GoogleUserInfo
  } catch (error) {
    console.error('[oauth] Google exchange failed', error)
    return sendRedirect(event, '/connexion?error=oauth_failed', 302)
  }

  const email = profile.email?.trim().toLowerCase()
  const providerAccountId = profile.sub

  if (!email || !providerAccountId) {
    return sendRedirect(event, '/connexion?error=oauth_failed', 302)
  }

  // The check the old build did not make.
  if (profile.email_verified !== true) {
    await audit({
      action: 'customer.oauth_unverified_email',
      resourceType: 'customer',
      metadata: { provider: 'google', email },
    })
    return sendRedirect(event, '/connexion?error=email_unverified', 302)
  }

  const customerId = await withTransaction(async (tx) => {
    // An identity we already know: sign that customer in, whatever the email
    // says now. The provider account id is the stable link, not the address.
    const [identity] = await tx
      .select({ customerId: oauthIdentities.customerId })
      .from(oauthIdentities)
      .where(
        and(eq(oauthIdentities.provider, 'google'), eq(oauthIdentities.providerAccountId, providerAccountId))
      )
      .limit(1)

    if (identity) return identity.customerId

    // A verified address that already has an account: link them.
    const [existing] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1)

    if (existing) {
      await tx.insert(oauthIdentities).values({
        customerId: existing.id,
        provider: 'google',
        providerAccountId,
      })
      return existing.id
    }

    // New customer. No password hash — this account signs in through Google
    // until its owner sets one.
    const [created] = await tx
      .insert(customers)
      .values({
        email,
        passwordHash: null,
        firstName: profile.given_name?.trim() || 'Client',
        lastName: profile.family_name?.trim() || '—',
        emailVerifiedAt: new Date(),
      })
      .returning({ id: customers.id })

    if (!created) throw new Error('customer insert returned no row')

    await tx.insert(oauthIdentities).values({
      customerId: created.id,
      provider: 'google',
      providerAccountId,
    })
    return created.id
  })

  await withTransaction(async (tx) => {
    await createSession(event, tx, customerId)
  })

  await audit({
    action: 'customer.login_oauth',
    actorType: 'customer',
    actorId: customerId,
    resourceType: 'customer',
    resourceId: customerId,
    metadata: { provider: 'google' },
  })

  return sendRedirect(event, '/compte', 302)
})

export { db }
