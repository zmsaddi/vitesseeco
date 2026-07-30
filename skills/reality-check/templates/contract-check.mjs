/**
 * The contract check — TEMPLATE. The cheapest high-value test in this skill.
 *
 * Runs your parser / validator / mapper over EVERY production record and asserts
 * that the parsed count equals the source count. Fixtures are a hypothesis
 * written by the same person who wrote the code, carrying the same assumptions.
 * Real data has its own opinion.
 *
 *   node contract-check.mjs
 *
 * This exact check would have caught, in under a second:
 *   · a field that is a plain string where the code expected a translated object
 *     → 144 products in the source, 0 rendered, tests green
 *   · the same class on a second field, visible only through a different
 *     projection → every detail page returning 404 while the listing looked fine
 *
 * ── Two rules it encodes ─────────────────────────────────────────────────
 *  1. STRICT VALIDATION MUST LOG EVERY REJECTION LOUDLY. Silent dropping turns a
 *     data-shape bug into an invisible one.
 *  2. CHECK EVERY PROJECTION SEPARATELY. A summary query and a detail query
 *     select different subsets; a bug in a field only the detail query fetches is
 *     invisible to a listing that works perfectly.
 */
import process from 'node:process'

// ─── CONFIG ────────────────────────────────────────────────────────────────
/**
 * Each entry is one projection: how the application actually fetches this kind
 * of record, paired with the parser that consumes it.
 */
const PROJECTIONS = [
  {
    name: 'product summary (listing)',
    fetch: () => fetchAll(SUMMARY_QUERY),
    parse: (raw) => parseProductSummary(raw, { locale: 'en' }),
  },
  {
    name: 'product detail (product page)',
    fetch: () => fetchAll(DETAIL_QUERY),
    parse: (raw) => parseProductDetail(raw, { locale: 'en' }),
  },
]

/** Replace with your real source: CMS client, database query, API call. */
async function fetchAll(query) {
  const res = await fetch(`${process.env.SOURCE_URL}?query=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`source returned ${res.status}`)
  return (await res.json()).result
}

const SUMMARY_QUERY = `*[_type == "product"]{ _id, name, slug, price, brand->{name} }`
const DETAIL_QUERY = `*[_type == "product"]{ ..., brand->{name}, category->{name} }`

/** Replace with your real parsers. */
const parseProductSummary = (raw) => raw
const parseProductDetail = (raw) => raw
// ───────────────────────────────────────────────────────────────────────────

let failed = false

for (const projection of PROJECTIONS) {
  console.log(`\n${projection.name}`)

  const records = await projection.fetch()
  console.log(`  source: ${records.length} record(s)`)

  // A source that returned nothing is not a pass. It is a broken check.
  if (records.length === 0) {
    console.error('  ✗ the source returned ZERO records — the check itself is broken, not the data')
    failed = true
    continue
  }

  const reasons = new Map()
  let parsed = 0
  for (const raw of records) {
    try {
      const result = projection.parse(raw)
      if (result === null || result === undefined) {
        const key = 'parser returned null without throwing'
        reasons.set(key, [...(reasons.get(key) ?? []), raw._id ?? '?'])
      } else parsed++
    } catch (error) {
      // Group by the MESSAGE, not the record: one shape bug affects thousands of
      // records, and a thousand identical lines hide the second, rarer bug.
      const key = String(error.message ?? error).slice(0, 160)
      reasons.set(key, [...(reasons.get(key) ?? []), raw._id ?? '?'])
    }
  }

  if (parsed === records.length) {
    console.log(`  ✓ all ${parsed} records parsed`)
    continue
  }

  failed = true
  console.error(`  ✗ ${records.length - parsed} of ${records.length} records DROPPED`)
  for (const [reason, ids] of [...reasons].sort((a, b) => b[1].length - a[1].length)) {
    console.error(`     ${ids.length}× ${reason}`)
    console.error(`        e.g. ${ids.slice(0, 3).join(', ')}`)
  }
}

// ─── field-shape census ────────────────────────────────────────────────────
/**
 * When something IS dropped, this is what tells you why in one glance: the real
 * type of every field across the whole corpus. A field showing two types is
 * exactly the bug.
 *
 *   node contract-check.mjs --census
 */
if (process.argv.includes('--census')) {
  console.log('\nField-shape census (a field with two shapes is your bug):')
  const records = await PROJECTIONS[PROJECTIONS.length - 1].fetch()
  const shapes = new Map()
  const describe = (v) =>
    v === null ? 'null'
    : Array.isArray(v) ? `array<${v[0] === undefined ? 'empty' : typeof v[0]}>`
    : typeof v === 'object' ? `object{${Object.keys(v).filter((k) => !k.startsWith('_')).slice(0, 3).join(',')}}`
    : typeof v
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (!shapes.has(key)) shapes.set(key, new Map())
      const bucket = shapes.get(key)
      const shape = describe(value)
      bucket.set(shape, (bucket.get(shape) ?? 0) + 1)
    }
  }
  for (const [field, bucket] of [...shapes].sort()) {
    const parts = [...bucket].map(([shape, n]) => `${shape}×${n}`)
    const conflicted = bucket.size > 1 ? '  ⚠️  MORE THAN ONE SHAPE' : ''
    console.log(`   ${field.padEnd(20)} ${parts.join(' | ')}${conflicted}`)
  }
}

console.log('')
process.exit(failed ? 1 : 0)
