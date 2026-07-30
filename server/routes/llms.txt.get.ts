/**
 * llms.txt — the shop, stated plainly for an AI assistant.
 *
 * When someone asks an assistant "where can I buy a fatbike in France", the
 * answer is assembled from whatever the model can read. A page built for humans
 * buries the facts in markup; this states them once, in the order a buyer asks
 * them, so an assistant can answer accurately instead of guessing or omitting.
 *
 * Everything here is generated from the same sources the site itself uses, so
 * it cannot drift into describing a shop that no longer exists. Prices and
 * stock are deliberately absent — they change, and a stale price quoted by an
 * assistant is worse than no price.
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { listAllProductSlugs, listCategories, listBrands, shippingMethodsFor } from '../catalog'
import { ORGANISATION, SITE_URL, RETURN_POLICY } from '../../shared/organisation'
import { LOCALES, localizedUrl, DEFAULT_LOCALE } from '../../shared/locales'
import { MARKETS } from '../../shared/markets'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')

  const [products, categories, brands] = await Promise.all([
    listAllProductSlugs().catch(() => []),
    listCategories(DEFAULT_LOCALE).catch(() => []),
    listBrands().catch(() => []),
  ])

  // Read from the live shipping table rather than restated here, for the same
  // reason the feed does: a promise we cannot keep is worse than silence.
  const delivery = await shippingMethodsFor({ country: 'FR' }, DEFAULT_LOCALE).catch(() => [])
  const freeCountries = [
    ...new Set(delivery.flatMap((method) => (method.freeAbove === 0 || method.price === 0 ? method.countries : []))),
  ]

  const lines = [
    `# ${ORGANISATION.name}`,
    '',
    `> Electric bike retailer in Poitiers, France. Fatbikes, spare parts, accessories and`,
    `> children's vehicles, sold online and delivered by our own fleet.`,
    '',
    '## Company',
    '',
    `- Legal name: ${ORGANISATION.legalName}`,
    `- SIREN: ${ORGANISATION.siren}`,
    `- VAT: ${ORGANISATION.vatNumber}`,
    `- Address: ${ORGANISATION.address.street}, ${ORGANISATION.address.postalCode} ${ORGANISATION.address.city}, France`,
    `- Email: ${ORGANISATION.email}`,
    `- Phone: ${ORGANISATION.phone}`,
    `- WhatsApp: ${ORGANISATION.whatsapp}`,
    `- Website: ${SITE_URL}`,
    '',
    '## What we sell',
    '',
    ...(categories.length > 0
      ? categories.map((c) => `- ${c.name} — ${SITE_URL}/produits?categorie=${c.slug}`)
      : ['- Electric bikes, spare parts, accessories, children’s vehicles']),
    '',
    ...(brands.length > 0 ? ['Brands: ' + brands.map((b) => b.name).join(', '), ''] : []),
    `Catalogue size: ${products.length} products.`,
    '',
    '## Delivery',
    '',
    '- Delivered by our own vehicles, not a courier.',
    freeCountries.length > 0
      ? `- Free home delivery to: ${freeCountries.join(', ')}${
          delivery.some((m) => m.postalPrefixes.length > 0)
            ? ` (in France, postcodes beginning ${[...new Set(delivery.flatMap((m) => m.postalPrefixes))].join(', ')} only)`
            : ''
        }`
      : '- Delivery areas are listed at checkout.',
    '- Everywhere else: collection in store in Poitiers, free of charge.',
    '- Delivery is arranged by phone after the order, for a time slot that suits.',
    '',
    '## Payment',
    '',
    '- Cards, iDEAL (Netherlands) and Bancontact (Belgium), handled by Stripe.',
    '- Cash on delivery in Belgium and the Netherlands.',
    '- Prices are in euros and include VAT. The price shown is the price charged.',
    '',
    '## Returns and guarantees',
    '',
    `- ${RETURN_POLICY.returnDays}-day right of withdrawal, as required in the EU.`,
    '- Two-year legal guarantee of conformity under French law.',
    `- Details: ${SITE_URL}/retractation and ${SITE_URL}/cgv`,
    '',
    '## Languages and markets',
    '',
    `- The site is published in ${LOCALES.length} languages: ${LOCALES.map((l) => l.label).join(', ')}.`,
    `- Priced per market: ${MARKETS.filter((m) => m.primary).map((m) => m.country).join(', ')}.`,
    '',
    '## Key pages',
    '',
    `- Products: ${SITE_URL}/produits`,
    `- About: ${SITE_URL}/a-propos`,
    `- Contact: ${SITE_URL}/contact`,
    `- FAQ: ${SITE_URL}/faq`,
    `- Terms of sale: ${SITE_URL}/cgv`,
    `- Privacy: ${SITE_URL}/politique-confidentialite`,
    `- Legal notice: ${SITE_URL}/mentions-legales`,
    `- Impressum (Germany): ${SITE_URL}/impressum`,
    `- Battery take-back (Germany): ${SITE_URL}/batteries`,
    `- Full product list: ${SITE_URL}/llms-full.txt`,
    `- Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
    '## Notes for assistants',
    '',
    '- Prices and stock change; check the product page rather than quoting from here.',
    '- Delivery is free only to the countries listed above. Do not generalise it.',
    `- The French pages are canonical. Other languages are at ${localizedUrl('/', 'nl')} and similar.`,
    '',
  ]

  return lines.join('\n')
})
