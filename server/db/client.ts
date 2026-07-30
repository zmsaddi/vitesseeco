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
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import type { NeonQueryResultHKT } from 'drizzle-orm/neon-serverless'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { ExtractTablesWithRelations, SQL } from 'drizzle-orm'
import ws from 'ws'
import * as schema from './schema'

// Node has no global WebSocket before 22; supplying one keeps the pool driver
// working on every runtime we deploy to.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket
}

export type Schema = typeof schema
export type Transaction = PgTransaction<NeonQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

/**
 * Anything that can run a statement and hand back rows.
 *
 * Described structurally rather than derived from one driver, so a service can
 * take a handle without being welded to Neon. That matters for more than
 * tidiness: a service that reaches for a hardwired client cannot be exercised
 * against an ordinary Postgres, which is how a rate limiter ends up shipping
 * with no test that ever ran.
 */
export interface SqlExecutor {
  // Rows from raw SQL are untyped whichever driver runs them, so the shape is
  // asserted once in `queryRows` below rather than at every call site.
  execute: (query: SQL) => PromiseLike<{ rows: unknown[] }>
}

/**
 * Anything that can run work inside a transaction.
 *
 * Services take one of these rather than calling `withTransaction` directly,
 * for the same reason they take a `SqlExecutor`: a service that opens its own
 * connection to a hardwired URL cannot be pointed at a test database, and a
 * service that cannot be pointed at a test database is one whose tests never
 * ran. This project has now learned that three times — the rate limiter, the
 * stock reads, and the order service — so it is a type here, not a habit.
 */
export type TransactionRunner = <T>(work: (tx: Transaction) => Promise<T>) => Promise<T>

/**
 * Run a raw statement and read its rows under the shape the caller expects.
 *
 * The cast is real and deliberate: no driver can know what a hand-written
 * SELECT returns. Naming it here means there is one place to look when a query
 * and its type drift apart, instead of an `as` scattered through the services.
 */
export async function queryRows<T>(executor: SqlExecutor, query: SQL): Promise<T[]> {
  const result = await executor.execute(query)
  return result.rows as T[]
}

function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return url
}

/**
 * Is this URL a Neon endpoint at all?
 *
 * The Neon HTTP driver does not speak the Postgres wire protocol — it talks to
 * Neon's own proxy over HTTPS. Pointed at any ordinary Postgres (the embedded
 * dev database, a CI service container, a future self-hosted move) every query
 * fails with a connection error that says nothing about why. So the driver is
 * chosen by what the URL actually is, and plain Postgres gets the plain
 * node-postgres driver.
 */
function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host.endsWith('.neon.tech') || host.endsWith('.aws.neon.tech')
  } catch {
    return false
  }
}

let httpClient: ReturnType<typeof drizzleHttp<Schema>> | null = null
let nodeClient: ReturnType<typeof drizzleNodePg<Schema>> | null = null

/** Read path and single writes. Cannot open a transaction. */
export function db() {
  const url = connectionString()
  if (!isNeonUrl(url)) {
    if (!nodeClient) {
      nodeClient = drizzleNodePg(new pg.Pool({ connectionString: url, max: 5 }), { schema })
    }
    // The two drivers expose the same drizzle surface for everything this
    // codebase does; the union collapses at the call sites.
    return nodeClient as unknown as ReturnType<typeof drizzleHttp<Schema>>
  }
  if (!httpClient) {
    httpClient = drizzleHttp(neon(url), { schema })
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
  const url = connectionString()

  if (!isNeonUrl(url)) {
    const pool = new pg.Pool({ connectionString: url })
    try {
      const client = drizzleNodePg(pool, { schema })
      return await client.transaction(async (tx) => work(tx as unknown as Transaction))
    } finally {
      await pool.end().catch(() => {})
    }
  }

  const pool = new Pool({ connectionString: url })
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

