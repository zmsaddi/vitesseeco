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
import { createSession, revokeSessionsFor } from '../../../security/session'
import { applyApiHeaders } from '../../../security/headers'
import { audit } from '../../../services/audit'
import { OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, localePrefixOf, safeNext } from './index.get'

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

  // Read and clear before the first exit, so an abandoned attempt cannot leave
  // a destination behind for the next one. Re-validated on the way out: the
  // cookie is ours and httpOnly, but a value is only ever as safe as its check.
  const next = safeNext(getCookie(event, OAUTH_NEXT_COOKIE))
  deleteCookie(event, OAUTH_NEXT_COOKIE, { path: '/' })

  // Google returns to a bare callback URL. The path the visitor was heading for
  // is the only thing that still remembers their language.
  const prefix = localePrefixOf(next)
  const fail = (reason: string) => sendRedirect(event, `${prefix}/connexion?error=${reason}`, 302)

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail('invalid_state')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const siteUrl = process.env.NUXT_PUBLIC_SITE_URL ?? 'https://vitesse-eco.fr'
  if (!clientId || !clientSecret) {
    return fail('oauth_unavailable')
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
      return fail('oauth_failed')
    }

    profile = (await $fetch<GoogleUserInfo>('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })) as GoogleUserInfo
  } catch (error) {
    console.error('[oauth] Google exchange failed', error)
    return fail('oauth_failed')
  }

  const email = profile.email?.trim().toLowerCase()
  const providerAccountId = profile.sub

  if (!email || !providerAccountId) {
    return fail('oauth_failed')
  }

  // The check the old build did not make.
  if (profile.email_verified !== true) {
    await audit({
      action: 'customer.oauth_unverified_email',
      resourceType: 'customer',
      metadata: { provider: 'google', email },
    })
    return fail('email_unverified')
  }

  // Set inside the transaction when an unverified record is taken back by the
  // owner who proved the address; audited afterwards, outside it.
  let reclaimedSessions = 0

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
      .select({ id: customers.id, emailVerifiedAt: customers.emailVerifiedAt })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1)

    if (existing) {
      await tx.insert(oauthIdentities).values({
        customerId: existing.id,
        provider: 'google',
        providerAccountId,
      })

      // Registration issues a live session against an address nobody checked,
      // so an unverified record is not evidence that its holder owns the
      // address — it is only evidence that someone typed it. Google has just
      // produced the first real proof, and it did not necessarily come from
      // whoever is holding that session.
      //
      // So the account goes to the party who proved it: mark it verified, drop
      // every session opened before the proof, and clear the password nobody
      // ever demonstrated ownership of. The legitimate owner keeps the account
      // and signs in with Google; anyone squatting the address loses both their
      // session and their way back in. Linking silently, as this did, handed a
      // squatter a permanent foothold in the real owner's account — and if the
      // address were on ADMIN_EMAILS, a foothold in the panel.
      if (existing.emailVerifiedAt === null) {
        await tx
          .update(customers)
          .set({ emailVerifiedAt: new Date(), passwordHash: null })
          .where(eq(customers.id, existing.id))
        reclaimedSessions = await revokeSessionsFor(tx, existing.id)
      }
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

  if (reclaimedSessions > 0) {
    // Worth a line of its own: somebody was signed out of an account they were
    // holding, and a password stopped working. If that was ever wrong, this is
    // the record that shows it happened and when.
    await audit({
      action: 'customer.oauth_reclaimed_unverified',
      actorType: 'customer',
      actorId: customerId,
      resourceType: 'customer',
      resourceId: customerId,
      metadata: { provider: 'google', sessionsRevoked: reclaimedSessions, passwordCleared: true },
    })
  }

  await audit({
    action: 'customer.login_oauth',
    actorType: 'customer',
    actorId: customerId,
    resourceType: 'customer',
    resourceId: customerId,
    metadata: { provider: 'google' },
  })

  return sendRedirect(event, next ?? `${prefix}/compte`, 302)
})

export { db }
