import { createClient } from '@sanity/client'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function getSanityToken() {
  if (process.env.SANITY_TOKEN) return process.env.SANITY_TOKEN
  const paths = [
    join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'sanity', 'config.json'),
    join(process.env.APPDATA || '', 'sanity', 'config.json'),
  ]
  for (const p of paths) {
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

// ============ PRODUCT SEO DATA ============
const productSeo = [
  {
    _id: 'prod-v20-mini',
    title: 'V20 Mini — Fatbike Électrique Ado | Vitesse Eco',
    description: 'Fatbike électrique compact pour ados. Moteur 250W, batterie 36V 13AH, autonomie 30-40 km. À partir de 999€. Livraison gratuite.',
  },
  {
    _id: 'prod-v20-pro',
    title: 'V20 Pro — Bestseller Fatbike | Vitesse Eco',
    description: 'Notre bestseller avec sièges extensibles. Moteur 250W, batterie 48V 15.6AH, autonomie 40-50 km. 1299€. Livraison offerte.',
  },
  {
    _id: 'prod-v20-limited',
    title: 'V20 Limited — Fatbike Confort | Vitesse Eco',
    description: 'Fatbike confort avec selle longue exclusive. Batterie 48V 18.2AH, autonomie 50-60 km. 1399€. Livraison gratuite en France.',
  },
  {
    _id: 'prod-s20-pro',
    title: 'S20 Pro — Design Unique | Vitesse Eco',
    description: 'Fatbike au design unique avec selle innovante. Batterie 48V 18.2AH, autonomie 50-60 km. 1499€. Livraison offerte.',
  },
  {
    _id: 'prod-v20-cross',
    title: 'V20 Cross — Fatbike Tout-Terrain | Vitesse Eco',
    description: 'Fatbike tout-terrain avec enceinte Bluetooth intégrée. Batterie 48V 22AH, autonomie 60-70 km. 1599€. Livraison gratuite.',
  },
  {
    _id: 'prod-q30',
    title: 'Q30 Pliable — Fatbike Pliant | Vitesse Eco',
    description: 'Fatbike pliable, rangement facile. Batterie 48V 15.6AH, autonomie 40-50 km. 1399€. Se range dans un coffre. Livraison offerte.',
  },
  {
    _id: 'prod-d50',
    title: 'D50 — Fatbike Lady | Vitesse Eco',
    description: 'Fatbike élégant pour femmes avec selle amovible. Batterie 48V 18.2AH, autonomie 50-60 km. 1349€. 5 coloris disponibles.',
  },
  {
    _id: 'prod-c28',
    title: 'C28 — Fatbike Féminin | Vitesse Eco',
    description: 'Fatbike féminin léger et élégant. Batterie 48V 15.6AH, autonomie 40-50 km. 1199€. 4 coloris exclusifs. Livraison gratuite.',
  },
  {
    _id: 'prod-eb30',
    title: 'EB30 — Double Batterie 100km | Vitesse Eco',
    description: 'Fatbike double batterie avec panier intégré. 2x 15.6AH pour 90-100 km d\'autonomie. 1799€. Livraison offerte en France.',
  },
  {
    _id: 'prod-v20-max',
    title: 'V20 Max — Fatbike Grand Gabarit | Vitesse Eco',
    description: 'Fatbike pour grands gabarits (175cm+). Pneus 24", batterie 48V 18.2AH, autonomie 50-60 km. 1499€. Livraison gratuite.',
  },
  {
    _id: 'prod-v20-limited-pro',
    title: 'V20 Limited Pro — Autonomie Max | Vitesse Eco',
    description: 'Autonomie maximale : ~100 km grâce à deux batteries 48V 15.6AH. Notre modèle longue distance. 1899€. Livraison offerte.',
  },
]

// ============ PAGE SEO DATA ============
const pageSeo = [
  {
    _id: 'homePage',
    title: 'Vitesse Eco — Fatbikes Électriques Premium',
    description: 'Découvrez notre gamme de fatbikes électriques. Livraison gratuite en France. 11 modèles de 999€ à 1899€.',
  },
  {
    _id: 'aboutPage',
    title: 'À Propos — Vitesse Eco',
    description: 'Vitesse Eco, votre spécialiste en fatbikes électriques à Poitiers. SAS SIREN 100 732 247.',
  },
  {
    _id: 'contactPage',
    title: 'Contact — Vitesse Eco',
    description: 'Contactez Vitesse Eco à Poitiers. Email: contact@vitesse-eco.fr. Lun-Sam 9h-18h.',
  },
]

async function fillSeo() {
  console.log('🔍 Filling SEO data in Sanity...\n')

  // Products
  console.log('🚲 Patching product SEO...')
  for (const p of productSeo) {
    try {
      await client.patch(p._id).set({
        'seo.title': p.title,
        'seo.description': p.description,
      }).commit()
      console.log(`   ✅ ${p._id}: ${p.title}`)
    } catch (err) {
      console.error(`   ❌ ${p._id}: ${err.message}`)
    }
  }

  // Pages
  console.log('\n📄 Patching page SEO...')
  for (const p of pageSeo) {
    try {
      await client.patch(p._id).set({
        'seo.title': p.title,
        'seo.description': p.description,
      }).commit()
      console.log(`   ✅ ${p._id}: ${p.title}`)
    } catch (err) {
      console.error(`   ❌ ${p._id}: ${err.message}`)
    }
  }

  console.log('\n✅ SEO data fill complete!')
}

fillSeo().catch(console.error)
