/**
 * Sessions.
 *
 * The browser holds an opaque random token in an httpOnly cookie. The database
 * holds only its SHA-256. Nothing else identifies a customer — there is no
 * signed blob carrying a user id, so a session cannot be forged by anyone who
 * learns a signing key, and revocation is a DELETE rather than a wait.
 *
 * A second, deliberately non-authoritative cookie tells the client-side app
 * that a session probably exists. The server never reads it for authentication;
 * it exists so a guest page load does not spend a request discovering it is a
 * guest.
 */
import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm'
import { deleteCookie, getCookie, getRequestHeader, setCookie, type H3Event } from 'h3'
import { customers, sessions } from '../db/schema'
import { db, queryRows } from '../db/client'
import type { SqlExecutor, Transaction } from '../db/client'
import { createSessionToken, hashIp, hashToken } from './crypto'
import { AppError, ERROR_CODES } from '../../shared/errors'
import { clientIp } from './request'

export const SESSION_COOKIE = 'vs_session'
export const SESSION_HINT_COOKIE = 'vs_has_session'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Re-issue the cookie when a session is more than this old, so an active
 * customer stays signed in without any session living forever.
 */
const SLIDING_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000

export interface AuthenticatedCustomer {
  id: string
  email: string
  firstName: string
  lastName: string
  locale: string
  sessionId: string
  /**
   * Whether anyone has ever proved they can read this address.
   *
   * Registration hands out a session against an address nobody checked, so this
   * is false for every password account: there is no verification mail on this
   * branch to make it true. Only a Google sign-in sets it. Admin access reads
   * it, because an allowlist compared against an unproven address is an
   * allowlist anyone can join.
   */
  emailVerified: boolean
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

/**
 * Start a session and set both cookies.
 * Takes a transaction so signing in can be part of registering.
 */
export async function createSession(
  event: H3Event,
  tx: Transaction | ReturnType<typeof db>,
  customerId: string
): Promise<void> {
  const { token, tokenHash } = createSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await tx.insert(sessions).values({
    customerId,
    tokenHash,
    expiresAt,
    userAgent: (getRequestHeader(event, 'user-agent') ?? '').slice(0, 400) || null,
    ipHash: hashIp(clientIp(event)),
  })

  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  setCookie(event, SESSION_COOKIE, token, cookieOptions(maxAge))
  // Readable by the browser on purpose. It carries no authority: it says only
  // "a session may exist", and the server never consults it.
  setCookie(event, SESSION_HINT_COOKIE, '1', { ...cookieOptions(maxAge), httpOnly: false })
}

/**
 * Resolve the current customer, or null for a guest.
 *
 * A single joined query does the lookup and the ownership check together, so
 * there is no window between "this token is valid" and "this is whose it is".
 */
export async function resolveSession(event: H3Event): Promise<AuthenticatedCustomer | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const [row] = await db()
    .select({
      sessionId: sessions.id,
      createdAt: sessions.createdAt,
      id: customers.id,
      email: customers.email,
      firstName: customers.firstName,
      lastName: customers.lastName,
      locale: customers.locale,
      emailVerifiedAt: customers.emailVerifiedAt,
    })
    .from(sessions)
    .innerJoin(customers, eq(customers.id, sessions.customerId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!row) {
    // Either forged, revoked or expired. Clear both cookies so the browser
    // stops sending a token that will never work again.
    clearSessionCookies(event)
    return null
  }

  await touchSession(row.sessionId, row.createdAt, event)

  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    locale: row.locale,
    sessionId: row.sessionId,
    emailVerified: row.emailVerifiedAt !== null,
  }
}

/** Same as `resolveSession`, but the route requires a customer. */
export async function requireCustomer(event: H3Event): Promise<AuthenticatedCustomer> {
  const customer = await resolveSession(event)
  if (!customer) throw new AppError(ERROR_CODES.NOT_AUTHENTICATED)
  return customer
}

async function touchSession(sessionId: string, createdAt: Date, event: H3Event): Promise<void> {
  const age = Date.now() - createdAt.getTime()
  await db().update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, sessionId))

  // Slide the expiry for an active customer, without extending it on every
  // single request.
  if (age > SLIDING_REFRESH_AFTER_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await db().update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId))
    const token = getCookie(event, SESSION_COOKIE)
    if (token) {
      const maxAge = Math.floor(SESSION_TTL_MS / 1000)
      setCookie(event, SESSION_COOKIE, token, cookieOptions(maxAge))
      setCookie(event, SESSION_HINT_COOKIE, '1', { ...cookieOptions(maxAge), httpOnly: false })
    }
  }
}

/** Sign out of this browser. */
export async function destroySession(event: H3Event): Promise<void> {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    await db().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
  }
  clearSessionCookies(event)
}


/**
 * Sign out of every browser this account is open in.
 *
 * Used when who owns an account changes hands — an identity linked, a password
 * cleared. Anyone can register an address they cannot read and hold a live
 * session against it, so when the real owner finally proves the address, that
 * earlier session has to stop being a way in. Takes a transaction so the
 * revocation commits with the change that caused it, never separately.
 */
export async function revokeSessionsFor(tx: Transaction, customerId: string): Promise<number> {
  const removed = await tx
    .delete(sessions)
    .where(eq(sessions.customerId, customerId))
    .returning({ id: sessions.id })
  return removed.length
}

export function clearSessionCookies(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  deleteCookie(event, SESSION_HINT_COOKIE, { path: '/' })
}

/**
 * Housekeeping: expired rows serve no purpose and keep the index fat.
 *
 * Two things were wrong before. It was never CALLED — the function existed, was
 * exported, was named in the scheduled sweep's own description, and nothing
 * invoked it, so the table grew for the lifetime of the shop. And its `limit`
 * was decorative: the delete was unbounded and the count returned was
 * `min(deleted, limit)`, a smaller number than it had actually removed.
 *
 * It takes an executor for the same reason every other service function here
 * does: one that reaches for its own connection cannot be driven by a test, and
 * cannot take part in a transaction.
 */
export async function pruneExpiredSessions(
  executor: SqlExecutor = db(),
  limit = 1000
): Promise<number> {
  const rows = await queryRows<{ id: string }>(
    executor,
    sql`
      DELETE FROM sessions
       WHERE ctid IN (
         SELECT ctid FROM sessions WHERE expires_at < NOW() LIMIT ${limit}
       )
      RETURNING id
    `
  )
  return rows.length
}
