/**
 * A real database for machines that have none — TEMPLATE.
 *
 * The rig needs an ACTUAL instance of the production engine. A substitute with
 * different semantics (SQLite standing in for PostgreSQL, an in-memory fake
 * standing in for Redis) cannot reproduce the concurrency, locking, dialect or
 * driver behaviour where the real defects live. And not every machine has Docker.
 *
 *   node dev-infra.mjs           # boots on 5544, applies migrations, prints URL
 *
 * Data lives under .devdb/ (gitignore it) and survives restarts; delete the
 * directory for a clean slate. Never point production at this.
 *
 * Requires: npm i -D embedded-postgres pg
 *
 * ── The rule this exists to enforce ──────────────────────────────────────
 * Whatever you boot here, the application must reach it through its PRODUCTION
 * accessor. A test harness that opens its own connection leaves the production
 * connection path completely untested — which is how a driver that could only
 * speak to one vendor's proxy passed eighty "real database" integration tests.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import pg from 'pg'

const PORT = Number(process.env.DEV_DB_PORT ?? 5544)
const DATA_DIR = join(process.cwd(), '.devdb')
const MIGRATIONS_DIR = join(process.cwd(), process.env.MIGRATIONS_DIR ?? 'migrations')
const DB_NAME = 'app_dev'
const USER = 'app'
const PASSWORD = 'app'

/** Splitter for your migration tool's statement delimiter. Drizzle uses the
 *  breakpoint comment; plain files split on `;` — adjust to match yours. */
const splitStatements = (sql) =>
  sql.includes('--> statement-breakpoint') ? sql.split('--> statement-breakpoint') : [sql]

const fresh = !existsSync(DATA_DIR)
if (fresh) mkdirSync(DATA_DIR, { recursive: true })

const server = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
})

if (fresh) await server.initialise()
await server.start()
if (fresh) await server.createDatabase(DB_NAME)

const url = `postgres://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}`

const files = existsSync(MIGRATIONS_DIR)
  ? readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort()
  : []

const client = new pg.Client({ connectionString: url })
await client.connect()
for (const file of files) {
  for (const statement of splitStatements(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))) {
    const sql = statement.trim()
    if (!sql) continue
    try {
      await client.query(sql)
    } catch (error) {
      // A fresh cluster must apply everything cleanly. On an existing one,
      // already-present objects are tolerated so a restart stays cheap.
      if (!fresh && /already exists/i.test(error.message)) continue
      throw error
    }
  }
}
await client.end()

console.log(`\n✅ dev database ready (${files.length} migration file(s) applied)`)
console.log(`   DATABASE_URL=${url}`)
console.log(`   Ctrl+C stops it; .devdb/ keeps the data\n`)

const stop = async () => {
  await server.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30) // keep alive

/*
 * ── Driver selection, the lesson that made this file necessary ────────────
 *
 * If your production datastore is a managed service with its own driver, choose
 * the driver by WHAT THE URL ACTUALLY IS — never by an env flag someone can
 * forget to set:
 *
 *   function isVendorUrl(url) {
 *     try { return new URL(url).hostname.endsWith('.vendor.tech') }
 *     catch { return false }
 *   }
 *
 *   export function db() {
 *     return isVendorUrl(DATABASE_URL)
 *       ? drizzle(vendorHttpClient(DATABASE_URL))   // production
 *       : drizzle(new pg.Pool({ connectionString: DATABASE_URL }))  // anywhere else
 *   }
 *
 * With that, the same production code path runs against this local instance —
 * which is the entire point.
 */
