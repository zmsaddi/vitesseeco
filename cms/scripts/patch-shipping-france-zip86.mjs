/**
 * Scope free-france to the postal codes our OWN fleet actually serves
 * (owner 2026-07-05: dept 86 / Poitiers region only for now).
 * Extend the prefixes array as coverage grows.
 *
 * Run from cms/:
 *   npx sanity exec scripts/patch-shipping-france-zip86.mjs --with-user-token
 */
import { getCliClient } from 'sanity/cli'
const client = getCliClient({ apiVersion: '2024-01-01' })

const PREFIXES = ['86']

const doc = await client.fetch(`*[_type == "shippingMethod" && code == "free-france"][0]{ _id }`)
if (!doc?._id) { console.error('free-france not found — run add-free-shipping-france.mjs first'); process.exit(1) }

await client.patch(doc._id).set({
  postalCodePrefixes: PREFIXES,
  description: {
    _type: 'localizedString',
    fr: 'Livraison gratuite à domicile par notre propre service — région de Poitiers (86)',
    en: 'Free home delivery by our own service — Poitiers region (dept 86)',
    es: 'Entrega a domicilio gratuita con nuestro propio servicio — región de Poitiers (86)',
    nl: 'Gratis thuisbezorging door onze eigen dienst — regio Poitiers (86)',
    de: 'Kostenlose Lieferung durch unseren eigenen Dienst — Region Poitiers (86)',
    ar: 'توصيل مجاني بخدمتنا الخاصة — منطقة بواتييه (86)',
  },
}).commit()

console.log(`✅ free-france scoped to postal prefixes: ${PREFIXES.join(', ')}`)
