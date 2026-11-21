/**
 * Home delivery to western Germany (North Rhine-Westphalia & Osnabrück) stops
 * being free and costs a flat fee (owner 2026-11-21: 99 €).
 *
 * The method keeps its code, zone and postal prefixes: only the price and the
 * wording change. The name and description must stop saying "free" in the same
 * write as the price, or the checkout would offer a "Free delivery" line that
 * costs money. The checkout, the Merchant feeds, llms.txt and the product
 * markup all read this document, so they follow without a deploy; the static
 * site copy (footer, FAQ, terms) was changed in the same commit as this script
 * and must be live BEFORE this runs.
 *
 * Idempotent: running it twice writes the same values.
 *
 * Run from cms/:
 *   npx sanity exec scripts/set-de-west-delivery-fee.mjs --with-user-token
 */
import { getCliClient } from 'sanity/cli'
const client = getCliClient({ apiVersion: '2024-01-01' })

const CODE = 'free-de-west'
const FEE_EUROS = 99

const doc = await client.fetch(`*[_type == "shippingMethod" && code == $code][0]{ _id, price }`, { code: CODE })
if (!doc?._id) { console.error(`${CODE} not found — nothing changed`); process.exit(1) }

await client.patch(doc._id).set({
  price: FEE_EUROS,
  name: {
    _type: 'localizedString',
    fr: 'Livraison à domicile (Rhénanie-du-Nord-Westphalie & Osnabrück)',
    en: 'Home delivery (North Rhine-Westphalia & Osnabrück)',
    de: 'Lieferung nach Hause (Nordrhein-Westfalen & Osnabrück)',
    nl: 'Thuislevering (Noordrijn-Westfalen & Osnabrück)',
    es: 'Entrega a domicilio (Renania del Norte-Westfalia y Osnabrück)',
    ar: 'توصيل إلى المنزل (شمال الراين-وستفاليا وأوسنابروك)',
  },
  description: {
    _type: 'localizedString',
    fr: 'Livraison à domicile dans l’ouest de l’Allemagne, à tarif fixe. Nous vous appelons pour convenir du créneau.',
    en: 'Home delivery in western Germany at a flat rate. We call you to arrange the slot.',
    de: 'Hauslieferung in Westdeutschland zum Pauschalpreis. Wir rufen Sie zur Terminabstimmung an.',
    nl: 'Thuislevering in het westen van Duitsland tegen een vast tarief. We bellen u om het moment af te spreken.',
    es: 'Entrega a domicilio en el oeste de Alemania con tarifa fija. Le llamamos para acordar la franja.',
    ar: 'توصيل إلى المنزل في غرب ألمانيا برسم ثابت. نتصل بك لتحديد الموعد.',
  },
}).commit()

console.log(`✅ ${CODE}: ${doc.price} € → ${FEE_EUROS} €`)
