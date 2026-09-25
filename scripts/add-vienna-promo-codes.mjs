/**
 * The VIENNA voucher batch: ten single-use codes, €100 off an order of €1000+.
 *
 * Promo codes are Sanity documents, not database rows — the definition lives in
 * the catalogue where the owner edits it, and only the *count of uses* lives in
 * PostgreSQL (`promo_redemptions`). That split is why `maxUses` here is a
 * definition and not a counter: the last remaining use of a code is settled by
 * a row lock at checkout, in `server/services/promo.ts`.
 *
 * Idempotent. The document id is derived from the code, so a second run brings
 * an edited code back to the intended state instead of creating a duplicate.
 * It does NOT reset redemptions: those are Postgres rows and are never touched
 * from here, so a code that has already been spent stays spent.
 *
 * The €1000 minimum is load-bearing. A fixed discount is clamped to the basket
 * (`Math.min(value, subtotal)` in server/services/pricing.ts), so with no
 * minimum a €100 code would zero the price of any of the 76 catalogue items
 * that cost under €200. Against a €1000 floor the code is worth 10% or less.
 *
 * Usage (from the repo root, with SANITY_TOKEN set):
 *   node scripts/add-vienna-promo-codes.mjs           # dry run — reports only
 *   node scripts/add-vienna-promo-codes.mjs --apply   # writes the ten codes
 */
import { createClient } from '@sanity/client'

const APPLY = process.argv.includes('--apply')

const token = process.env.SANITY_TOKEN
if (!token) {
  console.error('SANITY_TOKEN is required (write access to the production dataset).')
  process.exit(1)
}

const sanity = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  token,
  apiVersion: '2024-01-01',
  useCdn: false,
})

/**
 * End of 24 October 2026 in Paris, written as the UTC instant it actually is.
 *
 * Sanity stores datetimes in UTC and the shop is in Paris, which is UTC+2 until
 * the 25th. Writing the local wall-clock time would have expired the batch two
 * hours early.
 */
const VALID_UNTIL = '2026-10-24T21:59:59Z'

const SETTINGS = {
  discountType: 'fixed',
  discountValue: 100, // euros — `fromEuros` converts to cents when parsed
  minOrderAmount: 1000, // euros
  maxUses: 1, // per code; ten codes = ten redemptions, capped at €1000 given away
  isActive: true,
  validUntil: VALID_UNTIL,
  // `validFrom` is deliberately absent: an absent value means "valid now", and
  // stamping it with this machine's clock would let skew hide the batch.
}

const CODES = Array.from({ length: 10 }, (_, i) => `VIENNA${i + 1}`)

const existing = await sanity.fetch(
  `*[_type == "promoCode" && code in $codes]{ _id, code, discountValue, maxUses, isActive }`,
  { codes: CODES }
)
const byCode = new Map(existing.map((doc) => [doc.code, doc]))

console.log(`Target: ${CODES.length} codes · €${SETTINGS.discountValue} off · minimum €${SETTINGS.minOrderAmount}`)
console.log(`Expires: ${VALID_UNTIL} (end of 24 Oct 2026, Paris)`)
console.log(`Already in the dataset: ${existing.length}\n`)

if (!APPLY) {
  for (const code of CODES) {
    console.log(`  ${code.padEnd(10)} ${byCode.has(code) ? 'would be updated' : 'would be created'}`)
  }
  console.log('\nDry run. Nothing was written. Re-run with --apply to commit.')
  process.exit(0)
}

// One transaction: ten codes are a batch, and a half-written batch is a support
// problem — a customer holding VIENNA7 must not find it missing because the
// connection dropped at VIENNA6.
const tx = sanity.transaction()
for (const code of CODES) {
  const id = `promoCode.${code}`
  tx.createIfNotExists({ _id: id, _type: 'promoCode', code, currentUses: 0, ...SETTINGS })
  tx.patch(id, (patch) => patch.set({ code, ...SETTINGS }))
}
await tx.commit()

// Read it back from the API rather than trusting the write: this is the only
// evidence that the ten codes are actually live and shaped as intended.
const live = await sanity.fetch(
  `*[_type == "promoCode" && code in $codes] | order(code asc){
    code, discountType, discountValue, minOrderAmount, maxUses, isActive, validUntil
  }`,
  { codes: CODES }
)

console.log(`\n✅ ${live.length}/${CODES.length} codes live in production:\n`)
for (const p of live) {
  console.log(
    `  ${p.code.padEnd(10)} €${String(p.discountValue).padEnd(4)} min €${String(p.minOrderAmount).padEnd(5)}` +
      ` uses:${p.maxUses}  ${p.isActive ? 'active' : 'INACTIVE'}  until ${p.validUntil}`
  )
}

const wrong = live.filter(
  (p) =>
    p.discountType !== 'fixed' ||
    p.discountValue !== SETTINGS.discountValue ||
    p.minOrderAmount !== SETTINGS.minOrderAmount ||
    p.maxUses !== SETTINGS.maxUses ||
    p.isActive !== true
)
if (live.length !== CODES.length || wrong.length > 0) {
  console.error(`\n❌ ${CODES.length - live.length} missing, ${wrong.length} malformed.`)
  process.exit(1)
}
console.log('\nAll ten verified against the live dataset.')
