/**
 * One-shot Sanity → PG inventory backfill (ADR-001, prereq for P0-11 / activation).
 *
 * Copies stock from sellable, non-draft Sanity products into the `inventory`
 * table. Idempotent: safe to rerun. Conflicts on product_id are resolved by
 * UPDATE so a fresh run brings PG back in sync with Sanity if anything has
 * drifted before activation.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-inventory.mjs            # write (strict)
 *   node --env-file=.env scripts/backfill-inventory.mjs --dry-run  # report only
 *
 * Strict-mode flags (default behaviour):
 *   - Aborts on any product whose stock is non-numeric, non-finite, or < 0.
 *   - Aborts on extra rows in PG that are not in the current Sanity result.
 *
 * Escape hatches (only use after reviewing what you're allowing):
 *   --allow-clamp-invalid-stock   clamp non-number / negative stock to 0
 *   --allow-extra-rows            permit PG rows that aren't in the Sanity set
 *
 * Reads:
 *   SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN (optional for public docs),
 *   DATABASE_URL.
 *
 * Exit codes:
 *   0  success
 *   1  missing required env / fail() called early
 *   2  upsert failed
 *   3  invalid stock present in PG after backfill (post-write integrity)
 *   4  final PG count < fetched Sanity count (rows lost)
 *   5  invalid Sanity stock detected (strict, no --allow-clamp-invalid-stock)
 *   6  extra PG rows detected (strict, no --allow-extra-rows)
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
const allowClampInvalidStock = process.argv.includes('--allow-clamp-invalid-stock')
const allowExtraRows = process.argv.includes('--allow-extra-rows')

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
if (allowClampInvalidStock) console.log(`▸ Flag:    --allow-clamp-invalid-stock (NON-STRICT)`)
if (allowExtraRows) console.log(`▸ Flag:    --allow-extra-rows (NON-STRICT)`)
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

// Strict integrity check before writing. Default behaviour for production
// activation is FAIL-FAST: any non-number or negative stock aborts so we
// don't silently mask data quality issues. Pass --allow-clamp-invalid-stock
// only after fixing the offending Sanity docs OR after a deliberate decision
// that clamping to 0 is acceptable.
const invalidStock = products.filter((p) => typeof p.stock !== 'number' || !Number.isFinite(p.stock) || p.stock < 0)
if (invalidStock.length > 0) {
  if (allowClampInvalidStock) {
    console.warn(`⚠ ${invalidStock.length} product(s) have invalid/negative stock; clamping to 0 (--allow-clamp-invalid-stock):`)
    for (const p of invalidStock.slice(0, 10)) console.warn(`   ${p._id} (${p.sku}) stock=${p.stock}`)
    if (invalidStock.length > 10) console.warn(`   ... and ${invalidStock.length - 10} more`)
  } else {
    console.error(`✘ ${invalidStock.length} product(s) have invalid/negative stock. Aborting (strict mode).`)
    for (const p of invalidStock.slice(0, 10)) console.error(`   ${p._id} (${p.sku}) stock=${p.stock}`)
    if (invalidStock.length > 10) console.error(`   ... and ${invalidStock.length - 10} more`)
    console.error('')
    console.error('Resolution paths:')
    console.error('  1. Fix the stock values in Sanity Studio so every sellable product has stock >= 0.')
    console.error('  2. OR rerun with --allow-clamp-invalid-stock to clamp them to 0 (NOT recommended for first activation).')
    process.exit(5)
  }
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

// Strict count check for first activation. PG must contain EXACTLY the rows
// produced by this fetch — no fewer (would mean we lost rows somewhere) and
// no extra (would mean stale rows from a previous run / hand-written data
// that aren't in the Sanity sellable set anymore). Pass --allow-extra-rows
// after a deliberate review only.
if (finalCount < products.length) {
  console.error(`✘ Final count (${finalCount}) is less than fetched (${products.length}). Rows lost — investigate.`)
  process.exit(4)
}

if (finalCount > products.length) {
  // Identify the extras so the operator knows what they're dealing with
  const fetchedIds = new Set(products.map((p) => p._id))
  const allRows = await sql`SELECT product_id, sku, stock FROM inventory ORDER BY updated_at DESC LIMIT 1000`
  const extras = allRows.filter((r) => !fetchedIds.has(r.product_id))

  if (allowExtraRows) {
    console.warn(`⚠ Final count (${finalCount}) exceeds fetched (${products.length}) by ${extras.length} (--allow-extra-rows):`)
    for (const r of extras.slice(0, 10)) console.warn(`   ${r.product_id} (${r.sku}) stock=${r.stock}`)
    if (extras.length > 10) console.warn(`   ... and ${extras.length - 10} more`)
  } else {
    console.error(`✘ Final count (${finalCount}) exceeds fetched (${products.length}) by ${extras.length}. Aborting (strict mode).`)
    for (const r of extras.slice(0, 10)) console.error(`   ${r.product_id} (${r.sku}) stock=${r.stock}`)
    if (extras.length > 10) console.error(`   ... and ${extras.length - 10} more`)
    console.error('')
    console.error('These rows exist in PG but are not in the current Sanity sellable set.')
    console.error('Likely causes: previous run left orphans, manual psql writes, or')
    console.error('product was unpublished / marked unavailable since the last backfill.')
    console.error('')
    console.error('Resolution paths:')
    console.error('  1. Investigate each extra row; delete with: DELETE FROM inventory WHERE product_id = ...')
    console.error('  2. OR rerun with --allow-extra-rows after confirming they\'re benign.')
    process.exit(6)
  }
}

console.log('✓ Backfill complete. Safe to proceed to migration verification.')
