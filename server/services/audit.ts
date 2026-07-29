/**
 * The audit log.
 *
 * Append-only, and deliberately best-effort: failing to write a log line must
 * never fail the action it was describing. A customer whose order succeeded
 * should not see an error because a logging table was briefly unavailable.
 *
 * What goes in here is what someone would need to answer "why is this order in
 * this state?" six months from now — not analytics, and never a password, a
 * token or a full card number.
 */
import { auditLog } from '../db/schema'
import { db, type SqlExecutor } from '../db/client'

export interface AuditEntry {
  action: string
  actorType?: 'system' | 'customer' | 'admin'
  actorId?: string | null
  resourceType?: string | null
  resourceId?: string | null
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
  ipHash?: string | null
}

export async function audit(entry: AuditEntry, executor?: SqlExecutor): Promise<void> {
  try {
    const handle = (executor ?? db()) as ReturnType<typeof db>
    await handle.insert(auditLog).values({
      action: entry.action,
      actorType: entry.actorType ?? 'system',
      actorId: entry.actorId ?? null,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      metadata: entry.metadata ?? null,
      ipHash: entry.ipHash ?? null,
    })
  } catch (error) {
    console.error('[audit] failed to record', entry.action, error)
  }
}
