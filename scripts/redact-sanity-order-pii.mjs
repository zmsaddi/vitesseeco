#!/usr/bin/env node
/**
 * Redact customer PII from the Sanity order mirror.
 *
 * The Sanity dataset is publicly readable — the storefront reads the catalog
 * without a token — so order documents created before the mirror was reduced to
 * operational fields expose customer name, email, phone and addresses to anyone
 * who can issue a GROQ query.
 *
 * Postgres is the authoritative store for orders. This script unsets the PII
 * fields on the mirror, and refuses to touch any order whose data is not
 * already safely in Postgres.
 *
 * Usage (from the repo root, with SANITY_TOKEN and DATABASE_URL set):
 *   node scripts/redact-sanity-order-pii.mjs           # dry run — reports only
 *   node scripts/redact-sanity-order-pii.mjs --apply   # performs the redaction
 */
import { createClient } from '@sanity/client'
import { neon } from '@neondatabase/serverless'

const APPLY = process.argv.includes('--apply')
const PII_FIELDS = ['customer', 'shippingAddress', 'billingAddress']

const token = process.env.SANITY_TOKEN
const databaseUrl = process.env.DATABASE_URL
if (!token) {
  console.error('SANITY_TOKEN is required (write access to the production dataset).')
  process.exit(1)
}
if (!databaseUrl) {
  console.error('DATABASE_URL is required — Postgres coverage is verified before anything is unset.')
  process.exit(1)
}

const sanity = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  token,
  apiVersion: '2024-01-01',
  useCdn: false,
})
const sql = neon(databaseUrl)

const docs = await sanity.fetch(
  `*[_type == "order" && (defined(customer) || defined(shippingAddress) || defined(billingAddress))]{
    _id, orderNumber, customer, shippingAddress, billingAddress
  }`
)

if (docs.length === 0) {
  console.log('No order documents carry PII. Nothing to do.')
  process.exit(0)
}

console.log(`${docs.length} order document(s) currently expose PII in the public dataset.\n`)

const redactable = []
const blocked = []

for (const doc of docs) {
  if (!doc.orderNumber) {
    blocked.push({ id: doc._id, reason: 'no orderNumber — cannot match a Postgres row' })
    continue
  }
  const rows = await sql`
    SELECT order_number, shipping_address, customer_snapshot
    FROM orders WHERE order_number = ${doc.orderNumber} LIMIT 1
  `
  if (rows.length === 0) {
    blocked.push({ id: doc._id, orderNumber: doc.orderNumber, reason: 'not present in Postgres — backfill it before redacting' })
    continue
  }
  if (!rows[0].shipping_address) {
    blocked.push({ id: doc._id, orderNumber: doc.orderNumber, reason: 'Postgres row has no shipping_address — backfill it before redacting' })
    continue
  }
  redactable.push(doc)
}

for (const b of blocked) {
  console.log(`  SKIP  ${b.orderNumber || b.id} — ${b.reason}`)
}
for (const d of redactable) {
  const present = PII_FIELDS.filter((f) => d[f]).join(', ')
  console.log(`  ${APPLY ? 'REDACT' : 'WOULD REDACT'}  ${d.orderNumber} (${present})`)
}

if (!APPLY) {
  console.log(`\nDry run. Re-run with --apply to redact ${redactable.length} document(s).`)
  process.exit(0)
}

let done = 0
for (const d of redactable) {
  await sanity.patch(d._id).unset(PII_FIELDS).commit()
  done++
}

console.log(`\nRedacted ${done} document(s). ${blocked.length} skipped.`)
if (blocked.length) {
  console.log('Resolve the skipped orders (backfill Postgres) and re-run — they are still exposed.')
  process.exit(1)
}
