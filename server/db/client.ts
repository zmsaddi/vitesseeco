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
import { neon, neonConfig, Pool, type PoolClient as NeonPoolClient } from '@neondatabase/serverless'
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

/**
 * A connection the database could not even describe.
 *
 * When the WebSocket under the Neon pool dies before a session exists, the
 * rejection is a bare socket event whose message is the empty string. Logged,
 * it says nothing; classified, it reads as a bug (500) rather than an outage
 * (503). It is wrapped here so it carries a name the request handler knows.
 */
export class DatabaseConnectionError extends Error {
  override name = 'DatabaseConnectionError'
}

/**
 * Give a pool, and every client it hands out, somewhere to put an error.
 *
 * Without this, a connection that drops while a client holds it — Neon's
 * compute suspending, or its quota wall — emits 'error' with no listener, and
 * in Node that is an uncaught exception: the function dies before it answers,
 * Vercel reports a 504 timeout, and the real cause never reaches a log. That is
 * how the 2026-08-29 quota outage hid for hours. The query that was running
 * still rejects on its own, so the request fails properly; this only stops the
 * same failure from also killing the process.
 */
function listenForErrors<P extends pg.Pool | Pool>(pool: P): P {
  // Both drivers' pools and clients are EventEmitters; their typings disagree
  // on the overloads, not on that.
  const report = (error: Error) => console.error('[db] connection error:', error?.message || String(error))
  const emitter = pool as unknown as NodeJS.EventEmitter
  emitter.on('error', report)
  emitter.on('connect', (client: NodeJS.EventEmitter) => client.on('error', report))
  return pool
}

let httpClient: ReturnType<typeof drizzleHttp<Schema>> | null = null
let nodeClient: ReturnType<typeof drizzleNodePg<Schema>> | null = null

/** Read path and single writes. Cannot open a transaction. */
export function db() {
  const url = connectionString()
  if (!isNeonUrl(url)) {
    if (!nodeClient) {
      nodeClient = drizzleNodePg(listenForErrors(new pg.Pool({ connectionString: url, max: 5 })), { schema })
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
 *
 * The client is checked out HERE and handed to drizzle, rather than letting
 * drizzle check it out of the pool. When BEGIN itself fails — the connection
 * dropping as the transaction opens — drizzle rejects without ever releasing
 * the client it took, and `pool.end()` then waits for it forever: the request
 * never answers, and Vercel reports a 504 that says nothing about the
 * database. Owning the client means it is always released, as broken, whatever
 * happened, so the pool can always end.
 */
export async function withTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  const url = connectionString()

  if (!isNeonUrl(url)) {
    const pool = listenForErrors(new pg.Pool({ connectionString: url }))
    let session: pg.PoolClient | undefined
    try {
      session = await pool.connect()
      const client = drizzleNodePg(session, { schema })
      return await client.transaction(async (tx) => work(tx as unknown as Transaction))
    } finally {
      session?.release(true)
      await pool.end().catch(() => {})
    }
  }

  const pool = listenForErrors(new Pool({ connectionString: url }))
  let session: NeonPoolClient | undefined
  try {
    session = await pool.connect()
    const client = drizzlePool(session, { schema })
    return await client.transaction(async (tx) => work(tx as Transaction))
  } catch (error) {
    if (error instanceof Error && error.message) throw error
    throw new DatabaseConnectionError('the database connection failed before a session opened', { cause: error })
  } finally {
    // Released as broken: the pool is discarded below either way, and a socket
    // returned "healthy" after an error would only be closed a moment later.
    session?.release(true)
    await pool.end().catch(() => {
      // The request is already answered; a failure to return the socket is the
      // platform's problem, not the customer's.
    })
  }
}

