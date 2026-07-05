/**
 * Creates the free-shipping method for Belgium + Netherlands (owner request
 * 2026-07-05). Idempotent: skips if code 'free-benelux' already exists.
 *
 * Run from cms/:  npx sanity exec scripts/add-free-shipping-benelux.mjs --with-user-token
 */
import { getCliClient } from 'sanity/cli'

const client = getCliClient({ apiVersion: '2024-01-01' })

const existing = await client.fetch(`*[_type == "shippingMethod" && code == "free-benelux"][0]{ _id }`)
if (existing?._id) {
  console.log('= free-benelux already exists:', existing._id)
} else {
  const doc = {
    _type: 'shippingMethod',
    code: 'free-benelux',
    name: {
      fr: 'Livraison gratuite (Belgique & Pays-Bas)',
      en: 'Free delivery (Belgium & Netherlands)',
      nl: 'Gratis verzending (België & Nederland)',
      de: 'Kostenloser Versand (Belgien & Niederlande)',
      es: 'Envío gratuito (Bélgica y Países Bajos)',
      ar: 'شحن مجاني (بلجيكا وهولندا)',
    },
    description: {
      fr: 'Livraison offerte — 3 à 5 jours ouvrés',
      en: 'Free shipping — 3–5 business days',
      nl: 'Gratis verzending — 3–5 werkdagen',
      de: 'Kostenloser Versand — 3–5 Werktage',
      es: 'Envío gratuito — 3–5 días laborables',
      ar: 'شحن مجاني — 3–5 أيام عمل',
    },
    estimatedDays: '3-5',
    price: 0,
    zones: ['BE', 'NL'],
    isActive: true,
    sortOrder: 1,
    carrier: { provider: 'manual' },
  }
  const created = await client.create(doc)
  console.log('+ Created free-benelux:', created._id)
}

// Visibility: list every method currently covering BE or NL so the owner
// sees exactly what those customers will be offered.
const all = await client.fetch(
  `*[_type == "shippingMethod" && isActive == true && ("BE" in zones || "NL" in zones)]
    | order(sortOrder asc){ code, "name": name.fr, price, freeAbove, zones }`
)
console.log('\nActive methods covering BE/NL:')
for (const m of all) {
  console.log(`  - ${m.code} · ${m.name} · ${m.price === 0 ? 'GRATUIT' : m.price + '€'}${m.freeAbove ? ` (gratuit dès ${m.freeAbove}€)` : ''} · zones: ${m.zones.join(',')}`)
}
