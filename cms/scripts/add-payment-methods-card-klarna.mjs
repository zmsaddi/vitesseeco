/**
 * Creates the checkout documents for the two upcoming payment methods
 * (owner decision 2026-07-05): bank card (code `stripe`) and Klarna.
 *
 * Idempotent: fixed _ids + createOrReplace — safe to rerun.
 *
 * NOTE the double gate: these docs use isActive:true, but checkout only
 * shows a method when its env flag is ALSO on (ENABLE_STRIPE /
 * ENABLE_KLARNA). So running this script changes NOTHING visible until
 * the flags are set in Vercel after the PSP contracts are signed.
 *
 * Run from cms/:
 *   npx sanity exec scripts/add-payment-methods-card-klarna.mjs --with-user-token
 */
import { getCliClient } from 'sanity/cli'

const client = getCliClient({ apiVersion: '2024-01-01' })

const docs = [
  {
    _id: 'paymentMethod-card',
    _type: 'paymentMethod',
    code: 'stripe',
    name: {
      _type: 'localizedString',
      fr: 'Carte bancaire',
      en: 'Credit / debit card',
      es: 'Tarjeta bancaria',
      nl: 'Bankkaart',
      de: 'Kredit-/Debitkarte',
      ar: 'بطاقة بنكية',
    },
    description: {
      _type: 'localizedString',
      fr: 'Visa, Mastercard, CB — paiement sécurisé',
      en: 'Visa, Mastercard — secure payment',
      es: 'Visa, Mastercard — pago seguro',
      nl: 'Visa, Mastercard, Bancontact — veilig betalen',
      de: 'Visa, Mastercard — sichere Zahlung',
      ar: 'Visa، Mastercard — دفع آمن',
    },
    icon: 'ph:credit-card',
    isActive: true,
    sortOrder: 2,
  },
  {
    _id: 'paymentMethod-klarna',
    _type: 'paymentMethod',
    code: 'klarna',
    name: {
      _type: 'localizedString',
      fr: 'Klarna',
      en: 'Klarna',
      es: 'Klarna',
      nl: 'Klarna',
      de: 'Klarna',
      ar: 'Klarna',
    },
    description: {
      _type: 'localizedString',
      fr: 'Payez en 3 fois ou sous 30 jours',
      en: 'Pay in 3 instalments or within 30 days',
      es: 'Paga en 3 plazos o en 30 días',
      nl: 'Betaal in 3 termijnen of binnen 30 dagen',
      de: 'In 3 Raten oder in 30 Tagen bezahlen',
      ar: 'ادفع على 3 دفعات أو خلال 30 يوماً',
    },
    icon: 'ph:shopping-bag',
    isActive: true,
    sortOrder: 3,
  },
]

for (const doc of docs) {
  await client.createOrReplace(doc)
  console.log(`✅ ${doc.code} → ${doc.name.fr} (${doc._id})`)
}
console.log('\nDone. Nothing appears in checkout until ENABLE_STRIPE / ENABLE_KLARNA are set in Vercel.')
