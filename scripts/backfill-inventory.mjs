/**
 * One-shot Sanity → PG inventory backfill (ADR-001, prereq for P0-11 / activation).
 *
 * Copies stock from sellable, non-draft Sanity products into the `inventory`
 * table. Idempotent: safe to rerun. Conflicts on product_id are resolved by
 * UPDATE so a fresh run brings PG back in sync with Sanity if anything has
 * drifted before activation.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-inventory.mjs            # write
 *   node --env-file=.env scripts/backfill-inventory.mjs --dry-run  # report only
 *
 * Reads:
 *   SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN (optional for public docs),
 *   DATABASE_URL.
 *
 * Writes nothing to Sanity. Does not touch Vercel envs. The activation flag
 * (ENABLE_PG_PRIMARY_ORDERS) is intentionally NOT toggled by this script.
 *
 * Why "isAvailable && !draft" rather than "all products":
 *   server/api/orders/create.post.ts already rejects orders for !isAvailable
 *   products, so a missing inventory row at order time is impossible if this
 *   gate matches. Drafts are editor work-in-progress and have separate _ids
 *   ("drafts.<base>"); shipping their stock would conflict on PK with the
 *   published copy once it lands.
 */

import { createClient } from '@sanity/client'
import { neon } from '@neondatabase/serverless'

const isDryRun = process.argv.includes('--dry-run')

function fail(msg) {
  console.error(`✘ ${msg}`)
  process.exit(1)
}

const projectId = process.env.SANITY_PROJECT_ID
const dataset = process.env.SANITY_DATASET || 'production'
const sanityToken = process.env.SANITY_TOKEN
const dbUrl = process.env.DATABASE_URL

if (!projectId) fail('SANITY_PROJECT_ID not set. Run with: node --env-file=.env scripts/backfill-inventory.mjs')
if (!dbUrl) fail('DATABASE_URL not set.')

const sanity = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  useCdn: false,
  token: sanityToken || undefined,
})

const sql = neon(dbUrl)

console.log(`▸ Sanity:  project=${projectId} dataset=${dataset}`)
console.log(`▸ Postgres: ${dbUrl.replace(/:[^:@/]+@/, ':***@')}`)
console.log(`▸ Mode:    ${isDryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`)
console.log('')

// 1) Fetch sellable, non-draft products. _id of drafts is "drafts.<id>" — the
//    explicit prefix check is more portable than path("drafts.**") here.
const groq = `*[
  _type == "product"
  && !(_id in path("drafts.**"))
  && isAvailable == true
]{
  _id,
  "sku": coalesce(slug.current, _id),
  "stock": coalesce(stock, 0),
  "name": coalesce(name.fr, name.en, _id)
}`

const products = await sanity.fetch(groq)
console.log(`▸ Fetched ${products.length} sellable products from Sanity`)

if (products.length === 0) {
  console.log('Nothing to backfill. Exiting cleanly.')
  process.exit(0)
}

// Quick integrity check before writing
const negativeStock = products.filter((p) => typeof p.stock !== 'number' || p.stock < 0)
if (negativeStock.length > 0) {
  console.warn(`⚠ ${negativeStock.length} product(s) have invalid/negative stock; clamping to 0:`)
  for (const p of negativeStock.slice(0, 5)) console.warn(`   ${p._id} (${p.sku}) stock=${p.stock}`)
}

if (isDryRun) {
  console.log('')
  console.log('Dry-run — would upsert these (first 10):')
  for (const p of products.slice(0, 10)) {
    console.log(`   product_id=${p._id}  sku=${p.sku}  stock=${Math.max(0, p.stock | 0)}`)
  }
  if (products.length > 10) console.log(`   ... and ${products.length - 10} more`)

  // Compare against existing PG state so the user can see drift before committing
  const existing = await sql`SELECT product_id, stock FROM inventory`
  const existingMap = new Map(existing.map((r) => [r.product_id, r.stock]))
  let willInsert = 0
  let willUpdate = 0
  let unchanged = 0
  for (const p of products) {
    const newStock = Math.max(0, p.stock | 0)
    if (!existingMap.has(p._id)) willInsert++
    else if (existingMap.get(p._id) !== newStock) willUpdate++
    else unchanged++
  }
  console.log('')
  console.log('Diff vs current PG inventory:')
  console.log(`   would INSERT (new rows):     ${willInsert}`)
  console.log(`   would UPDATE (stock differs): ${willUpdate}`)
  console.log(`   unchanged:                   ${unchanged}`)
  console.log(`   PG rows not in Sanity result: ${[...existingMap.keys()].filter((id) => !products.find((p) => p._id === id)).length}`)
  console.log('')
  console.log('No writes performed. Re-run without --dry-run to apply.')
  process.exit(0)
}

// 2) Upsert. ON CONFLICT bumps version + updates stock/sku/updated_at so a
//    rerun reflects current Sanity. `reserved` is left untouched — it tracks
//    in-flight cart holds and must not be overwritten by a backfill.
let inserted = 0
let updated = 0
let skipped = 0

for (const p of products) {
  const productId = p._id
  const sku = p.sku || null
  const stock = Math.max(0, p.stock | 0)

  try {
    const result = await sql`
      INSERT INTO inventory (product_id, sku, stock, reserved, version, updated_at)
      VALUES (${productId}, ${sku}, ${stock}, 0, 0, NOW())
      ON CONFLICT (product_id) DO UPDATE
      SET sku = EXCLUDED.sku,
          stock = EXCLUDED.stock,
          version = inventory.version + 1,
          updated_at = NOW()
      WHERE inventory.stock IS DISTINCT FROM EXCLUDED.stock
         OR inventory.sku IS DISTINCT FROM EXCLUDED.sku
      RETURNING (xmax = 0) AS inserted
    `
    if (result.length === 0) {
      skipped++ // row exists and identical — no-op
    } else if (result[0].inserted) {
      inserted++
    } else {
      updated++
    }
  } catch (err) {
    console.error(`✘ failed to upsert ${productId}:`, err.message)
    process.exit(2)
  }
}

// 3) Report final counts straight from PG so we can't lie to ourselves
const [{ count: finalCount }] = await sql`SELECT COUNT(*)::int AS count FROM inventory`
const [{ count: invalidCount }] = await sql`SELECT COUNT(*)::int AS count FROM inventory WHERE stock IS NULL OR stock < 0`

console.log('')
console.log('═════════════════════════════════════════')
console.log(`Fetched from Sanity:    ${products.length}`)
console.log(`  inserted (new):       ${inserted}`)
console.log(`  updated (stock diff): ${updated}`)
console.log(`  skipped (identical):  ${skipped}`)
console.log(`Final PG inventory:     ${finalCount} rows`)
console.log(`  invalid stock:        ${invalidCount} (must be 0)`)
console.log('═════════════════════════════════════════')

if (invalidCount > 0) {
  console.error('✘ Invalid stock rows present after backfill. Aborting before activation.')
  process.exit(3)
}

if (finalCount < products.length) {
  console.error(`✘ Final count (${finalCount}) is less than fetched (${products.length}). Investigate.`)
  process.exit(4)
}

console.log('✓ Backfill complete. Safe to proceed to migration verification.')
