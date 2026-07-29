/**
 * Database access.
 *
 * Neon offers two drivers and they are not interchangeable:
 *
 *  - HTTP  one round trip per statement, no connection to keep alive. Right for
 *          reads and single writes in a serverless function.
 *  - Pool  a real session over a websocket. The ONLY driver that can hold a
 *          transaction open, which means the only one that can take a row lock.
 *
 * Anything that must be all-or-nothing — placing an order, reserving stock,
 * redeeming a promotion — goes through `withTransaction`. Everything else uses
 * `db()` and stays cheap.
 */
import { neon, neonConfig, Pool } from '@neondatabase/serverless'
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless'
import type { NeonQueryResultHKT } from 'drizzle-orm/neon-serverless'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import ws from 'ws'
import * as schema from './schema'

// Node has no global WebSocket before 22; supplying one keeps the pool driver
// working on every runtime we deploy to.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket
}

export type Schema = typeof schema
export type Transaction = PgTransaction<NeonQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return url
}

let httpClient: ReturnType<typeof drizzleHttp<Schema>> | null = null

/** Read path and single writes. Cannot open a transaction. */
export function db() {
  if (!httpClient) {
    httpClient = drizzleHttp(neon(connectionString()), { schema })
  }
  return httpClient
}

/**
 * Run work inside a single transaction.
 *
 * A fresh pool per call, closed in `finally`: a module-scoped pool survives the
 * freeze between serverless invocations and hands out sockets the platform has
 * already torn down.
 */
export async function withTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: connectionString() })
  try {
    const client = drizzlePool(pool, { schema })
    return await client.transaction(async (tx) => work(tx as Transaction))
  } finally {
    await pool.end().catch(() => {
      // The request is already answered; a failure to return the socket is the
      // platform's problem, not the customer's.
    })
  }
}

/** Release cached handles. Tests call this so a suite does not hang on exit. */
export async function closeConnections(): Promise<void> {
  httpClient = null
}
