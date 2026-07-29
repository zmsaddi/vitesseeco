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
 *   1. Loads every PUBLISHED product missing `gtin`, oldest first.
 *   2. Finds the highest item reference already assigned under your prefix,
 *      drafts included, so a code held by an unpublished edit is never reissued.
 *   3. Assigns sequential EAN-13s (prefix + item ref + mod-10 check digit),
 *      writing the published document and its open draft in one transaction so
 *      publishing later cannot swap the code.
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

const DRAFT = 'drafts.'

// Raw perspective: drafts must stay visible. A draft holding a code has already
// spent it, and a draft of a coded product must be patched alongside it.
const client = getCliClient({ apiVersion: '2024-01-01' }).withConfig({ perspective: 'raw' })

const all = await client.fetch(
  `*[_type == "product"] | order(_createdAt asc){ _id, gtin, "name": name.fr, "sku": coalesce(sku, slug.current) }`
)

const published = all.filter((p) => !p._id.startsWith(DRAFT))
const draftOf = new Map(
  all.filter((p) => p._id.startsWith(DRAFT)).map((p) => [p._id.slice(DRAFT.length), p])
)

// Highest item ref already used under this prefix — drafts counted too, so
// reruns continue the sequence instead of colliding with a pending edit.
let next = 0
for (const p of all) {
  if (typeof p.gtin !== 'string' || !p.gtin.startsWith(PREFIX)) continue
  const ref = Number(p.gtin.slice(PREFIX.length, 12))
  if (Number.isFinite(ref) && ref + 1 > next) next = ref + 1
}

// Only published products get a code: a product that has never been published
// has no storefront presence, and burning a licensed EAN on it is irreversible.
const missing = published.filter((p) => !p.gtin)
const assigned = published.length - missing.length
const publishedIds = new Set(published.map((p) => p._id))
const neverPublished = all.filter((p) => p._id.startsWith(DRAFT) && !publishedIds.has(p._id.slice(DRAFT.length)))

console.log(`Prefix ${PREFIX} · capacity ${CAPACITY} codes · already assigned: ${assigned} · missing: ${missing.length}\n`)

if (next + missing.length > CAPACITY) {
  console.error(`❌ Not enough codes left under this prefix (${CAPACITY - next} remaining).`)
  process.exit(1)
}

let consumed = 0
for (const p of missing) {
  const draft = draftOf.get(p._id)

  // A draft that already carries a code wins: adopting it costs no new EAN and
  // removes the flip that publishing the draft would otherwise cause.
  if (draft?.gtin) {
    await client.patch(p._id).set({ gtin: draft.gtin }).commit()
    console.log(`= ${draft.gtin} → ${p.sku} (${p.name}) — adopted from open draft`)
    continue
  }

  const code = ean13(next++)
  const tx = client.transaction().patch(p._id, { set: { gtin: code } })
  if (draft) tx.patch(draft._id, { set: { gtin: code } })
  await tx.commit()
  consumed++
  console.log(`+ ${code} → ${p.sku} (${p.name})${draft ? ' (+ open draft, same code)' : ''}`)
}

console.log(`\n✅ ${missing.length} product(s) covered · ${consumed} new code(s) consumed. Rerun after adding new products — the sequence continues automatically.`)

if (neverPublished.length) {
  console.log(`\n⚠️ ${neverPublished.length} unpublished product(s) skipped — publish them, then rerun:`)
  for (const p of neverPublished) console.log(`  - ${p.sku || p._id} (${p.name || '—'})`)
}
