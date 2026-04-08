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
    if (existsSync(p)) { return JSON.parse(readFileSync(p, 'utf-8')).authToken }
  }
  throw new Error('No Sanity token')
}

const client = createClient({
  projectId: '2jvnjf0c', dataset: 'production',
  token: getSanityToken(), apiVersion: '2024-01-01', useCdn: false,
})

async function fix() {
  console.log('🔧 Fixing all content...\n')

  // === CONTACT PAGE ===
  console.log('📞 Contact page...')
  await client.patch('contactPage').set({
    'title.en': 'Contact Us',
    'title.ar': 'اتصل بنا',
    'subtitle.en': "Got a question? Don't hesitate to reach out.",
    'subtitle.ar': 'لديك سؤال؟ لا تتردد في مراسلتنا.',
    'email': 'contact@vitesse-eco.fr',
    'phone': '+33 5 XX XX XX XX',
    'address': '32 Rue du Faubourg du Pont Neuf\n86000 Poitiers\nFrance',
    'hours': 'Lundi — Samedi : 9h — 18h\nMonday — Saturday: 9am — 6pm',
    'mapUrl': 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2770.7!2d0.3434!3d46.5802!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47fdbe31a5075ccb%3A0x2a43cf344f2d1b0!2s32%20Rue%20du%20Faubourg%20du%20Pont%20Neuf%2C%2086000%20Poitiers!5e0!3m2!1sfr!2sfr!4v1700000000000!5m2!1sfr!2sfr',
  }).commit()
  console.log('  ✅ title, subtitle (en+ar), phone, mapUrl, hours')

  // === SITE SETTINGS ===
  console.log('\n⚙️ Site settings...')
  await client.patch('siteSettings').set({
    'tagline.en': 'Electric Fatbike Retailer',
    'tagline.ar': 'موزع الدراجات الكهربائية الضخمة',
    'contactInfo.email': 'contact@vitesse-eco.fr',
    'contactInfo.phone': '+33 5 XX XX XX XX',
    'contactInfo.address': '32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France',
    'contactInfo.hours': 'Lun — Sam : 9h — 18h',
    'socialLinks': {
      'instagram': 'https://instagram.com/vitesseeco',
      'facebook': 'https://facebook.com/vitesseeco',
      'tiktok': 'https://tiktok.com/@vitesseeco',
    },
    'footerText': {
      'fr': 'Détaillant en fatbikes électriques. Puissance, style et respect de l\'environnement.',
      'en': 'Electric fatbike retailer. Power, style and environmental responsibility.',
      'es': 'Distribuidor de fatbikes eléctricas. Potencia, estilo y respeto por el medio ambiente.',
      'nl': 'Dealer in elektrische fatbikes. Kracht, stijl en respect voor het milieu.',
      'de': 'Händler für elektrische Fatbikes. Kraft, Stil und Umweltbewusstsein.',
      'ar': 'موزع الدراجات الكهربائية الضخمة. قوة وأناقة ومسؤولية بيئية.',
    },
  }).commit()
  console.log('  ✅ tagline (en+ar), socialLinks, footerText (6 langs)')

  // === HOMEPAGE - check values have all langs ===
  console.log('\n🏠 Homepage values...')
  const home = await client.fetch('*[_type=="homePage"][0]{values}')
  if (home?.values) {
    const updatedValues = home.values.map((v, i) => {
      const titles = [
        { fr: 'Autonomie', en: 'Range', es: 'Autonomía', nl: 'Bereik', de: 'Reichweite', ar: 'المدى' },
        { fr: 'Qualité Premium', en: 'Premium Quality', es: 'Calidad Premium', nl: 'Premium Kwaliteit', de: 'Premium-Qualität', ar: 'جودة ممتازة' },
        { fr: 'Livraison Rapide', en: 'Fast Delivery', es: 'Entrega Rápida', nl: 'Snelle Levering', de: 'Schnelle Lieferung', ar: 'توصيل سريع' },
        { fr: 'SAV Réactif', en: 'Responsive Support', es: 'Soporte Reactivo', nl: 'Responsieve Ondersteuning', de: 'Reaktiver Kundendienst', ar: 'دعم سريع الاستجابة' },
      ]
      const descs = [
        { fr: 'Jusqu\'à 100km d\'autonomie avec nos batteries haute capacité.', en: 'Up to 100km range with our high-capacity batteries.', es: 'Hasta 100km de autonomía con nuestras baterías de alta capacidad.', nl: 'Tot 100km bereik met onze accu\'s met hoge capaciteit.', de: 'Bis zu 100km Reichweite mit unseren Hochleistungsakkus.', ar: 'حتى 100 كم مدى مع بطارياتنا عالية السعة.' },
        { fr: 'Composants certifiés et garantie constructeur complète.', en: 'Certified components and full manufacturer warranty.', es: 'Componentes certificados y garantía completa del fabricante.', nl: 'Gecertificeerde componenten en volledige fabrieksgarantie.', de: 'Zertifizierte Komponenten und vollständige Herstellergarantie.', ar: 'مكونات معتمدة وضمان كامل من الشركة المصنعة.' },
        { fr: 'Livraison offerte en France métropolitaine sous 5 jours.', en: 'Free delivery in mainland France within 5 days.', es: 'Entrega gratuita en Francia metropolitana en 5 días.', nl: 'Gratis levering in Frankrijk binnen 5 dagen.', de: 'Kostenlose Lieferung in Frankreich innerhalb von 5 Tagen.', ar: 'توصيل مجاني في فرنسا خلال 5 أيام.' },
        { fr: 'Support technique disponible 6j/7 pour vous accompagner.', en: 'Technical support available 6 days a week.', es: 'Asistencia técnica disponible 6 días a la semana.', nl: 'Technische ondersteuning 6 dagen per week beschikbaar.', de: 'Technischer Support 6 Tage die Woche verfügbar.', ar: 'دعم فني متاح 6 أيام في الأسبوع.' },
      ]
      return { ...v, title: titles[i] || v.title, description: descs[i] || v.description }
    })
    await client.patch('homePage').set({ values: updatedValues }).commit()
    console.log('  ✅ 4 values with 6 languages each')
  }

  // === LEGAL PAGES ===
  console.log('\n⚖️ Legal pages...')
  const legal = await client.fetch('*[_type=="legalPages"][0]')
  if (!legal) {
    await client.createOrReplace({
      _type: 'legalPages',
      _id: 'legalPages',
      mentionsLegales: {
        fr: 'VITESSE ECO — SAS\nSIREN : 100 732 247 | SIRET : 100 732 247 00018\nAPE : 46.90Z\n32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France\nEmail : contact@vitesse-eco.fr\nHébergeur : Vercel Inc.',
        en: 'VITESSE ECO — SAS\nSIREN: 100 732 247 | SIRET: 100 732 247 00018\nAPE: 46.90Z\n32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France\nEmail: contact@vitesse-eco.fr\nHost: Vercel Inc.',
        es: 'VITESSE ECO — SAS\nSIREN: 100 732 247 | SIRET: 100 732 247 00018\nAPE: 46.90Z\n32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Francia\nEmail: contact@vitesse-eco.fr\nAlojamiento: Vercel Inc.',
        nl: 'VITESSE ECO — SAS\nSIREN: 100 732 247 | SIRET: 100 732 247 00018\nAPE: 46.90Z\n32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankrijk\nEmail: contact@vitesse-eco.fr\nHosting: Vercel Inc.',
        de: 'VITESSE ECO — SAS\nSIREN: 100 732 247 | SIRET: 100 732 247 00018\nAPE: 46.90Z\n32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich\nEmail: contact@vitesse-eco.fr\nHosting: Vercel Inc.',
        ar: 'VITESSE ECO — SAS\nSIREN: 100 732 247 | SIRET: 100 732 247 00018\nAPE: 46.90Z\n32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France\nالبريد: contact@vitesse-eco.fr\nالاستضافة: Vercel Inc.',
      },
    })
    console.log('  ✅ Created with 6 languages')
  } else {
    console.log('  ✅ Already exists')
  }

  console.log('\n🎉 All content fixed!')
}

fix().catch(e => { console.error('❌', e.message); process.exit(1) })
