/**
 * Which Merchant Center feeds are safe to register.
 *
 * Google treats a shipping promise the checkout will not honour as
 * Misrepresentation, and enforces it by suspending the account on detection —
 * without a warning first. Registering the German feed while nothing delivers to
 * Germany is exactly that mistake, and it is easy to make because the feed
 * itself builds perfectly well.
 *
 * So this reads the same `shippingMethod` documents the checkout uses and says
 * which markets are actually served. It is a report, not a build step: it fails
 * only when the data is internally inconsistent, never merely because a country
 * is not served yet.
 *
 * Usage:  node scripts/check-feeds.mjs
 * Needs:  SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN
 */
import process from 'node:process'

const PROJECT = process.env.SANITY_PROJECT_ID ?? '2jvnjf0c'
const DATASET = process.env.SANITY_DATASET ?? 'production'
const TOKEN = process.env.SANITY_TOKEN

/** Feed → the countries it would be registered against in Merchant Center. */
const FEED_TARGETS = {
  fr: ['FR', 'BE', 'LU'],
  nl: ['NL', 'BE'],
  de: ['DE'],
  es: ['ES'],
}

const QUERY = `{
  "shipping": *[_type == "shippingMethod" && isActive == true && code != "pickup"]{
    code, zones, postalCodePrefixes, price
  },
  "products": count(*[_type == "product" && isAvailable == true && defined(slug.current) && price > 0]),
  "withGtin": count(*[_type == "product" && isAvailable == true && defined(gtin)]),
  "withMpn": count(*[_type == "product" && isAvailable == true && defined(manufacturerMpn)]),
  "assembly": *[_type == "siteSettings"][0].assembly{ isOffered, feeEuros },
  "assembledGtins": count(*[_type == "product" && isAvailable == true && defined(gtinAssembled)])
}`

async function main() {
  if (!TOKEN) {
    // Not a failure: a contributor without a token should not be blocked, and CI
    // without secrets should not go red over a report.
    console.log('ℹ️  SANITY_TOKEN is not set — skipping the feed report.')
    process.exit(0)
  }

  const url =
    `https://${PROJECT}.api.sanity.io/v2024-01-01/data/query/${DATASET}` +
    `?query=${encodeURIComponent(QUERY)}`

  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!response.ok) {
    console.error(`❌ Sanity query failed: ${response.status} ${response.statusText}`)
    process.exit(1)
  }

  const { result } = await response.json()
  const served = new Set()
  for (const method of result.shipping ?? []) {
    for (const zone of method.zones ?? []) served.add(String(zone).toUpperCase())
  }

  console.log(`\n📦 Catalogue: ${result.products} sellable products`)
  console.log(`   with EAN-13 : ${result.withGtin}`)
  console.log(`   with MPN    : ${result.withMpn}`)
  const unidentified = result.products - Math.max(result.withGtin, result.withMpn)
  if (unidentified > 0) {
    console.log(
      `   ⚠️  up to ${unidentified} product(s) may carry neither — those fall back to brand only,\n` +
        `      which Google accepts but ranks below identified offers.`
    )
  }

  console.log(`\n🚚 Delivery countries served: ${[...served].sort().join(', ') || '(none)'}`)
  for (const method of result.shipping ?? []) {
    const prefixes = (method.postalCodePrefixes ?? []).join(', ')
    console.log(
      `   ${method.code}: ${(method.zones ?? []).join(', ')}` +
        (prefixes ? ` — postcodes ${prefixes} only` : ' — whole country') +
        ` @ ${method.price ?? 0} €`
    )
  }

  const safe = []
  const unsafe = []
  for (const [feed, targets] of Object.entries(FEED_TARGETS)) {
    const reachable = targets.filter((country) => served.has(country))
    if (reachable.length > 0) safe.push(`${feed} → ${reachable.join(', ')}`)
    else unsafe.push(`${feed} (would target ${targets.join(', ')}, none served)`)
  }

  console.log(`\n✅ Feeds safe to register: ${safe.join(' · ') || '(none)'}`)
  if (unsafe.length > 0) {
    console.log(`⛔ Do NOT register yet: ${unsafe.join(' · ')}`)
    console.log(
      '   Registering a feed for a country nothing delivers to is Misrepresentation,\n' +
        '   which Google enforces by suspending the account without warning.'
    )
  }

  // A country in more than one feed gets two offers for the same product at
  // possibly different market prices. Legal, but it confuses attribution.
  const overlaps = {}
  for (const [feed, targets] of Object.entries(FEED_TARGETS)) {
    for (const country of targets) {
      if (!served.has(country)) continue
      overlaps[country] = overlaps[country] ?? []
      overlaps[country].push(feed)
    }
  }
  const doubled = Object.entries(overlaps).filter(([, feeds]) => feeds.length > 1)
  if (doubled.length > 0) {
    console.log('\nℹ️  Countries reachable from more than one feed:')
    for (const [country, feeds] of doubled) {
      console.log(`   ${country}: ${feeds.join(' + ')} — register only one, or the same product`)
      console.log('      competes with itself at two market prices.')
    }
  }

  if (result.assembly?.isOffered) {
    console.log(`\n🔧 Assembly is ON at ${result.assembly.feeEuros ?? 0} € — ${result.assembledGtins} product(s) have an assembled EAN.`)
    if (!result.assembledGtins) {
      console.error('❌ Assembly is offered but no product has gtinAssembled — the second offer would carry no barcode.')
      process.exit(1)
    }
  } else {
    console.log('\n🔧 Assembly is OFF — feeds emit one offer per product.')
  }

  console.log('')
}

main().catch((error) => {
  console.error('❌ check-feeds failed:', error.message)
  process.exit(1)
})
