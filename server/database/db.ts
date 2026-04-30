/**
 * Drizzle DB client backed by `@neondatabase/serverless` Pool.
 *
 * We switched away from `drizzle-orm/neon-http` (HTTP-per-query, no transaction
 * support) because the PG-primary order path needs `db.transaction(async tx =>
 * ...)` for atomic stock-lock + insert + outbox-enqueue (see ADR-001 / P0-11
 * and server/utils/orderService.ts).
 *
 * Pool uses Neon's WebSocket protocol — supported natively on Node >=22 (no
 * `ws` shim required) and on Vercel's serverless runtime.
 *
 * The Drizzle query API is identical across drivers, so all 19+ existing
 * call sites of useDB() keep working unchanged.
 */
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

let _pool: Pool | null = null
let _db: ReturnType<typeof drizzle> | null = null

export function useDB() {
  if (!_db) {
    const url = process.env.DATABASE_URL || useRuntimeConfig().databaseUrl
    if (!url) throw new Error('DATABASE_URL not set')
    _pool = new Pool({ connectionString: url })
    _db = drizzle(_pool, { schema })
  }
  return _db
}
