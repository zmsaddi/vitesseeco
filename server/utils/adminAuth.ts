/**
 * Admin authorization (EXPERIENCE_RECONSTRUCTION_PLAN §3.4).
 *
 * v1 mechanism: ADMIN_EMAILS env allowlist (comma-separated, case-insensitive)
 * checked against the authenticated session's customer email. Chosen over a
 * `role` column so the panel ships without a schema migration; migrate to a
 * column if the admin team grows beyond a handful of people.
 *
 * Every /api/admin/* endpoint MUST call requireAdmin() — the client-side
 * route middleware is UX only, never a security boundary.
 */

import type { H3Event } from 'h3'
import { and, eq, gt } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'

export interface AdminContext {
  customerId: string
  email: string
}

export function getAdminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export async function requireAdmin(event: H3Event): Promise<AdminContext> {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = useDBHttp()
  const [row] = await db
    .select({ customerId: sessions.customerId, email: customers.email })
    .from(sessions)
    .innerJoin(customers, eq(customers.id, sessions.customerId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!row) throw createError({ statusCode: 401, message: 'Session expired' })

  const allowlist = getAdminAllowlist()
  if (allowlist.length === 0 || !allowlist.includes(row.email.toLowerCase())) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return { customerId: row.customerId, email: row.email }
}
