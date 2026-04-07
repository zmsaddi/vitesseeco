import { createClient } from '@sanity/client'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load token from Sanity CLI config
const sanityConfig = JSON.parse(readFileSync('C:/Users/ZAKARIYA/.config/sanity/config.json', 'utf-8'))

const client = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  token: sanityConfig.authToken,
  apiVersion: '2024-01-01',
  useCdn: false,
})

// ============ CATEGORIES ============
const categories = [
  { _id: 'cat-urban', name: { fr: 'Urbain', es: 'Urbano', nl: 'Stedelijk', de: 'Urban' }, slug: { current: 'urbain' }, sortOrder: 1 },
  { _id: 'cat-offroad', name: { fr: 'Tout-Terrain', es: 'Todo Terreno', nl: 'Off-Road', de: 'Gelände' }, slug: { current: 'tout-terrain' }, sortOrder: 2 },
  { _id: 'cat-pliable', name: { fr: 'Pliable', es: 'Plegable', nl: 'Opvouwbaar', de: 'Faltbar' }, slug: { current: 'pliable' }, sortOrder: 3 },
  { _id: 'cat-lady', name: { fr: 'Lady', es: 'Lady', nl: 'Lady', de: 'Lady' }, slug: { current: 'lady' }, sortOrder: 4 },
  { _id: 'cat-longrange', name: { fr: 'Longue Autonomie', es: 'Gran Autonomía', nl: 'Lange Afstand', de: 'Langstrecke' }, slug: { current: 'longue-autonomie' }, sortOrder: 5 },
]

// ============ BRAND ============
const brand = {
  _id: 'brand-qmwheel',
  _type: 'brand',
  name: 'QMWHEEL',
  slug: { _type: 'slug', current: 'qmwheel' },
}

// ============ PRODUCTS ============
const products = [
  {
    _id: 'prod-v20-mini',
    name: { fr: 'V20 Mini', es: 'V20 Mini', nl: 'V20 Mini', de: 'V20 Mini' },
    slug: { current: 'v20-mini' },
    category: 'cat-urban',
    shortDescription: {
      fr: 'Fatbike compact pour adolescents',
      es: 'Fatbike compacta para adolescentes',
      nl: 'Compacte fatbike voor tieners',
      de: 'Kompaktes Fatbike für Jugendliche',
    },
    description: {
      fr: 'Le V20 Mini est le modèle idéal pour les jeunes riders. Compact et maniable avec ses pneus 16 pouces, il offre une autonomie de 30 à 40 km. Parfait pour les trajets quotidiens et les balades en ville.',
      es: 'El V20 Mini es el modelo ideal para jóvenes ciclistas. Compacto y manejable con neumáticos de 16 pulgadas, ofrece una autonomía de 30 a 40 km.',
      nl: 'De V20 Mini is het ideale model voor jonge rijders. Compact en wendbaar met 16-inch banden, biedt het een bereik van 30 tot 40 km.',
      de: 'Das V20 Mini ist das ideale Modell für junge Fahrer. Kompakt und wendig mit 16-Zoll-Reifen bietet es eine Reichweite von 30 bis 40 km.',
    },
    price: 999,
    isNew: false, isFeatured: false, isOnSale: false, isAvailable: true, sortOrder: 1,
    specs: { motor: '250W', battery: '36V 13AH', tireSize: '16"', range: '30-40 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Rose Gold', es: 'Rosa dorado', nl: 'Roségoud', de: 'Roségold' }, colorHex: '#B76E79', sku: 'V20MINI-RSG', stock: 10 },
      { colorName: { fr: 'Violet', es: 'Violeta', nl: 'Paars', de: 'Violett' }, colorHex: '#6A0DAD', sku: 'V20MINI-VIO', stock: 8 },
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'V20MINI-BLK', stock: 12 },
      { colorName: { fr: 'Vert', es: 'Verde', nl: 'Groen', de: 'Grün' }, colorHex: '#4ADE80', sku: 'V20MINI-GRN', stock: 6 },
      { colorName: { fr: 'Gris Nardo', es: 'Gris Nardo', nl: 'Nardo Grijs', de: 'Nardo Grau' }, colorHex: '#8E8E8E', sku: 'V20MINI-GRY', stock: 7 },
    ],
  },
  {
    _id: 'prod-v20-pro',
    name: { fr: 'V20 Pro', es: 'V20 Pro', nl: 'V20 Pro', de: 'V20 Pro' },
    slug: { current: 'v20-pro' },
    category: 'cat-urban',
    shortDescription: {
      fr: 'Notre bestseller — sièges extensibles',
      es: 'Nuestro superventas — asientos extensibles',
      nl: 'Onze bestseller — uitbreidbare stoelen',
      de: 'Unser Bestseller — erweiterbare Sitze',
    },
    description: {
      fr: 'Le V20 Pro est notre modèle phare. Avec sa batterie 48V 15.6AH et ses sièges extensibles, il est parfait pour les trajets urbains et les longues balades. Autonomie de 40 à 50 km.',
      es: 'El V20 Pro es nuestro modelo estrella. Con batería de 48V 15.6AH y asientos extensibles, perfecto para trayectos urbanos.',
      nl: 'De V20 Pro is ons topmodel. Met 48V 15.6AH accu en uitbreidbare stoelen, perfect voor stadsritten.',
      de: 'Das V20 Pro ist unser Flaggschiff. Mit 48V 15.6AH Akku und erweiterbaren Sitzen, perfekt für Stadtfahrten.',
    },
    price: 1299,
    isNew: false, isFeatured: true, isOnSale: false, isAvailable: true, sortOrder: 2,
    specs: { motor: '250W', battery: '48V 15.6AH', tireSize: '20"', range: '40-50 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'V20PRO-BLK', stock: 15 },
      { colorName: { fr: 'Gris Nardo', es: 'Gris Nardo', nl: 'Nardo Grijs', de: 'Nardo Grau' }, colorHex: '#8E8E8E', sku: 'V20PRO-GRY', stock: 10 },
      { colorName: { fr: 'Gris Foncé', es: 'Gris Oscuro', nl: 'Donkergrijs', de: 'Dunkelgrau' }, colorHex: '#4A4A4A', sku: 'V20PRO-DGY', stock: 8 },
    ],
  },
  {
    _id: 'prod-v20-limited',
    name: { fr: 'V20 Limited', es: 'V20 Limited', nl: 'V20 Limited', de: 'V20 Limited' },
    slug: { current: 'v20-limited' },
    category: 'cat-urban',
    shortDescription: {
      fr: 'Selle longue — confort premium',
      es: 'Asiento largo — confort premium',
      nl: 'Lang zadel — premium comfort',
      de: 'Langer Sattel — Premium-Komfort',
    },
    description: {
      fr: 'Le V20 Limited combine style et confort avec sa selle longue exclusive. Batterie 48V 18.2AH pour une autonomie de 50 à 60 km.',
      es: 'El V20 Limited combina estilo y confort con su asiento largo exclusivo. Batería 48V 18.2AH.',
      nl: 'De V20 Limited combineert stijl en comfort met zijn exclusieve lange zadel. 48V 18.2AH accu.',
      de: 'Das V20 Limited kombiniert Stil und Komfort mit seinem exklusiven langen Sattel. 48V 18.2AH Akku.',
    },
    price: 1399,
    isNew: false, isFeatured: false, isOnSale: false, isAvailable: true, sortOrder: 3,
    specs: { motor: '250W', battery: '48V 18.2AH', tireSize: '20"', range: '50-60 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'V20LTD-BLK', stock: 10 },
      { colorName: { fr: 'Gris Nardo', es: 'Gris Nardo', nl: 'Nardo Grijs', de: 'Nardo Grau' }, colorHex: '#8E8E8E', sku: 'V20LTD-GRY', stock: 8 },
      { colorName: { fr: 'Gris Foncé', es: 'Gris Oscuro', nl: 'Donkergrijs', de: 'Dunkelgrau' }, colorHex: '#4A4A4A', sku: 'V20LTD-DGY', stock: 5 },
      { colorName: { fr: 'Marron', es: 'Marrón', nl: 'Bruin', de: 'Braun' }, colorHex: '#8B4513', sku: 'V20LTD-BRN', stock: 6 },
    ],
  },
  {
    _id: 'prod-s20-pro',
    name: { fr: 'S20 Pro', es: 'S20 Pro', nl: 'S20 Pro', de: 'S20 Pro' },
    slug: { current: 's20-pro' },
    category: 'cat-urban',
    shortDescription: {
      fr: 'Design unique — selle innovante',
      es: 'Diseño único — asiento innovador',
      nl: 'Uniek ontwerp — innovatief zadel',
      de: 'Einzigartiges Design — innovativer Sattel',
    },
    description: {
      fr: 'Le S20 Pro se distingue par son design unique et sa selle au style innovant. Batterie 48V 18.2AH, autonomie 50-60 km.',
      es: 'El S20 Pro se distingue por su diseño único y su asiento innovador. Batería 48V 18.2AH.',
      nl: 'De S20 Pro onderscheidt zich door zijn unieke ontwerp en innovatief zadel. 48V 18.2AH accu.',
      de: 'Das S20 Pro zeichnet sich durch sein einzigartiges Design und seinen innovativen Sattel aus.',
    },
    price: 1499,
    isNew: true, isFeatured: false, isOnSale: false, isAvailable: true, sortOrder: 4,
    specs: { motor: '250W', battery: '48V 18.2AH', tireSize: '20"', range: '50-60 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'S20PRO-BLK', stock: 12 },
      { colorName: { fr: 'Gris Nardo', es: 'Gris Nardo', nl: 'Nardo Grijs', de: 'Nardo Grau' }, colorHex: '#8E8E8E', sku: 'S20PRO-GRY', stock: 7 },
      { colorName: { fr: 'Gris Foncé', es: 'Gris Oscuro', nl: 'Donkergrijs', de: 'Dunkelgrau' }, colorHex: '#4A4A4A', sku: 'S20PRO-DGY', stock: 6 },
    ],
  },
  {
    _id: 'prod-v20-cross',
    name: { fr: 'V20 Cross', es: 'V20 Cross', nl: 'V20 Cross', de: 'V20 Cross' },
    slug: { current: 'v20-cross' },
    category: 'cat-offroad',
    shortDescription: {
      fr: 'Tout-terrain + enceinte Bluetooth',
      es: 'Todo terreno + altavoz Bluetooth',
      nl: 'Off-road + Bluetooth speaker',
      de: 'Gelände + Bluetooth-Lautsprecher',
    },
    description: {
      fr: 'Le V20 Cross est conçu pour l\'aventure. Pneus 70/100-17, batterie 48V 22AH pour 60-70 km d\'autonomie, et enceinte Bluetooth intégrée.',
      es: 'El V20 Cross está diseñado para la aventura. Neumáticos 70/100-17, batería 48V 22AH y altavoz Bluetooth.',
      nl: 'De V20 Cross is ontworpen voor avontuur. 70/100-17 banden, 48V 22AH accu en Bluetooth speaker.',
      de: 'Das V20 Cross ist für Abenteuer konzipiert. 70/100-17 Reifen, 48V 22AH Akku und Bluetooth-Lautsprecher.',
    },
    price: 1599,
    isNew: false, isFeatured: true, isOnSale: true, compareAtPrice: 1799, isAvailable: true, sortOrder: 5,
    specs: { motor: '250W', battery: '48V 22AH', tireSize: '70/100-17"', range: '60-70 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'V20CRS-BLK', stock: 8 },
    ],
  },
  {
    _id: 'prod-q30',
    name: { fr: 'Q30 Pliable', es: 'Q30 Plegable', nl: 'Q30 Opvouwbaar', de: 'Q30 Faltbar' },
    slug: { current: 'q30' },
    category: 'cat-pliable',
    shortDescription: {
      fr: 'Pliable — rangement facile',
      es: 'Plegable — fácil almacenamiento',
      nl: 'Opvouwbaar — makkelijk op te bergen',
      de: 'Faltbar — einfache Aufbewahrung',
    },
    description: {
      fr: 'Le Q30 est notre modèle pliable. Se range facilement dans un coffre ou un placard. Batterie 48V 15.6AH, autonomie 40-50 km.',
      es: 'El Q30 es nuestro modelo plegable. Se guarda fácilmente en un maletero. Batería 48V 15.6AH.',
      nl: 'De Q30 is ons opvouwbare model. Past makkelijk in een kofferbak. 48V 15.6AH accu.',
      de: 'Das Q30 ist unser faltbares Modell. Passt leicht in einen Kofferraum. 48V 15.6AH Akku.',
    },
    price: 1399,
    isNew: true, isFeatured: true, isOnSale: false, isAvailable: true, sortOrder: 6,
    specs: { motor: '250W', battery: '48V 15.6AH', tireSize: '20"', range: '40-50 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'Q30-BLK', stock: 10 },
      { colorName: { fr: 'Gris Nardo', es: 'Gris Nardo', nl: 'Nardo Grijs', de: 'Nardo Grau' }, colorHex: '#8E8E8E', sku: 'Q30-GRY', stock: 7 },
      { colorName: { fr: 'Blanc', es: 'Blanco', nl: 'Wit', de: 'Weiß' }, colorHex: '#FFFFFF', sku: 'Q30-WHT', stock: 5 },
    ],
  },
  {
    _id: 'prod-d50',
    name: { fr: 'D50', es: 'D50', nl: 'D50', de: 'D50' },
    slug: { current: 'd50' },
    category: 'cat-lady',
    shortDescription: {
      fr: 'Lady friendly — selle amovible',
      es: 'Lady friendly — asiento extraíble',
      nl: 'Lady friendly — afneembaar zadel',
      de: 'Lady friendly — abnehmbarer Sattel',
    },
    description: {
      fr: 'Le D50 est pensé pour les femmes avec un design élégant et une selle amovible. Batterie 48V 18.2AH pour 50-60 km d\'autonomie.',
      es: 'El D50 está pensado para mujeres con un diseño elegante y asiento extraíble. Batería 48V 18.2AH.',
      nl: 'De D50 is ontworpen voor vrouwen met een elegant ontwerp en afneembaar zadel. 48V 18.2AH accu.',
      de: 'Das D50 ist für Frauen konzipiert mit elegantem Design und abnehmbarem Sattel. 48V 18.2AH Akku.',
    },
    price: 1349,
    isNew: false, isFeatured: false, isOnSale: false, isAvailable: true, sortOrder: 7,
    specs: { motor: '250W', battery: '48V 18.2AH', tireSize: '20"', range: '50-60 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'D50-BLK', stock: 8 },
      { colorName: { fr: 'Vert', es: 'Verde', nl: 'Groen', de: 'Grün' }, colorHex: '#4ADE80', sku: 'D50-GRN', stock: 6 },
      { colorName: { fr: 'Beige', es: 'Beige', nl: 'Beige', de: 'Beige' }, colorHex: '#F5F5DC', sku: 'D50-BEG', stock: 5 },
      { colorName: { fr: 'Gris Foncé', es: 'Gris Oscuro', nl: 'Donkergrijs', de: 'Dunkelgrau' }, colorHex: '#4A4A4A', sku: 'D50-DGY', stock: 7 },
      { colorName: { fr: 'Violet', es: 'Violeta', nl: 'Paars', de: 'Violett' }, colorHex: '#6A0DAD', sku: 'D50-VIO', stock: 4 },
    ],
  },
  {
    _id: 'prod-c28',
    name: { fr: 'C28', es: 'C28', nl: 'C28', de: 'C28' },
    slug: { current: 'c28' },
    category: 'cat-lady',
    shortDescription: {
      fr: 'Lady friendly — design féminin',
      es: 'Lady friendly — diseño femenino',
      nl: 'Lady friendly — vrouwelijk design',
      de: 'Lady friendly — feminines Design',
    },
    description: {
      fr: 'Le C28 est un fatbike au design pensé pour les femmes. Léger, élégant et disponible en couleurs exclusives. Batterie 48V 15.6AH.',
      es: 'El C28 es una fatbike con diseño femenino. Ligera, elegante y disponible en colores exclusivos.',
      nl: 'De C28 is een fatbike met vrouwelijk ontwerp. Licht, elegant en beschikbaar in exclusieve kleuren.',
      de: 'Das C28 ist ein Fatbike mit femininem Design. Leicht, elegant und in exklusiven Farben erhältlich.',
    },
    price: 1199,
    isNew: false, isFeatured: false, isOnSale: false, isAvailable: true, sortOrder: 8,
    specs: { motor: '250W', battery: '48V 15.6AH', tireSize: '20"', range: '40-50 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'C28-BLK', stock: 9 },
      { colorName: { fr: 'Rose Gold', es: 'Rosa dorado', nl: 'Roségoud', de: 'Roségold' }, colorHex: '#B76E79', sku: 'C28-RSG', stock: 6 },
      { colorName: { fr: 'Vert', es: 'Verde', nl: 'Groen', de: 'Grün' }, colorHex: '#4ADE80', sku: 'C28-GRN', stock: 5 },
      { colorName: { fr: 'Violet', es: 'Violeta', nl: 'Paars', de: 'Violett' }, colorHex: '#6A0DAD', sku: 'C28-VIO', stock: 4 },
    ],
  },
  {
    _id: 'prod-eb30',
    name: { fr: 'EB30', es: 'EB30', nl: 'EB30', de: 'EB30' },
    slug: { current: 'eb30' },
    category: 'cat-longrange',
    shortDescription: {
      fr: 'Double batterie + panier — 90-100 km',
      es: 'Doble batería + cesta — 90-100 km',
      nl: 'Dubbele accu + mand — 90-100 km',
      de: 'Doppelakku + Korb — 90-100 km',
    },
    description: {
      fr: 'L\'EB30 est équipé de deux batteries 15.6AH pour une autonomie exceptionnelle de 90 à 100 km. Panier intégré pour vos courses.',
      es: 'El EB30 está equipado con dos baterías 15.6AH para una autonomía excepcional de 90 a 100 km.',
      nl: 'De EB30 is uitgerust met twee 15.6AH accu\'s voor een uitzonderlijk bereik van 90 tot 100 km.',
      de: 'Das EB30 ist mit zwei 15.6AH Akkus ausgestattet für eine außergewöhnliche Reichweite von 90 bis 100 km.',
    },
    price: 1799,
    isNew: false, isFeatured: false, isOnSale: false, isAvailable: true, sortOrder: 9,
    specs: { motor: '250W', battery: '15.6AH x2', tireSize: '20"', range: '90-100 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'EB30-BLK', stock: 5 },
    ],
  },
  {
    _id: 'prod-v20-max',
    name: { fr: 'V20 Max', es: 'V20 Max', nl: 'V20 Max', de: 'V20 Max' },
    slug: { current: 'v20-max' },
    category: 'cat-urban',
    shortDescription: {
      fr: 'Grands gabarits (175cm+) — pneus 24"',
      es: 'Personas altas (175cm+) — neumáticos 24"',
      nl: 'Grote rijders (175cm+) — 24" banden',
      de: 'Große Fahrer (175cm+) — 24"-Reifen',
    },
    description: {
      fr: 'Le V20 Max est conçu pour les grands gabarits (175cm+). Pneus 24 pouces, batterie 48V 18.2AH, autonomie 50-60 km.',
      es: 'El V20 Max está diseñado para personas altas (175cm+). Neumáticos de 24 pulgadas, batería 48V 18.2AH.',
      nl: 'De V20 Max is ontworpen voor grote rijders (175cm+). 24-inch banden, 48V 18.2AH accu.',
      de: 'Das V20 Max ist für große Fahrer (175cm+) konzipiert. 24-Zoll-Reifen, 48V 18.2AH Akku.',
    },
    price: 1499,
    isNew: false, isFeatured: false, isOnSale: false, isAvailable: true, sortOrder: 10,
    specs: { motor: '250W', battery: '48V 18.2AH', tireSize: '24"', range: '50-60 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'V20MAX-BLK', stock: 6 },
    ],
  },
  {
    _id: 'prod-v20-limited-pro',
    name: { fr: 'V20 Limited Pro', es: 'V20 Limited Pro', nl: 'V20 Limited Pro', de: 'V20 Limited Pro' },
    slug: { current: 'v20-limited-pro' },
    category: 'cat-longrange',
    shortDescription: {
      fr: 'Double batterie — autonomie max ~100 km',
      es: 'Doble batería — autonomía máx. ~100 km',
      nl: 'Dubbele accu — max bereik ~100 km',
      de: 'Doppelakku — max. Reichweite ~100 km',
    },
    description: {
      fr: 'Le V20 Limited Pro offre la plus grande autonomie de notre gamme : environ 100 km grâce à ses deux batteries 48V 15.6AH. Le choix idéal pour les longues distances.',
      es: 'El V20 Limited Pro ofrece la mayor autonomía de nuestra gama: aproximadamente 100 km con sus dos baterías.',
      nl: 'De V20 Limited Pro biedt het grootste bereik in ons assortiment: ongeveer 100 km dankzij twee accu\'s.',
      de: 'Das V20 Limited Pro bietet die größte Reichweite in unserem Sortiment: etwa 100 km dank zweier Akkus.',
    },
    price: 1899,
    isNew: true, isFeatured: false, isOnSale: false, isAvailable: true, sortOrder: 11,
    specs: { motor: '250W', battery: '48V 15.6AH x2', tireSize: '20"', range: '~100 km', brakeType: 'Freins hydrauliques', maxSpeed: 25 },
    variants: [
      { colorName: { fr: 'Noir', es: 'Negro', nl: 'Zwart', de: 'Schwarz' }, colorHex: '#000000', sku: 'V20LTDP-BLK', stock: 4 },
    ],
  },
]

async function seed() {
  console.log('🌱 Seeding Sanity...\n')

  // 1. Categories
  console.log('📂 Creating categories...')
  for (const cat of categories) {
    await client.createOrReplace({
      _type: 'category',
      _id: cat._id,
      name: cat.name,
      slug: { _type: 'slug', current: cat.slug.current },
      sortOrder: cat.sortOrder,
    })
    console.log(`   ✅ ${cat.name.fr}`)
  }

  // 2. Brand
  console.log('\n🏷️ Creating brand...')
  await client.createOrReplace(brand)
  console.log('   ✅ QMWHEEL')

  // 3. Products
  console.log('\n🚲 Creating products...')
  for (const p of products) {
    const doc = {
      _type: 'product',
      _id: p._id,
      name: p.name,
      slug: { _type: 'slug', current: p.slug.current },
      brand: { _type: 'reference', _ref: 'brand-qmwheel' },
      category: { _type: 'reference', _ref: p.category },
      shortDescription: p.shortDescription,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAtPrice || undefined,
      isOnSale: p.isOnSale,
      isAvailable: p.isAvailable,
      isFeatured: p.isFeatured,
      isNew: p.isNew,
      sortOrder: p.sortOrder,
      specifications: p.specs,
      variants: p.variants.map((v, i) => ({
        _type: 'colorVariant',
        _key: `variant-${i}`,
        colorName: v.colorName,
        colorHex: v.colorHex,
        sku: v.sku,
        stock: v.stock,
      })),
    }
    await client.createOrReplace(doc)
    console.log(`   ✅ ${p.name.fr} — ${p.price}€`)
  }

  // 4. Homepage
  console.log('\n🏠 Creating homepage...')
  await client.createOrReplace({
    _type: 'homePage',
    _id: 'homePage',
    heroBanner: {
      title: { fr: 'Puissance Tout-Terrain', es: 'Potencia Todo Terreno', nl: 'All-Terrain Kracht', de: 'Geländekraft' },
      subtitle: { fr: 'Performance Durable', es: 'Rendimiento Duradero', nl: 'Duurzame Prestaties', de: 'Nachhaltige Leistung' },
      description: {
        fr: 'Découvrez notre gamme de fatbikes électriques alliant puissance, style et respect de l\'environnement.',
        es: 'Descubre nuestra gama de fatbikes eléctricas combinando potencia, estilo y respeto al medio ambiente.',
        nl: 'Ontdek ons assortiment elektrische fatbikes die kracht, stijl en milieuvriendelijkheid combineren.',
        de: 'Entdecken Sie unser Sortiment an elektrischen Fatbikes, die Kraft, Stil und Umweltfreundlichkeit vereinen.',
      },
      ctaText: { fr: 'Découvrir nos vélos', es: 'Descubrir nuestras bicis', nl: 'Ontdek onze fietsen', de: 'Unsere Räder entdecken' },
      ctaLink: '/produits',
    },
    featuredProductsTitle: { fr: 'Nos Modèles Phares', es: 'Nuestros Modelos Estrella', nl: 'Onze Topmodellen', de: 'Unsere Top-Modelle' },
    featuredProductsSubtitle: {
      fr: 'Des vélos électriques conçus pour tous les terrains et tous les styles.',
      es: 'Bicicletas eléctricas diseñadas para todos los terrenos y estilos.',
      nl: 'Elektrische fietsen ontworpen voor elk terrein en elke stijl.',
      de: 'Elektrofahrräder für jedes Gelände und jeden Stil.',
    },
    values: [
      {
        _key: 'val1',
        icon: 'battery-charging',
        title: { fr: 'Autonomie', es: 'Autonomía', nl: 'Bereik', de: 'Reichweite' },
        description: { fr: 'Jusqu\'à 100km d\'autonomie avec nos batteries haute capacité.', es: 'Hasta 100km de autonomía.', nl: 'Tot 100km bereik.', de: 'Bis zu 100km Reichweite.' },
      },
      {
        _key: 'val2',
        icon: 'shield-check',
        title: { fr: 'Qualité Premium', es: 'Calidad Premium', nl: 'Premium Kwaliteit', de: 'Premium-Qualität' },
        description: { fr: 'Composants certifiés et garantie constructeur complète.', es: 'Componentes certificados y garantía completa.', nl: 'Gecertificeerde componenten en volledige garantie.', de: 'Zertifizierte Komponenten und vollständige Garantie.' },
      },
      {
        _key: 'val3',
        icon: 'truck',
        title: { fr: 'Livraison Rapide', es: 'Envío Rápido', nl: 'Snelle Levering', de: 'Schnelle Lieferung' },
        description: { fr: 'Livraison offerte en France métropolitaine sous 5 jours.', es: 'Envío gratuito en Francia en 5 días.', nl: 'Gratis levering in Frankrijk binnen 5 dagen.', de: 'Kostenlose Lieferung in Frankreich innerhalb von 5 Tagen.' },
      },
      {
        _key: 'val4',
        icon: 'headset',
        title: { fr: 'SAV Réactif', es: 'Servicio Postventa', nl: 'Klantenservice', de: 'Kundendienst' },
        description: { fr: 'Support technique disponible 6j/7 pour vous accompagner.', es: 'Soporte técnico 6 días/semana.', nl: 'Technische ondersteuning 6 dagen/week.', de: 'Technischer Support 6 Tage/Woche.' },
      },
    ],
  })
  console.log('   ✅ Homepage content')

  // 5. About page
  console.log('\n📄 Creating about page...')
  await client.createOrReplace({
    _type: 'aboutPage',
    _id: 'aboutPage',
    title: { fr: 'À Propos de Vitesse Eco', es: 'Sobre Vitesse Eco', nl: 'Over Vitesse Eco', de: 'Über Vitesse Eco' },
    subtitle: { fr: 'Votre partenaire mobilité électrique depuis la France.', es: 'Su socio de movilidad eléctrica desde Francia.', nl: 'Uw partner voor elektrische mobiliteit uit Frankrijk.', de: 'Ihr Partner für Elektromobilität aus Frankreich.' },
    story: {
      fr: 'Vitesse Eco est née d\'une passion pour la mobilité électrique et le respect de l\'environnement. Basée à Poitiers, France, notre mission est de rendre les fatbikes électriques accessibles à tous. Nous sélectionnons rigoureusement chaque modèle pour garantir qualité, performance et durabilité. VITESSE ECO est une SAS enregistrée sous le SIREN 100 732 247, spécialisée dans la vente de vélos électriques premium.',
      es: 'Vitesse Eco nació de una pasión por la movilidad eléctrica y el respeto al medio ambiente. Con sede en Poitiers, Francia, nuestra misión es hacer accesibles las fatbikes eléctricas para todos.',
      nl: 'Vitesse Eco is geboren uit een passie voor elektrische mobiliteit en respect voor het milieu. Gevestigd in Poitiers, Frankrijk, is onze missie om elektrische fatbikes toegankelijk te maken voor iedereen.',
      de: 'Vitesse Eco entstand aus einer Leidenschaft für Elektromobilität und Umweltschutz. Mit Sitz in Poitiers, Frankreich, ist unsere Mission, elektrische Fatbikes für alle zugänglich zu machen.',
    },
    values: [
      {
        _key: 'av1',
        icon: 'seal-check',
        title: { fr: 'Qualité Garantie', es: 'Calidad Garantizada', nl: 'Gegarandeerde Kwaliteit', de: 'Garantierte Qualität' },
        description: { fr: 'Tous nos vélos sont équipés de composants premium : moteur 250W, freins hydrauliques, batteries haute capacité.', es: 'Componentes premium en cada bici.', nl: 'Premium componenten in elke fiets.', de: 'Premium-Komponenten in jedem Fahrrad.' },
      },
      {
        _key: 'av2',
        icon: 'truck',
        title: { fr: 'Livraison Soignée', es: 'Entrega Cuidadosa', nl: 'Zorgvuldige Levering', de: 'Sorgfältige Lieferung' },
        description: { fr: 'Chaque vélo est soigneusement emballé et livré à votre porte en France métropolitaine sous 5 jours ouvrés.', es: 'Entrega cuidadosa en 5 días.', nl: 'Zorgvuldige levering in 5 dagen.', de: 'Sorgfältige Lieferung in 5 Tagen.' },
      },
      {
        _key: 'av3',
        icon: 'wrench',
        title: { fr: 'SAV Dédié', es: 'Servicio Dedicado', nl: 'Toegewijd Onderhoud', de: 'Engagierter Service' },
        description: { fr: 'Notre équipe technique est disponible 6 jours sur 7 pour vous accompagner et répondre à toutes vos questions.', es: 'Soporte técnico 6/7 días.', nl: 'Technische ondersteuning 6/7 dagen.', de: 'Technischer Support 6/7 Tage.' },
      },
    ],
  })
  console.log('   ✅ About page content')

  // 6. Contact page
  console.log('\n📞 Creating contact page...')
  await client.createOrReplace({
    _type: 'contactPage',
    _id: 'contactPage',
    title: { fr: 'Contactez-nous', es: 'Contáctenos', nl: 'Neem contact op', de: 'Kontaktieren Sie uns' },
    subtitle: { fr: 'Une question ? N\'hésitez pas à nous écrire.', es: '¿Alguna pregunta? No dude en escribirnos.', nl: 'Een vraag? Aarzel niet om ons te schrijven.', de: 'Eine Frage? Zögern Sie nicht uns zu schreiben.' },
    email: 'contact@vitesse-eco.fr',
    address: '32 Rue du Faubourg du Pont Neuf\n86000 Poitiers\nFrance',
    hours: 'Lundi — Samedi : 9h — 18h',
  })
  console.log('   ✅ Contact page content')

  // 7. Site settings
  console.log('\n⚙️ Creating site settings...')
  await client.createOrReplace({
    _type: 'siteSettings',
    _id: 'siteSettings',
    siteName: 'Vitesse Eco',
    tagline: { fr: 'Détaillant en Fatbikes Électriques', es: 'Distribuidor de Fatbikes Eléctricas', nl: 'Elektrische Fatbike Dealer', de: 'Händler für Elektrische Fatbikes' },
    contactInfo: {
      email: 'contact@vitesse-eco.fr',
      address: '32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France',
      hours: 'Lun — Sam : 9h — 18h',
    },
  })
  console.log('   ✅ Site settings')

  console.log('\n🎉 Seeding complete! All data uploaded to Sanity.')
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
