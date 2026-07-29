/**
 * Who the shop is, as one set of facts.
 *
 * These appear in the structured data, in the legal pages, in the feeds and in
 * the contact details. They are here so that changing an address or a phone
 * number is one edit rather than a search — and so that the Organization Google
 * reads and the Impressum a German customer reads cannot disagree, which is the
 * kind of inconsistency that costs a Knowledge Panel.
 */
export const ORGANISATION = {
  legalName: 'VITESSE ECO SAS',
  name: 'Vitesse Eco',
  siren: '100 732 247',
  vatNumber: 'FR43 100 732 247',
  email: 'contact@vitesse-eco.fr',
  phone: '+33 7 45 83 00 49',
  whatsapp: 'https://wa.me/33745830049',
  address: {
    street: '32 Rue du Faubourg du Pont Neuf',
    postalCode: '86000',
    city: 'Poitiers',
    region: 'Nouvelle-Aquitaine',
    country: 'FR',
  },
  /** Poitiers, for the LocalBusiness entry. */
  geo: { latitude: 46.5802, longitude: 0.3404 },
  /** Countries the own fleet delivers to, as ISO codes. */
  deliversTo: ['FR', 'BE', 'NL'],
} as const

export const SITE_URL = 'https://vitesse-eco.fr'

/**
 * The return policy, stated once.
 *
 * Google reads `hasMerchantReturnPolicy` on an offer and shows it in Shopping.
 * The figures here must match the withdrawal page: a policy that says fourteen
 * days in the markup and thirty on the page is a mismatch a shopper will find.
 */
export const RETURN_POLICY = {
  /** The EU statutory withdrawal period. */
  returnDays: 14,
  /** The customer bears the direct cost of returning the goods (art. L221-23). */
  returnFeesCustomerResponsibility: true,
  applicableCountries: ['FR', 'BE', 'NL', 'LU', 'DE', 'ES'],
} as const
