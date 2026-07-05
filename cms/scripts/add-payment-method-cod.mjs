/**
 * Cash on delivery payment method — LIVE for BE/NL (owner 2026-07-05):
 * our own delivery fleet collects cash at the door in those countries.
 * The `countries` field + the cod adapter both enforce the restriction.
 *
 * Idempotent. Run from cms/:
 *   npx sanity exec scripts/add-payment-method-cod.mjs --with-user-token
 */
import { getCliClient } from 'sanity/cli'
const client = getCliClient({ apiVersion: '2024-01-01' })

await client.createOrReplace({
  _id: 'paymentMethod-cod',
  _type: 'paymentMethod',
  code: 'cod',
  name: {
    _type: 'localizedString',
    fr: 'Paiement à la livraison',
    en: 'Cash on delivery',
    es: 'Pago contra reembolso',
    nl: 'Contant bij levering',
    de: 'Barzahlung bei Lieferung',
    ar: 'الدفع عند الاستلام',
  },
  description: {
    _type: 'localizedString',
    fr: 'Payez en espèces à notre livreur — Belgique et Pays-Bas uniquement',
    en: 'Pay our driver in cash — Belgium and the Netherlands only',
    es: 'Paga en efectivo a nuestro repartidor — solo Bélgica y Países Bajos',
    nl: 'Betaal contant aan onze bezorger — alleen België en Nederland',
    de: 'Zahlen Sie bar an unseren Fahrer — nur Belgien und Niederlande',
    ar: 'ادفع نقداً لسائقنا — بلجيكا وهولندا فقط',
  },
  countries: ['BE', 'NL'],
  icon: 'ph:money',
  isActive: true,
  sortOrder: 1,
})

console.log('✅ cod payment method created/updated (BE + NL, own fleet collects cash)')
