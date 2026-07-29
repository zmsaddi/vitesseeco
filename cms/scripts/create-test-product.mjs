/**
 * The 0.01€ product used to live-test the payment flow.
 *
 * It writes a real, buyable, publicly listed product, so it refuses to touch
 * the production dataset unless the run is deliberate. Idempotent on the slug:
 * rerunning resets price/stock instead of creating a second live 0.01€ product.
 *
 * Run from cms/:
 *   npx sanity exec scripts/create-test-product.mjs --with-user-token -- --force
 *   (or ALLOW_PRODUCTION_TEST_PRODUCT=1 in the environment)
 * Delete the product from the Studio as soon as the test is finished.
 */
import { getCliClient } from 'sanity/cli'

const client = getCliClient({ apiVersion: '2024-01-01' })

const SLUG = 'test-paypal-001'
const dataset = client.config().dataset
const forced = process.argv.includes('--force') || process.env.ALLOW_PRODUCTION_TEST_PRODUCT === '1'

if (dataset === 'production' && !forced) {
  console.error(
    `❌ Refusing to publish a 0.01€ test product into dataset "${dataset}".\n` +
    '   It would be listed, indexable and orderable by real customers.\n' +
    '   Rerun deliberately: npx sanity exec scripts/create-test-product.mjs --with-user-token -- --force'
  )
  process.exit(1)
}

const doc = {
  _type: 'product',
  productType: 'accessory',
  name: {
    fr: 'TEST - Produit Test (0.01€)',
    en: 'TEST - Test Product (0.01€)',
    es: 'TEST - Producto Prueba (0.01€)',
    nl: 'TEST - Testproduct (0.01€)',
    de: 'TEST - Testprodukt (0.01€)',
    ar: 'TEST - منتج اختبار (0.01€)',
  },
  slug: { _type: 'slug', current: SLUG },
  sku: 'TEST-PAYPAL-001',
  price: 0.01,
  stock: 100,
  isAvailable: true,
  isOnSale: false,
  isNew: false,
  isFeatured: false,
  shortDescription: {
    fr: 'Produit de test — ne pas commander',
    en: 'Test product — do not order',
    es: 'Producto de prueba — no pedir',
    nl: 'Testproduct — niet bestellen',
    de: 'Testprodukt — nicht bestellen',
    ar: 'منتج اختبار — لا تطلبه',
  },
  images: [{
    _type: 'image',
    _key: 'img-test-1',
    asset: { _type: 'reference', _ref: 'image-93e7f0fdfc430de91e6c6fe5d012200c930f5ec0-1000x1000-webp' },
    altText: 'Test product placeholder',
  }],
}

const existing = await client.fetch(
  `*[_type == "product" && !(_id in path("drafts.**")) && slug.current == $slug][0]{ _id }`,
  { slug: SLUG }
)

if (existing?._id) {
  // Restore only what the payment test depends on — a previous test run may
  // have drained the stock or the owner may have hidden the product.
  await client.patch(existing._id).set({ price: 0.01, stock: 100, isAvailable: true }).commit()
  console.log('Reused:', existing._id, '| price 0.01€ · stock 100 · available')
} else {
  const result = await client.create(doc)
  console.log('Created:', result._id, '|', result.slug.current)
}

console.log('URL: https://vitesse-eco.fr/produits/' + SLUG)
