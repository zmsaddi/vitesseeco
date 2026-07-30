/**
 * Seed the inventory table from the live Sanity catalogue.
 *
 * This has to run ONCE before the rebuild serves a customer, and it is the
 * difference between a shop and a shop where everything is out of stock: a
 * product with no `inventory` row resolves to available = 0, so on a fresh
 * database all 147 products read as unavailable — on the product pages, in the
 * admin catalogue, in catalog.csv and in all four Merchant feeds. Google would
 * be told the entire catalogue is gone on day one.
 *
 * It replaces scripts/backfill-inventory.mjs, which was written for master's
 * schema and writes `stock` and `reserved` columns that do not exist here. The
 * rebuild keeps the count in `on_hand` and holds in a separate
 * `stock_reservations` table, so the old script fails outright — which is a
 * better failure than the alternative, but still leaves the shop empty.
 *
 *   node --env-file=.env scripts/seed-inventory.mjs --dry-run
 *   node --env-file=.env scripts/seed-inventory.mjs
 *
 * Idempotent. A rerun brings `on_hand` back in line with Sanity and leaves live
 * reservations alone, because a hold belongs to a checkout in flight and is not
 * this script's business.
 */
import process from 'node:process'
import pg from 'pg'

const DRY_RUN = process.argv.includes('--dry-run')

const PROJECT = process.env.SANITY_PROJECT_ID ?? '2jvnjf0c'
const DATASET = process.env.SANITY_DATASET ?? 'production'
const TOKEN = process.env.SANITY_TOKEN
const DATABASE_URL = process.env.DATABASE_URL

function fail(message, code = 1) {
  console.error(`❌ ${message}`)
  process.exit(code)
}

if (!DATABASE_URL) fail('DATABASE_URL is not set')

/**
 * Only products the shop would actually sell. A draft is editor work in
 * progress and carries a different `_id`, so shipping its count would collide.
 */
const QUERY = `*[_type == "product" && isAvailable == true && defined(slug.current) && !(_id in path("drafts.**"))]{
  _id, sku, "stock": coalesce(stock, 0), "name": coalesce(name.fr, name.en)
}`

async function fetchProducts() {
  const url =
    `https://${PROJECT}.api.sanity.io/v2024-01-01/data/query/${DATASET}` +
    `?query=${encodeURIComponent(QUERY)}`
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
  const response = await fetch(url, { headers })
  if (!response.ok) fail(`Sanity query failed: ${response.status} ${response.statusText}`)
  const { result } = await response.json()
  return Array.isArray(result) ? result : []
}

const products = await fetchProducts()
if (products.length === 0) {
  // Never write an empty catalogue over a working one.
  fail('Sanity returned no sellable products — refusing to seed an empty inventory', 5)
}

// A count that is not a whole number at least zero is a data problem, and
// clamping it silently would put a wrong number on the shelf.
const invalid = products.filter(
  (p) => typeof p.stock !== 'number' || !Number.isInteger(p.stock) || p.stock < 0
)
if (invalid.length > 0) {
  console.error(`❌ ${invalid.length} product(s) have an unusable stock value:`)
  for (const p of invalid.slice(0, 10)) console.error(`   ${p.name ?? p._id}: ${JSON.stringify(p.stock)}`)
  fail('Fix them in the Studio and run again', 5)
}

const total = products.reduce((sum, p) => sum + p.stock, 0)
console.log(`\n📦 ${products.length} sellable products, ${total} units in Sanity`)

if (DRY_RUN) {
  console.log('\n(dry run — nothing written)\n')
  for (const p of products.slice(0, 10)) {
    console.log(`   ${String(p.stock).padStart(4)}  ${p.sku ?? '—'}  ${p.name ?? p._id}`)
  }
  if (products.length > 10) console.log(`   … and ${products.length - 10} more`)
  process.exit(0)
}

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

let written = 0
try {
  await client.query('BEGIN')
  for (const product of products) {
    // `version` is bumped rather than reset so a concurrent admin edit is still
    // detectable afterwards.
    await client.query(
      `INSERT INTO inventory (product_id, sku, on_hand, version, updated_at)
       VALUES ($1, $2, $3, 0, NOW())
       ON CONFLICT (product_id) DO UPDATE
          SET sku = EXCLUDED.sku,
              on_hand = EXCLUDED.on_hand,
              version = inventory.version + 1,
              updated_at = NOW()
        WHERE inventory.on_hand IS DISTINCT FROM EXCLUDED.on_hand
           OR inventory.sku IS DISTINCT FROM EXCLUDED.sku`,
      [product._id, product.sku ?? null, product.stock]
    )
    written++
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  await client.end()
  fail(`write failed, nothing committed: ${error.message}`, 2)
}

const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM inventory')
await client.end()

console.log(`\n✅ ${written} product(s) seeded — inventory now holds ${rows[0].n} row(s)\n`)
if (rows[0].n < products.length) {
  fail('fewer rows than products: something else is deleting them', 4)
}
