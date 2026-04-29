/**
 * Audit log helper — append-only record of state changes (P0-17, ADR-001).
 *
 * Recording rules:
 * - Use for actions that someone might need to investigate or reverse later:
 *   order created/failed, promo released, password reset, manual stock edit.
 * - DO NOT use for high-frequency telemetry (use events.ts for that).
 * - Failures here MUST NOT fail the parent request — log and continue.
 */

import { useDB } from '~/server/database/db'
import { auditLog } from '~/server/database/schema'

export type AuditActorType = 'system' | 'customer' | 'admin'

export interface AuditEntry {
  actorType?: AuditActorType
  actorId?: string | null
  action: string
  resourceType?: string
  resourceId?: string
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
}

/**
 * Best-effort write to audit_log. Never throws.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const db = useDB()
    await db.insert(auditLog).values({
      actorType: entry.actorType ?? 'system',
      actorId: entry.actorId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      before: (entry.before ?? null) as any,
      after: (entry.after ?? null) as any,
      metadata: (entry.metadata ?? null) as any,
    })
  } catch (err) {
    // Audit failure must not fail the parent request. Log loudly so it shows
    // up in Sentry once that is wired (P0-16).
    console.error('[AUDIT] failed to write entry', { action: entry.action, err })
  }
}
