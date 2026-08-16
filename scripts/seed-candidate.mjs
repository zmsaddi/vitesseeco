/**
 * Seed the candidate test rig to a KNOWN state.
 *
 * The browser gates assert exact products, prices and stock counts, so every
 * run must start from the same world. This script makes that true: it applies
 * the repository's migrations, empties every table, and writes the inventory
 * rows for the fixture catalogue (server/catalog/fixture-catalogue.json) — the
 * catalogue a candidate server serves when booted with CATALOG_SOURCE=fixture.
 *
 *   node scripts/seed-candidate.mjs [database-url]
 *
 * The URL may also come from DATABASE_URL. It is refused unless it points at
 * the LOOPBACK interface — localhost, 127.0.0.1 or ::1 — because this script
 * TRUNCATES EVERYTHING: determinism for a disposable rig, catastrophe for
 * anything real. A database's NAME buys no trust (anyone can call a
 * production database "test"), and there is deliberately no --force, no
 * ALLOW_REMOTE, no escape hatch of any kind. The candidate rig this script
 * exists for is always local; a remote database is never it.
 *
 * Unlike seed-inventory.mjs (which mirrors the LIVE Sanity stock into a real
 * database and never touches reservations), this one owns the whole database
 * and starts it from zero. The two must never be pointed at the same target.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import pg from 'pg'
import { isLoopbackUrl } from '../shared/loopback-url.mjs'

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL

function fail(message, code = 1) {
  console.error(`❌ ${message}`)
  process.exit(code)
}

if (!DATABASE_URL) fail('no database URL — pass it as the first argument or set DATABASE_URL')

// Refused BEFORE any connection is opened. Host only: the database name is
// not evidence of anything.
if (!isLoopbackUrl(DATABASE_URL)) {
  fail(
    'refusing to seed a non-loopback database. This script truncates everything it touches; ' +
      'it accepts localhost, 127.0.0.1 or ::1 and nothing else — there is no override.',
    2
  )
}

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'server', 'catalog', 'fixture-catalogue.json'), 'utf8')
)
const inventory = Object.entries(fixture.inventory)
if (inventory.length === 0) fail('fixture-catalogue.json declares no inventory — nothing to seed', 2)

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

/**
 * Migrations, applied the way scripts/dev-db.mjs applies them: statement by
 * statement, tolerating "already exists" so a rerun against a rig that already
 * has the schema is a no-op rather than a failure.
 */
const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations')
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
if (migrationFiles.length === 0) fail('no migration files found — wrong working directory?', 2)

for (const file of migrationFiles) {
  const contents = readFileSync(join(migrationsDir, file), 'utf8')
  for (const statement of contents.split('--> statement-breakpoint')) {
    const trimmed = statement.trim()
    if (!trimmed) continue
    try {
      await client.query(trimmed)
    } catch (error) {
      if (!/already exists/.test(error.message)) {
        await client.end()
        fail(`migration ${file} failed: ${error.message}`, 2)
      }
    }
  }
}

/**
 * A known state means an EMPTY state plus exactly the fixture rows. Leftover
 * orders, sessions and rate-limit windows from a previous run are precisely
 * the non-determinism this script exists to remove.
 */
const TABLES = [
  'stock_reservations',
  'order_items',
  'promo_redemptions',
  'orders',
  'webhook_events',
  'contact_messages',
  'audit_log',
  'events',
  'rate_limits',
  'addresses',
  'sessions',
  'oauth_identities',
  'customers',
  'inventory',
]
await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`)

let written = 0
try {
  await client.query('BEGIN')
  for (const [productId, row] of inventory) {
    if (!Number.isInteger(row.onHand) || row.onHand < 0) {
      throw new Error(`${productId} has an unusable onHand value: ${JSON.stringify(row.onHand)}`)
    }
    await client.query(
      `INSERT INTO inventory (product_id, sku, on_hand, version, updated_at)
       VALUES ($1, $2, $3, 0, NOW())`,
      [productId, row.sku ?? null, row.onHand]
    )
    written++
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  await client.end()
  fail(`seed failed, nothing committed: ${error.message}`, 2)
}

const { rows } = await client.query(
  'SELECT COUNT(*)::int AS n, COALESCE(SUM(on_hand), 0)::int AS units FROM inventory'
)
await client.end()

if (rows[0].n !== inventory.length) {
  fail(`inventory holds ${rows[0].n} row(s), expected ${inventory.length}`, 4)
}
console.log(
  `✅ candidate rig seeded: ${written} fixture product(s), ${rows[0].units} unit(s) on hand, all other tables empty`
)
