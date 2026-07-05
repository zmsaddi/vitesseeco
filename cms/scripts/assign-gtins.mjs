/**
 * Automatic GTIN/EAN-13 assignment (owner request 2026-07-05).
 *
 * ⚠️ LEGAL PREREQUISITE — read before running:
 * EANs are globally unique identifiers licensed by GS1. Amazon, bol.com and
 * Kaufland VERIFY ownership against the GS1 registry; invented codes get
 * listings rejected and accounts suspended. This script therefore refuses to
 * run without GS1_PREFIX — the company prefix you receive when registering
 * at gs1.fr (small-company tier ≈ €100–250/year for up to 1 000 codes).
 * If the supplier truly has no codes, the alternative is a per-marketplace
 * GTIN EXEMPTION (Amazon: Brand → GTIN exemption request), not fake codes.
 *
 * What it does (idempotent — safe to rerun for future products):
 *   1. Loads every product missing `gtin`, oldest first.
 *   2. Finds the highest item reference already assigned under your prefix.
 *   3. Assigns sequential EAN-13s (prefix + item ref + mod-10 check digit).
 *
 * Run from cms/:
 *   set GS1_PREFIX=376123456   (your real prefix from GS1 France)
 *   npx sanity exec scripts/assign-gtins.mjs --with-user-token
 */
import { getCliClient } from 'sanity/cli'

const PREFIX = (process.env.GS1_PREFIX || '').trim()

if (!/^\d{6,11}$/.test(PREFIX)) {
  console.error(
    '❌ GS1_PREFIX missing or invalid.\n' +
    '   Register at https://www.gs1.fr to obtain your company prefix, then:\n' +
    '   set GS1_PREFIX=<your prefix> && npx sanity exec scripts/assign-gtins.mjs --with-user-token\n' +
    '   Refusing to invent EANs: marketplaces validate ownership against GS1.'
  )
  process.exit(1)
}

const ITEM_LEN = 12 - PREFIX.length // digits available for the item reference
const CAPACITY = 10 ** ITEM_LEN

function checkDigit(twelve) {
  const sum = twelve.split('').reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
  return String((10 - (sum % 10)) % 10)
}

function ean13(itemRef) {
  const body = PREFIX + String(itemRef).padStart(ITEM_LEN, '0')
  return body + checkDigit(body)
}

const client = getCliClient({ apiVersion: '2024-01-01' })

// Highest item ref already used under this prefix (so reruns continue the sequence).
const existing = await client.fetch(
  `*[_type == "product" && defined(gtin) && string::startsWith(gtin, $p)].gtin`,
  { p: PREFIX }
)
let next = 0
for (const g of existing) {
  const ref = Number(g.slice(PREFIX.length, 12))
  if (Number.isFinite(ref) && ref + 1 > next) next = ref + 1
}

const missing = await client.fetch(
  `*[_type == "product" && !defined(gtin)] | order(_createdAt asc){ _id, "name": name.fr, "sku": coalesce(sku, slug.current) }`
)

console.log(`Prefix ${PREFIX} · capacity ${CAPACITY} codes · already assigned: ${existing.length} · missing: ${missing.length}\n`)

if (next + missing.length > CAPACITY) {
  console.error(`❌ Not enough codes left under this prefix (${CAPACITY - next} remaining).`)
  process.exit(1)
}

for (const p of missing) {
  const code = ean13(next++)
  await client.patch(p._id).set({ gtin: code }).commit()
  console.log(`+ ${code} → ${p.sku} (${p.name})`)
}

console.log(`\n✅ ${missing.length} GTIN(s) assigned. Rerun after adding new products — the sequence continues automatically.`)
