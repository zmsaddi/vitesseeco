import { getCliClient } from 'sanity/cli'

const client = getCliClient({ apiVersion: '2024-01-01' })

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
  slug: { _type: 'slug', current: 'test-paypal-001' },
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

const result = await client.create(doc)
console.log('Created:', result._id, '|', result.slug.current)
console.log('URL: https://vitesse-eco.fr/produits/' + result.slug.current)
