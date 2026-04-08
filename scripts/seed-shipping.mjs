import { createClient } from '@sanity/client'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function getSanityToken() {
  if (process.env.SANITY_TOKEN) return process.env.SANITY_TOKEN
  const configPaths = [
    join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'sanity', 'config.json'),
    join(process.env.APPDATA || '', 'sanity', 'config.json'),
  ]
  for (const p of configPaths) {
    if (existsSync(p)) {
      const config = JSON.parse(readFileSync(p, 'utf-8'))
      if (config.authToken) return config.authToken
    }
  }
  throw new Error('No Sanity token found. Set SANITY_TOKEN env var or run `npx sanity login`')
}

const client = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  token: getSanityToken(),
  apiVersion: '2024-01-01',
  useCdn: false,
})

const shippingMethods = [
  {
    _id: 'shipping-standard-fr',
    _type: 'shippingMethod',
    code: 'standard-fr',
    name: {
      fr: 'Livraison standard',
      en: 'Standard delivery',
      es: 'Entrega estándar',
      nl: 'Standaard levering',
      de: 'Standardlieferung',
      ar: 'توصيل عادي',
    },
    description: {
      fr: 'Livraison à domicile en France métropolitaine',
      en: 'Home delivery in mainland France',
      es: 'Entrega a domicilio en Francia metropolitana',
      nl: 'Thuislevering in Frankrijk',
      de: 'Haustürlieferung in Frankreich',
      ar: 'توصيل للمنزل في فرنسا',
    },
    estimatedDays: '5-7',
    price: 0,
    freeAbove: null,
    zones: ['FR'],
    isActive: true,
    sortOrder: 1,
  },
  {
    _id: 'shipping-express-fr',
    _type: 'shippingMethod',
    code: 'express-fr',
    name: {
      fr: 'Livraison express',
      en: 'Express delivery',
      es: 'Entrega express',
      nl: 'Expreslevering',
      de: 'Expresslieferung',
      ar: 'توصيل سريع',
    },
    description: {
      fr: 'Livraison rapide en 2-3 jours ouvrés',
      en: 'Fast delivery in 2-3 business days',
      es: 'Entrega rápida en 2-3 días hábiles',
      nl: 'Snelle levering in 2-3 werkdagen',
      de: 'Schnelle Lieferung in 2-3 Werktagen',
      ar: 'توصيل سريع خلال 2-3 أيام عمل',
    },
    estimatedDays: '2-3',
    price: 29.90,
    freeAbove: 2000,
    zones: ['FR'],
    isActive: true,
    sortOrder: 2,
  },
  {
    _id: 'shipping-relay-fr',
    _type: 'shippingMethod',
    code: 'relay-fr',
    name: {
      fr: 'Point relais',
      en: 'Relay point pickup',
      es: 'Punto de recogida',
      nl: 'Afhaalpunt',
      de: 'Paketshop',
      ar: 'نقطة استلام',
    },
    description: {
      fr: 'Retrait en point relais près de chez vous',
      en: 'Pick up at a relay point near you',
      es: 'Recogida en un punto de recogida cerca de ti',
      nl: 'Afhalen bij een afhaalpunt bij jou in de buurt',
      de: 'Abholung in einem Paketshop in Ihrer Nähe',
      ar: 'استلام من نقطة قريبة منك',
    },
    estimatedDays: '5-8',
    price: 0,
    freeAbove: null,
    zones: ['FR'],
    isActive: true,
    sortOrder: 3,
  },
  {
    _id: 'shipping-eu',
    _type: 'shippingMethod',
    code: 'standard-eu',
    name: {
      fr: 'Livraison Europe',
      en: 'European delivery',
      es: 'Entrega Europa',
      nl: 'Europese levering',
      de: 'Europaversand',
      ar: 'توصيل أوروبا',
    },
    description: {
      fr: 'Livraison dans les pays européens',
      en: 'Delivery to European countries',
      es: 'Entrega en países europeos',
      nl: 'Levering naar Europese landen',
      de: 'Lieferung in europäische Länder',
      ar: 'توصيل إلى الدول الأوروبية',
    },
    estimatedDays: '7-14',
    price: 49.90,
    freeAbove: 2500,
    zones: ['BE', 'LU', 'DE', 'NL', 'ES', 'IT', 'EU'],
    isActive: true,
    sortOrder: 4,
  },
]

async function seed() {
  console.log('🚚 Seeding shipping methods...\n')
  for (const method of shippingMethods) {
    await client.createOrReplace(method)
    console.log(`  ✅ ${method.name.fr} — ${method.price === 0 ? 'GRATUIT' : method.price + '€'} (${method.zones.join(', ')})`)
  }
  console.log('\n✅ Shipping methods seeded!')
}

seed().catch(err => {
  console.error('❌ Failed:', err.message)
  process.exit(1)
})
