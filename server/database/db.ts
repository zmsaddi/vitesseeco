/**
 * Two Drizzle clients, picked per call-site need.
 *
 * - `useDB()`        → Pool / WebSocket / `drizzle-orm/neon-serverless`.
 *                      Required by code that calls `db.transaction(async tx
 *                      => ...)` (only orderService.persistOrderPGPrimary
 *                      today). WebSocket handshake on a cold isolate can take
 *                      30+ seconds when Neon's free-tier compute auto-suspended.
 *
 * - `useDBHttp()`    → HTTP-per-query / `drizzle-orm/neon-http`.
 *                      No transaction support, but no WebSocket cold-start
 *                      either: each query is one HTTP roundtrip (~50 ms warm,
 *                      ~1-2 s on first query post-suspend). Use for every
 *                      call-site that doesn't need callback-style transactions
 *                      — auth, addresses, my-orders, audit, events, outbox
 *                      drainer, sanity sync. Crucially, the cron route
 *                      `/api/cron/process-outbox` uses this so it stays under
 *                      cron-job.org's 30 s free-tier hard timeout.
 *
 * Drizzle's query API surface (.select / .insert / .update / .delete) is
 * identical across drivers, so the only file-level change at call-sites is
 * the import.
 */
import { Pool, neon } from '@neondatabase/serverless'
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless'
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let _pool: Pool | null = null
let _dbPool: ReturnType<typeof drizzlePool> | null = null
let _dbHttp: ReturnType<typeof drizzleHttp> | null = null

function getUrl(): string {
  const url = process.env.DATABASE_URL || useRuntimeConfig().databaseUrl
  if (!url) throw new Error('DATABASE_URL not set')
  return url
}

export function useDB() {
  if (!_dbPool) {
    _pool = new Pool({ connectionString: getUrl() })
    _dbPool = drizzlePool(_pool, { schema })
  }
  return _dbPool
}

export function useDBHttp() {
  if (!_dbHttp) {
    const sql = neon(getUrl())
    _dbHttp = drizzleHttp(sql, { schema })
  }
  return _dbHttp
}
