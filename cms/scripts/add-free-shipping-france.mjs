/**
 * Free home delivery for FRANCE (customer bug report 2026-07-05: choosing
 * France at checkout offered ONLY store pickup — no delivery method with
 * zone FR ever existed in Sanity, while the CGV/JSON-LD promise free FR
 * delivery in 48–72h).
 *
 * Idempotent. Run from cms/:
 *   npx sanity exec scripts/add-free-shipping-france.mjs --with-user-token
 */
import { getCliClient } from 'sanity/cli'

const client = getCliClient({ apiVersion: '2024-01-01' })

const existing = await client.fetch(`*[_type == "shippingMethod" && code == "free-france"][0]{ _id }`)

const name = {
  _type: 'localizedString',
  fr: 'Livraison gratuite (France)',
  en: 'Free delivery (France)',
  es: 'Entrega gratuita (Francia)',
  nl: 'Gratis levering (Frankrijk)',
  de: 'Kostenlose Lieferung (Frankreich)',
  ar: 'توصيل مجاني (فرنسا)',
}

const description = {
  _type: 'localizedString',
  fr: 'Livraison à domicile offerte — 48 à 72 h ouvrées',
  en: 'Free home delivery — 48–72 business hours',
  es: 'Entrega a domicilio gratuita — 48–72 h laborables',
  nl: 'Gratis thuisbezorging — 48–72 werkuren',
  de: 'Kostenlose Lieferung nach Hause — 48–72 Werkstunden',
  ar: 'توصيل مجاني إلى المنزل — 48 إلى 72 ساعة عمل',
}

const settings = {
  code: 'free-france',
  estimatedDays: '2-3',
  price: 0,
  zones: ['FR'],
  isActive: true,
  sortOrder: 1,
}

let id
if (existing?._id) {
  // Patch, never replace: postalCodePrefixes and the matching description are
  // owned by patch-shipping-france-zip86.mjs. Overwriting them would reopen
  // free home delivery to the whole of France — a real cost per order.
  const updated = await client.patch(existing._id).set(settings).setIfMissing({ name, description }).commit()
  id = updated._id
} else {
  const created = await client.create({ _type: 'shippingMethod', ...settings, name, description })
  id = created._id
}
console.log(`✅ free-france ${existing?._id ? 'updated' : 'created'}: ${id}`)

const all = await client.fetch(
  `*[_type == "shippingMethod" && isActive == true] | order(sortOrder asc){ code, price, zones, postalCodePrefixes }`
)
console.log('\nActive methods:')
for (const m of all) {
  const scope = m.postalCodePrefixes?.length ? ` · postal: ${m.postalCodePrefixes.join(',')}` : ''
  console.log(`  - ${m.code} · ${m.price}€ · zones: ${(m.zones || []).join(',')}${scope}`)
}
