/**
 * A real PostgreSQL for machines that have none.
 *
 * The integration suite and the full simulation both need an actual database —
 * the concurrency behaviour they exercise cannot be faked over SQLite — and not
 * every machine has Docker or a local install. This boots an embedded Postgres,
 * applies the repository's migrations, and stays up until killed.
 *
 *   node scripts/dev-db.mjs            # boots on 5544, prints the URL
 *
 * Data lives under .devdb/ (gitignored) and survives restarts; delete the
 * directory for a clean slate. Never point production at this.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import pg from 'pg'

const PORT = Number(process.env.DEV_DB_PORT ?? 5544)
const DATA_DIR = join(process.cwd(), '.devdb')
const DB_NAME = 'vitesse_dev'
const USER = 'vitesse'
const PASSWORD = 'vitesse'

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

// Migrations are idempotent to apply here because a fresh directory means a
// fresh cluster; on an existing one, failures from already-present objects are
// tolerated so a restart is cheap.
const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations')
const files = readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()
const client = new pg.Client({ connectionString: url })
await client.connect()
for (const file of files) {
  const contents = readFileSync(join(migrationsDir, file), 'utf8')
  for (const statement of contents.split('--> statement-breakpoint')) {
    const sql = statement.trim()
    if (!sql) continue
    try {
      await client.query(sql)
    } catch (error) {
      if (!fresh && /already exists/i.test(error.message)) continue
      throw error
    }
  }
}
await client.end()

console.log(`\n✅ dev database ready\n   DATABASE_URL=${url}\n   (Ctrl+C stops it; .devdb/ keeps the data)\n`)

const stop = async () => {
  await server.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
// Keep the process alive.
setInterval(() => {}, 1 << 30)
