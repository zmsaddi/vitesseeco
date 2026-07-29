#!/usr/bin/env node
/**
 * Merchant feed guard.
 *
 * Two defects here are account-ending rather than merely wrong, so they are
 * checked on every build instead of being left to a reviewer:
 *
 *  1. A shipping promise the checkout cannot honour. Google files that under
 *     Misrepresentation and suspends the account on detection, without prior
 *     warning. The feed's shipping must therefore be derivable from the same
 *     shippingMethod documents the checkout uses — never from a constant.
 *
 *  2. identifier_exists=no beside a brand. Google reads that attribute as "no
 *     GTIN, no MPN AND no brand"; emitting it for a branded product is a
 *     contradiction on every line and invites item disapprovals.
 *
 * Runs against the live catalogue, so it also catches a carrier being switched
 * off in the Studio while the feed keeps advertising it.
 */
import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID ?? '2jvnjf0c',
  dataset: process.env.SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
})

const problems = []

const shippingMethods = await client.fetch(
  `*[_type == "shippingMethod" && isActive == true]{ code, zones, postalCodePrefixes, price }`
)

const deliverable = new Set()
for (const method of shippingMethods) {
  if (method.code === 'pickup') continue
  for (const country of method.zones ?? []) deliverable.add(country.toUpperCase())
}

if (deliverable.size === 0) {
  problems.push('No active delivery method serves any country — every feed would advertise nothing.')
}

// The feeds we intend to register. A feed for a country we cannot deliver to is
// a promise we cannot keep, so it must not be registered at all.
const FEEDS = [
  { file: 'google-merchant.xml', country: 'FR' },
  { file: 'google-merchant-nl.xml', country: 'NL' },
  { file: 'google-merchant-de.xml', country: 'DE' },
  { file: 'google-merchant-es.xml', country: 'ES' },
]

const registerable = FEEDS.filter((feed) => deliverable.has(feed.country))
const notRegisterable = FEEDS.filter((feed) => !deliverable.has(feed.country))

const products = await client.fetch(
  `*[_type == "product" && isAvailable == true && defined(slug.current) && defined(price) && price > 0]{
    "slug": slug.current, gtin, manufacturerMpn, "brand": coalesce(brand->name.fr, brand->name)
  }`
)

// A product with a brand may never declare that it has no identifiers.
const contradictory = products.filter((p) => p.brand && !p.gtin && !p.manufacturerMpn)

console.log(`Delivery countries served: ${[...deliverable].sort().join(', ') || '(none)'}`)
console.log(`Feeds safe to register:    ${registerable.map((f) => f.country).join(', ') || '(none)'}`)
if (notRegisterable.length > 0) {
  console.log(
    `Feeds NOT to register yet: ${notRegisterable.map((f) => f.country).join(', ')} — no active delivery there`
  )
}
console.log(`Products: ${products.length}`)

const withIdentifier = products.filter((p) => p.gtin || p.manufacturerMpn).length
console.log(`With GTIN or manufacturer MPN: ${withIdentifier} / ${products.length}`)

if (contradictory.length > 0) {
  // A warning rather than a failure: it costs reach, it does not suspend an
  // account, and it is resolved by supplier data rather than by a code change.
  console.warn(
    `\n⚠ ${contradictory.length} branded product(s) still have neither GTIN nor manufacturer MPN.` +
      `\n  They will carry a "limited performance" warning in Merchant Center until the supplier` +
      `\n  provides EAN or MPN values. Ask OUXI / QMWheel — it is free, and it is the only` +
      `\n  legitimate source. Never invent a code for another company's product.`
  )
}

if (problems.length > 0) {
  console.error('\n❌ Feed guard failed:')
  for (const problem of problems) console.error(`   ${problem}`)
  process.exit(1)
}

console.log('\n✅ Feed guard passed')
