#!/usr/bin/env node
/**
 * Import supplier EAN-13 codes onto products.
 *
 * A GTIN identifies ONE trade item, so a code is written only where the model,
 * the colour AND the configuration all agree. That is why this reads an
 * explicit slug→code map rather than matching names at run time: a fuzzy match
 * that lands a black bike's barcode on a pink one is misrepresentation, and
 * Google enforces that by suspending the account.
 *
 * Every code is check-digit validated before it is written. A transposed digit
 * still looks like a valid 13-digit number and points at another company's
 * product, so the arithmetic is the only thing that catches it.
 *
 * Usage, from cms/:
 *   npx sanity exec scripts/import-supplier-eans.mjs --with-user-token
 *   npx sanity exec scripts/import-supplier-eans.mjs --with-user-token -- --apply
 */
import { getCliClient } from 'sanity/cli'

const APPLY = process.argv.includes('--apply')

/**
 * Verified against fatbikeskopen's own numbering, cross-checked on a reseller
 * that buys from them. `boxed` is the bike in its carton; `assembled` is the
 * same bike delivered ready to ride, which the distributor numbers separately.
 *
 * Only entries whose model AND colour matched exactly are listed. Products
 * where the supplier sells a different colour are deliberately absent — there
 * is no "close enough" for a barcode.
 */
const CODES = [
  { slug: 'ouxi-v8-ultra-mini-rose', boxed: '8721206522395', assembled: '8721206522401' },
  { slug: 'ouxi-v8-ultra-mini-vert', boxed: '8721206522371', assembled: '8721206522388' },
  { slug: 'ouxi-v8-ultra-mini-noir', boxed: '8721206522432', assembled: '8721206522449' },
  { slug: 'ouxi-v8-ultra-mini-gris', boxed: '8721206522418', assembled: '8721206522425' },
  { slug: 'ouxi-gt-20-gris', boxed: '8721206522111', assembled: '8721206522128' },
  { slug: 'ouxi-gt-20-noir', boxed: '8721206522098', assembled: '8721206522104' },
]

function isValidEan13(value) {
  if (!/^\d{13}$/.test(value)) return false
  const digits = value.split('').map(Number)
  const check = digits.pop()
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0)
  return check === (10 - (sum % 10)) % 10
}

const client = getCliClient({ apiVersion: '2024-01-01' })

const slugs = CODES.map((entry) => entry.slug)
const products = await client.fetch(
  `*[_type == "product" && slug.current in $slugs]{ _id, "slug": slug.current, "name": name.fr, gtin, gtinAssembled }`,
  { slugs }
)
const bySlug = new Map(products.map((product) => [product.slug, product]))

const writes = []
const problems = []

for (const entry of CODES) {
  const product = bySlug.get(entry.slug)
  if (!product) {
    problems.push(`${entry.slug}: no such product`)
    continue
  }
  for (const [field, code] of [['gtin', entry.boxed], ['gtinAssembled', entry.assembled]]) {
    if (!code) continue
    if (!isValidEan13(code)) {
      problems.push(`${entry.slug}: ${code} fails the EAN-13 check digit`)
      continue
    }
    const existing = product[field]
    if (existing && existing !== code) {
      // Never overwrite a code someone entered deliberately.
      problems.push(`${entry.slug}: ${field} already holds ${existing}, refusing to replace with ${code}`)
      continue
    }
    if (existing === code) continue
    writes.push({ id: product._id, slug: entry.slug, name: product.name, field, code })
  }
}

for (const problem of problems) console.log(`  SKIP  ${problem}`)
for (const write of writes) {
  console.log(`  ${APPLY ? 'WRITE' : 'WOULD WRITE'}  ${write.slug} · ${write.field} = ${write.code}`)
}

console.log(`\n${writes.length} value(s) to write, ${problems.length} skipped.`)

if (!APPLY) {
  console.log('Dry run. Re-run with -- --apply to write.')
  process.exit(0)
}

let transaction = client.transaction()
for (const write of writes) {
  transaction = transaction.patch(write.id, { set: { [write.field]: write.code } })
}
await transaction.commit()
console.log(`Wrote ${writes.length} value(s).`)
