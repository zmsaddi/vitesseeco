import { createClient } from '@sanity/client'
import { readFileSync } from 'fs'

// Load token from Sanity CLI config
const sanityConfig = JSON.parse(readFileSync('C:/Users/ZAKARIYA/.config/sanity/config.json', 'utf-8'))

const client = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  token: sanityConfig.authToken,
  apiVersion: '2024-01-01',
  useCdn: false,
})

// ============ PRODUCT TRANSLATIONS ============
// Each product keeps existing fr/es/nl/de and adds en + ar
const productTranslations = [
  {
    _id: 'prod-v20-mini',
    shortDescription: {
      fr: 'Fatbike compact pour adolescents',
      en: 'Compact fatbike for teenagers',
      es: 'Fatbike compacta para adolescentes',
      nl: 'Compacte fatbike voor tieners',
      de: 'Kompaktes Fatbike für Jugendliche',
      ar: 'دراجة فات بايك مدمجة للمراهقين',
    },
    description: {
      fr: 'Le V20 Mini est le modèle idéal pour les jeunes riders. Compact et maniable avec ses pneus 16 pouces, il offre une autonomie de 30 à 40 km. Parfait pour les trajets quotidiens et les balades en ville.',
      en: 'The V20 Mini is the ideal model for young riders. Compact and easy to handle with its 16-inch tires, it offers a range of 30 to 40 km. Perfect for daily commutes and city rides.',
      es: 'El V20 Mini es el modelo ideal para jóvenes ciclistas. Compacto y manejable con neumáticos de 16 pulgadas, ofrece una autonomía de 30 a 40 km. Perfecto para desplazamientos diarios y paseos por la ciudad.',
      nl: 'De V20 Mini is het ideale model voor jonge rijders. Compact en wendbaar met 16-inch banden, biedt het een bereik van 30 tot 40 km. Perfect voor dagelijkse ritten en stadsritten.',
      de: 'Das V20 Mini ist das ideale Modell für junge Fahrer. Kompakt und wendig mit 16-Zoll-Reifen bietet es eine Reichweite von 30 bis 40 km. Perfekt für tägliche Fahrten und Stadtrundfahrten.',
      ar: 'V20 Mini هو النموذج المثالي للراكبين الشباب. مدمج وسهل المناورة بإطاراته مقاس 16 بوصة، يوفر مدى يتراوح بين 30 و40 كم. مثالي للتنقلات اليومية والجولات في المدينة.',
    },
  },
  {
    _id: 'prod-v20-pro',
    shortDescription: {
      fr: 'Notre bestseller — sièges extensibles',
      en: 'Our bestseller — expandable seats',
      es: 'Nuestro superventas — asientos extensibles',
      nl: 'Onze bestseller — uitbreidbare stoelen',
      de: 'Unser Bestseller — erweiterbare Sitze',
      ar: 'الأكثر مبيعاً لدينا — مقاعد قابلة للتوسيع',
    },
    description: {
      fr: 'Le V20 Pro est notre modèle phare. Avec sa batterie 48V 15.6AH et ses sièges extensibles, il est parfait pour les trajets urbains et les longues balades. Autonomie de 40 à 50 km.',
      en: 'The V20 Pro is our flagship model. With its 48V 15.6AH battery and expandable seats, it is perfect for urban commutes and long rides. Range of 40 to 50 km.',
      es: 'El V20 Pro es nuestro modelo estrella. Con batería de 48V 15.6AH y asientos extensibles, perfecto para trayectos urbanos y largos paseos. Autonomía de 40 a 50 km.',
      nl: 'De V20 Pro is ons topmodel. Met 48V 15.6AH accu en uitbreidbare stoelen, perfect voor stadsritten en lange tochten. Bereik van 40 tot 50 km.',
      de: 'Das V20 Pro ist unser Flaggschiff. Mit 48V 15.6AH Akku und erweiterbaren Sitzen, perfekt für Stadtfahrten und lange Touren. Reichweite von 40 bis 50 km.',
      ar: 'V20 Pro هو نموذجنا الرائد. مع بطاريته 48V 15.6AH ومقاعده القابلة للتوسيع، فهو مثالي للتنقلات الحضرية والجولات الطويلة. مدى يتراوح بين 40 و50 كم.',
    },
  },
  {
    _id: 'prod-v20-limited',
    shortDescription: {
      fr: 'Selle longue — confort premium',
      en: 'Long seat — premium comfort',
      es: 'Asiento largo — confort premium',
      nl: 'Lang zadel — premium comfort',
      de: 'Langer Sattel — Premium-Komfort',
      ar: 'مقعد طويل — راحة فاخرة',
    },
    description: {
      fr: 'Le V20 Limited combine style et confort avec sa selle longue exclusive. Batterie 48V 18.2AH pour une autonomie de 50 à 60 km.',
      en: 'The V20 Limited combines style and comfort with its exclusive long seat. 48V 18.2AH battery for a range of 50 to 60 km.',
      es: 'El V20 Limited combina estilo y confort con su asiento largo exclusivo. Batería 48V 18.2AH para una autonomía de 50 a 60 km.',
      nl: 'De V20 Limited combineert stijl en comfort met zijn exclusieve lange zadel. 48V 18.2AH accu voor een bereik van 50 tot 60 km.',
      de: 'Das V20 Limited kombiniert Stil und Komfort mit seinem exklusiven langen Sattel. 48V 18.2AH Akku für eine Reichweite von 50 bis 60 km.',
      ar: 'V20 Limited يجمع بين الأناقة والراحة مع مقعده الطويل الحصري. بطارية 48V 18.2AH لمدى يتراوح بين 50 و60 كم.',
    },
  },
  {
    _id: 'prod-s20-pro',
    shortDescription: {
      fr: 'Design unique — selle innovante',
      en: 'Unique design — innovative seat',
      es: 'Diseño único — asiento innovador',
      nl: 'Uniek ontwerp — innovatief zadel',
      de: 'Einzigartiges Design — innovativer Sattel',
      ar: 'تصميم فريد — مقعد مبتكر',
    },
    description: {
      fr: 'Le S20 Pro se distingue par son design unique et sa selle au style innovant. Batterie 48V 18.2AH, autonomie 50-60 km.',
      en: 'The S20 Pro stands out with its unique design and innovative seat style. 48V 18.2AH battery, 50-60 km range.',
      es: 'El S20 Pro se distingue por su diseño único y su asiento innovador. Batería 48V 18.2AH, autonomía de 50 a 60 km.',
      nl: 'De S20 Pro onderscheidt zich door zijn unieke ontwerp en innovatief zadel. 48V 18.2AH accu, bereik 50-60 km.',
      de: 'Das S20 Pro zeichnet sich durch sein einzigartiges Design und seinen innovativen Sattel aus. 48V 18.2AH Akku, Reichweite 50-60 km.',
      ar: 'S20 Pro يتميز بتصميمه الفريد ومقعده ذي الطراز المبتكر. بطارية 48V 18.2AH، مدى 50-60 كم.',
    },
  },
  {
    _id: 'prod-v20-cross',
    shortDescription: {
      fr: 'Tout-terrain + enceinte Bluetooth',
      en: 'Off-road + Bluetooth speaker',
      es: 'Todo terreno + altavoz Bluetooth',
      nl: 'Off-road + Bluetooth speaker',
      de: 'Gelände + Bluetooth-Lautsprecher',
      ar: 'للطرق الوعرة + مكبر صوت بلوتوث',
    },
    description: {
      fr: 'Le V20 Cross est conçu pour l\'aventure. Pneus 70/100-17, batterie 48V 22AH pour 60-70 km d\'autonomie, et enceinte Bluetooth intégrée.',
      en: 'The V20 Cross is built for adventure. 70/100-17 tires, 48V 22AH battery for 60-70 km range, and built-in Bluetooth speaker.',
      es: 'El V20 Cross está diseñado para la aventura. Neumáticos 70/100-17, batería 48V 22AH para 60-70 km de autonomía, y altavoz Bluetooth integrado.',
      nl: 'De V20 Cross is ontworpen voor avontuur. 70/100-17 banden, 48V 22AH accu voor 60-70 km bereik, en ingebouwde Bluetooth speaker.',
      de: 'Das V20 Cross ist für Abenteuer konzipiert. 70/100-17 Reifen, 48V 22AH Akku für 60-70 km Reichweite, und integrierter Bluetooth-Lautsprecher.',
      ar: 'V20 Cross مصمم للمغامرة. إطارات 70/100-17، بطارية 48V 22AH لمدى 60-70 كم، ومكبر صوت بلوتوث مدمج.',
    },
  },
  {
    _id: 'prod-q30',
    shortDescription: {
      fr: 'Pliable — rangement facile',
      en: 'Foldable — easy storage',
      es: 'Plegable — fácil almacenamiento',
      nl: 'Opvouwbaar — makkelijk op te bergen',
      de: 'Faltbar — einfache Aufbewahrung',
      ar: 'قابل للطي — تخزين سهل',
    },
    description: {
      fr: 'Le Q30 est notre modèle pliable. Se range facilement dans un coffre ou un placard. Batterie 48V 15.6AH, autonomie 40-50 km.',
      en: 'The Q30 is our foldable model. Easily fits in a car trunk or closet. 48V 15.6AH battery, 40-50 km range.',
      es: 'El Q30 es nuestro modelo plegable. Se guarda fácilmente en un maletero o armario. Batería 48V 15.6AH, autonomía de 40 a 50 km.',
      nl: 'De Q30 is ons opvouwbare model. Past makkelijk in een kofferbak of kast. 48V 15.6AH accu, bereik 40-50 km.',
      de: 'Das Q30 ist unser faltbares Modell. Passt leicht in einen Kofferraum oder Schrank. 48V 15.6AH Akku, Reichweite 40-50 km.',
      ar: 'Q30 هو نموذجنا القابل للطي. يمكن تخزينه بسهولة في صندوق السيارة أو الخزانة. بطارية 48V 15.6AH، مدى 40-50 كم.',
    },
  },
  {
    _id: 'prod-d50',
    shortDescription: {
      fr: 'Lady friendly — selle amovible',
      en: 'Lady friendly — removable saddle',
      es: 'Lady friendly — asiento extraíble',
      nl: 'Lady friendly — afneembaar zadel',
      de: 'Lady friendly — abnehmbarer Sattel',
      ar: 'مناسب للسيدات — سرج قابل للإزالة',
    },
    description: {
      fr: 'Le D50 est pensé pour les femmes avec un design élégant et une selle amovible. Batterie 48V 18.2AH pour 50-60 km d\'autonomie.',
      en: 'The D50 is designed for women with an elegant design and removable saddle. 48V 18.2AH battery for 50-60 km range.',
      es: 'El D50 está pensado para mujeres con un diseño elegante y asiento extraíble. Batería 48V 18.2AH para 50-60 km de autonomía.',
      nl: 'De D50 is ontworpen voor vrouwen met een elegant ontwerp en afneembaar zadel. 48V 18.2AH accu voor 50-60 km bereik.',
      de: 'Das D50 ist für Frauen konzipiert mit elegantem Design und abnehmbarem Sattel. 48V 18.2AH Akku für 50-60 km Reichweite.',
      ar: 'D50 مصمم للنساء بتصميم أنيق وسرج قابل للإزالة. بطارية 48V 18.2AH لمدى 50-60 كم.',
    },
  },
  {
    _id: 'prod-c28',
    shortDescription: {
      fr: 'Lady friendly — design féminin',
      en: 'Lady friendly — feminine design',
      es: 'Lady friendly — diseño femenino',
      nl: 'Lady friendly — vrouwelijk design',
      de: 'Lady friendly — feminines Design',
      ar: 'مناسب للسيدات — تصميم أنثوي',
    },
    description: {
      fr: 'Le C28 est un fatbike au design pensé pour les femmes. Léger, élégant et disponible en couleurs exclusives. Batterie 48V 15.6AH.',
      en: 'The C28 is a fatbike designed for women. Lightweight, elegant, and available in exclusive colors. 48V 15.6AH battery.',
      es: 'El C28 es una fatbike con diseño femenino. Ligera, elegante y disponible en colores exclusivos. Batería 48V 15.6AH.',
      nl: 'De C28 is een fatbike met vrouwelijk ontwerp. Licht, elegant en beschikbaar in exclusieve kleuren. 48V 15.6AH accu.',
      de: 'Das C28 ist ein Fatbike mit femininem Design. Leicht, elegant und in exklusiven Farben erhältlich. 48V 15.6AH Akku.',
      ar: 'C28 هو فات بايك بتصميم مخصص للنساء. خفيف وأنيق ومتوفر بألوان حصرية. بطارية 48V 15.6AH.',
    },
  },
  {
    _id: 'prod-eb30',
    shortDescription: {
      fr: 'Double batterie + panier — 90-100 km',
      en: 'Dual battery + basket — 90-100 km',
      es: 'Doble batería + cesta — 90-100 km',
      nl: 'Dubbele accu + mand — 90-100 km',
      de: 'Doppelakku + Korb — 90-100 km',
      ar: 'بطارية مزدوجة + سلة — 90-100 كم',
    },
    description: {
      fr: 'L\'EB30 est équipé de deux batteries 15.6AH pour une autonomie exceptionnelle de 90 à 100 km. Panier intégré pour vos courses.',
      en: 'The EB30 is equipped with two 15.6AH batteries for an exceptional range of 90 to 100 km. Built-in basket for your shopping.',
      es: 'El EB30 está equipado con dos baterías 15.6AH para una autonomía excepcional de 90 a 100 km. Cesta integrada para sus compras.',
      nl: 'De EB30 is uitgerust met twee 15.6AH accu\'s voor een uitzonderlijk bereik van 90 tot 100 km. Ingebouwde mand voor uw boodschappen.',
      de: 'Das EB30 ist mit zwei 15.6AH Akkus ausgestattet für eine außergewöhnliche Reichweite von 90 bis 100 km. Integrierter Korb für Ihre Einkäufe.',
      ar: 'EB30 مجهز ببطاريتين 15.6AH لمدى استثنائي يتراوح بين 90 و100 كم. سلة مدمجة لمشترياتك.',
    },
  },
  {
    _id: 'prod-v20-max',
    shortDescription: {
      fr: 'Grands gabarits (175cm+) — pneus 24"',
      en: 'Tall riders (175cm+) — 24" tires',
      es: 'Personas altas (175cm+) — neumáticos 24"',
      nl: 'Grote rijders (175cm+) — 24" banden',
      de: 'Große Fahrer (175cm+) — 24"-Reifen',
      ar: 'للأشخاص طوال القامة (175 سم+) — إطارات 24 بوصة',
    },
    description: {
      fr: 'Le V20 Max est conçu pour les grands gabarits (175cm+). Pneus 24 pouces, batterie 48V 18.2AH, autonomie 50-60 km.',
      en: 'The V20 Max is designed for tall riders (175cm+). 24-inch tires, 48V 18.2AH battery, 50-60 km range.',
      es: 'El V20 Max está diseñado para personas altas (175cm+). Neumáticos de 24 pulgadas, batería 48V 18.2AH, autonomía de 50 a 60 km.',
      nl: 'De V20 Max is ontworpen voor grote rijders (175cm+). 24-inch banden, 48V 18.2AH accu, bereik 50-60 km.',
      de: 'Das V20 Max ist für große Fahrer (175cm+) konzipiert. 24-Zoll-Reifen, 48V 18.2AH Akku, Reichweite 50-60 km.',
      ar: 'V20 Max مصمم للأشخاص طوال القامة (175 سم فأكثر). إطارات 24 بوصة، بطارية 48V 18.2AH، مدى 50-60 كم.',
    },
  },
  {
    _id: 'prod-v20-limited-pro',
    shortDescription: {
      fr: 'Double batterie — autonomie max ~100 km',
      en: 'Dual battery — max range ~100 km',
      es: 'Doble batería — autonomía máx. ~100 km',
      nl: 'Dubbele accu — max bereik ~100 km',
      de: 'Doppelakku — max. Reichweite ~100 km',
      ar: 'بطارية مزدوجة — مدى أقصى ~100 كم',
    },
    description: {
      fr: 'Le V20 Limited Pro offre la plus grande autonomie de notre gamme : environ 100 km grâce à ses deux batteries 48V 15.6AH. Le choix idéal pour les longues distances.',
      en: 'The V20 Limited Pro offers the longest range in our lineup: approximately 100 km thanks to its two 48V 15.6AH batteries. The ideal choice for long distances.',
      es: 'El V20 Limited Pro ofrece la mayor autonomía de nuestra gama: aproximadamente 100 km gracias a sus dos baterías 48V 15.6AH. La elección ideal para largas distancias.',
      nl: 'De V20 Limited Pro biedt het grootste bereik in ons assortiment: ongeveer 100 km dankzij twee 48V 15.6AH accu\'s. De ideale keuze voor lange afstanden.',
      de: 'Das V20 Limited Pro bietet die größte Reichweite in unserem Sortiment: etwa 100 km dank zweier 48V 15.6AH Akkus. Die ideale Wahl für lange Strecken.',
      ar: 'V20 Limited Pro يوفر أطول مدى في مجموعتنا: حوالي 100 كم بفضل بطاريتيه 48V 15.6AH. الخيار المثالي للمسافات الطويلة.',
    },
  },
]

// ============ HOMEPAGE TRANSLATIONS ============
const homePageTranslations = {
  heroBanner: {
    title: {
      fr: 'Puissance Tout-Terrain',
      en: 'All-Terrain Power',
      es: 'Potencia Todo Terreno',
      nl: 'All-Terrain Kracht',
      de: 'Geländekraft',
      ar: 'قوة لجميع التضاريس',
    },
    subtitle: {
      fr: 'Performance Durable',
      en: 'Sustainable Performance',
      es: 'Rendimiento Duradero',
      nl: 'Duurzame Prestaties',
      de: 'Nachhaltige Leistung',
      ar: 'أداء مستدام',
    },
    description: {
      fr: 'Découvrez notre gamme de fatbikes électriques alliant puissance, style et respect de l\'environnement.',
      en: 'Discover our range of electric fatbikes combining power, style, and environmental responsibility.',
      es: 'Descubre nuestra gama de fatbikes eléctricas combinando potencia, estilo y respeto al medio ambiente.',
      nl: 'Ontdek ons assortiment elektrische fatbikes die kracht, stijl en milieuvriendelijkheid combineren.',
      de: 'Entdecken Sie unser Sortiment an elektrischen Fatbikes, die Kraft, Stil und Umweltfreundlichkeit vereinen.',
      ar: 'اكتشف مجموعتنا من الدراجات الكهربائية فات بايك التي تجمع بين القوة والأناقة والحفاظ على البيئة.',
    },
    ctaText: {
      fr: 'Découvrir nos vélos',
      en: 'Discover our bikes',
      es: 'Descubrir nuestras bicis',
      nl: 'Ontdek onze fietsen',
      de: 'Unsere Räder entdecken',
      ar: 'اكتشف دراجاتنا',
    },
    ctaLink: '/produits',
  },
  featuredProductsTitle: {
    fr: 'Nos Modèles Phares',
    en: 'Our Featured Models',
    es: 'Nuestros Modelos Estrella',
    nl: 'Onze Topmodellen',
    de: 'Unsere Top-Modelle',
    ar: 'نماذجنا المميزة',
  },
  featuredProductsSubtitle: {
    fr: 'Des vélos électriques conçus pour tous les terrains et tous les styles.',
    en: 'Electric bikes designed for all terrains and all styles.',
    es: 'Bicicletas eléctricas diseñadas para todos los terrenos y estilos.',
    nl: 'Elektrische fietsen ontworpen voor elk terrein en elke stijl.',
    de: 'Elektrofahrräder für jedes Gelände und jeden Stil.',
    ar: 'دراجات كهربائية مصممة لجميع التضاريس وجميع الأساليب.',
  },
  values: [
    {
      _key: 'val1',
      icon: 'battery-charging',
      title: {
        fr: 'Autonomie',
        en: 'Range',
        es: 'Autonomía',
        nl: 'Bereik',
        de: 'Reichweite',
        ar: 'المدى',
      },
      description: {
        fr: 'Jusqu\'à 100km d\'autonomie avec nos batteries haute capacité.',
        en: 'Up to 100km range with our high-capacity batteries.',
        es: 'Hasta 100km de autonomía con nuestras baterías de alta capacidad.',
        nl: 'Tot 100km bereik met onze accu\'s met hoge capaciteit.',
        de: 'Bis zu 100km Reichweite mit unseren Hochleistungsakkus.',
        ar: 'مدى يصل إلى 100 كم مع بطارياتنا عالية السعة.',
      },
    },
    {
      _key: 'val2',
      icon: 'shield-check',
      title: {
        fr: 'Qualité Premium',
        en: 'Premium Quality',
        es: 'Calidad Premium',
        nl: 'Premium Kwaliteit',
        de: 'Premium-Qualität',
        ar: 'جودة فاخرة',
      },
      description: {
        fr: 'Composants certifiés et garantie constructeur complète.',
        en: 'Certified components and full manufacturer warranty.',
        es: 'Componentes certificados y garantía completa del fabricante.',
        nl: 'Gecertificeerde componenten en volledige fabrieksgarantie.',
        de: 'Zertifizierte Komponenten und vollständige Herstellergarantie.',
        ar: 'مكونات معتمدة وضمان شامل من الشركة المصنعة.',
      },
    },
    {
      _key: 'val3',
      icon: 'truck',
      title: {
        fr: 'Livraison Rapide',
        en: 'Fast Delivery',
        es: 'Envío Rápido',
        nl: 'Snelle Levering',
        de: 'Schnelle Lieferung',
        ar: 'توصيل سريع',
      },
      description: {
        fr: 'Livraison offerte en France métropolitaine sous 5 jours.',
        en: 'Free delivery in mainland France within 5 days.',
        es: 'Envío gratuito en Francia metropolitana en 5 días.',
        nl: 'Gratis levering in Frankrijk binnen 5 dagen.',
        de: 'Kostenlose Lieferung in Frankreich innerhalb von 5 Tagen.',
        ar: 'توصيل مجاني في فرنسا خلال 5 أيام.',
      },
    },
    {
      _key: 'val4',
      icon: 'headset',
      title: {
        fr: 'SAV Réactif',
        en: 'Responsive Support',
        es: 'Servicio Postventa Reactivo',
        nl: 'Reactieve Klantenservice',
        de: 'Reaktionsschneller Kundendienst',
        ar: 'دعم فني سريع الاستجابة',
      },
      description: {
        fr: 'Support technique disponible 6j/7 pour vous accompagner.',
        en: 'Technical support available 6 days a week to assist you.',
        es: 'Soporte técnico disponible 6 días a la semana para asistirle.',
        nl: 'Technische ondersteuning beschikbaar 6 dagen per week.',
        de: 'Technischer Support 6 Tage die Woche für Sie verfügbar.',
        ar: 'دعم فني متاح 6 أيام في الأسبوع لمساعدتك.',
      },
    },
  ],
}

// ============ ABOUT PAGE TRANSLATIONS ============
const aboutPageTranslations = {
  title: {
    fr: 'À Propos de Vitesse Eco',
    en: 'About Vitesse Eco',
    es: 'Sobre Vitesse Eco',
    nl: 'Over Vitesse Eco',
    de: 'Über Vitesse Eco',
    ar: 'عن Vitesse Eco',
  },
  subtitle: {
    fr: 'Votre partenaire mobilité électrique depuis la France.',
    en: 'Your electric mobility partner from France.',
    es: 'Su socio de movilidad eléctrica desde Francia.',
    nl: 'Uw partner voor elektrische mobiliteit uit Frankrijk.',
    de: 'Ihr Partner für Elektromobilität aus Frankreich.',
    ar: 'شريكك في التنقل الكهربائي من فرنسا.',
  },
  story: {
    fr: 'Vitesse Eco est née d\'une passion pour la mobilité électrique et le respect de l\'environnement. Basée à Poitiers, France, notre mission est de rendre les fatbikes électriques accessibles à tous. Nous sélectionnons rigoureusement chaque modèle pour garantir qualité, performance et durabilité. VITESSE ECO est une SAS enregistrée sous le SIREN 100 732 247, spécialisée dans la vente de vélos électriques premium.',
    en: 'Vitesse Eco was born from a passion for electric mobility and environmental responsibility. Based in Poitiers, France, our mission is to make electric fatbikes accessible to everyone. We rigorously select each model to guarantee quality, performance, and durability. VITESSE ECO is a SAS registered under SIREN 100 732 247, specializing in the sale of premium electric bikes.',
    es: 'Vitesse Eco nació de una pasión por la movilidad eléctrica y el respeto al medio ambiente. Con sede en Poitiers, Francia, nuestra misión es hacer accesibles las fatbikes eléctricas para todos. Seleccionamos rigurosamente cada modelo para garantizar calidad, rendimiento y durabilidad. VITESSE ECO es una SAS registrada bajo el SIREN 100 732 247, especializada en la venta de bicicletas eléctricas premium.',
    nl: 'Vitesse Eco is geboren uit een passie voor elektrische mobiliteit en respect voor het milieu. Gevestigd in Poitiers, Frankrijk, is onze missie om elektrische fatbikes toegankelijk te maken voor iedereen. We selecteren elk model zorgvuldig om kwaliteit, prestaties en duurzaamheid te garanderen. VITESSE ECO is een SAS geregistreerd onder SIREN 100 732 247, gespecialiseerd in de verkoop van premium elektrische fietsen.',
    de: 'Vitesse Eco entstand aus einer Leidenschaft für Elektromobilität und Umweltschutz. Mit Sitz in Poitiers, Frankreich, ist unsere Mission, elektrische Fatbikes für alle zugänglich zu machen. Wir wählen jedes Modell sorgfältig aus, um Qualität, Leistung und Langlebigkeit zu garantieren. VITESSE ECO ist eine SAS, registriert unter SIREN 100 732 247, spezialisiert auf den Verkauf von Premium-Elektrofahrrädern.',
    ar: 'وُلدت Vitesse Eco من شغف بالتنقل الكهربائي والحفاظ على البيئة. يقع مقرنا في بواتييه، فرنسا، ومهمتنا هي جعل الدراجات الكهربائية فات بايك في متناول الجميع. نختار بعناية فائقة كل نموذج لضمان الجودة والأداء والمتانة. VITESSE ECO هي شركة SAS مسجلة تحت رقم SIREN 100 732 247، متخصصة في بيع الدراجات الكهربائية الفاخرة.',
  },
  values: [
    {
      _key: 'av1',
      icon: 'seal-check',
      title: {
        fr: 'Qualité Garantie',
        en: 'Guaranteed Quality',
        es: 'Calidad Garantizada',
        nl: 'Gegarandeerde Kwaliteit',
        de: 'Garantierte Qualität',
        ar: 'جودة مضمونة',
      },
      description: {
        fr: 'Tous nos vélos sont équipés de composants premium : moteur 250W, freins hydrauliques, batteries haute capacité.',
        en: 'All our bikes are equipped with premium components: 250W motor, hydraulic brakes, high-capacity batteries.',
        es: 'Todas nuestras bicicletas están equipadas con componentes premium: motor 250W, frenos hidráulicos, baterías de alta capacidad.',
        nl: 'Al onze fietsen zijn uitgerust met premium componenten: 250W motor, hydraulische remmen, accu\'s met hoge capaciteit.',
        de: 'Alle unsere Fahrräder sind mit Premium-Komponenten ausgestattet: 250W Motor, hydraulische Bremsen, Hochleistungsakkus.',
        ar: 'جميع دراجاتنا مجهزة بمكونات فاخرة: محرك 250 واط، فرامل هيدروليكية، بطاريات عالية السعة.',
      },
    },
    {
      _key: 'av2',
      icon: 'truck',
      title: {
        fr: 'Livraison Soignée',
        en: 'Careful Delivery',
        es: 'Entrega Cuidadosa',
        nl: 'Zorgvuldige Levering',
        de: 'Sorgfältige Lieferung',
        ar: 'توصيل عناية فائقة',
      },
      description: {
        fr: 'Chaque vélo est soigneusement emballé et livré à votre porte en France métropolitaine sous 5 jours ouvrés.',
        en: 'Each bike is carefully packaged and delivered to your door in mainland France within 5 business days.',
        es: 'Cada bicicleta se embala cuidadosamente y se entrega en su puerta en Francia metropolitana en 5 días hábiles.',
        nl: 'Elke fiets wordt zorgvuldig verpakt en binnen 5 werkdagen aan uw deur in Frankrijk geleverd.',
        de: 'Jedes Fahrrad wird sorgfältig verpackt und innerhalb von 5 Werktagen an Ihre Haustür in Frankreich geliefert.',
        ar: 'يتم تغليف كل دراجة بعناية وتوصيلها إلى باب منزلك في فرنسا خلال 5 أيام عمل.',
      },
    },
    {
      _key: 'av3',
      icon: 'wrench',
      title: {
        fr: 'SAV Dédié',
        en: 'Dedicated After-Sales Service',
        es: 'Servicio Postventa Dedicado',
        nl: 'Toegewijd Onderhoud',
        de: 'Engagierter Kundendienst',
        ar: 'خدمة ما بعد البيع مخصصة',
      },
      description: {
        fr: 'Notre équipe technique est disponible 6 jours sur 7 pour vous accompagner et répondre à toutes vos questions.',
        en: 'Our technical team is available 6 days a week to assist you and answer all your questions.',
        es: 'Nuestro equipo técnico está disponible 6 días a la semana para asistirle y responder a todas sus preguntas.',
        nl: 'Ons technisch team is 6 dagen per week beschikbaar om u te helpen en al uw vragen te beantwoorden.',
        de: 'Unser technisches Team steht Ihnen 6 Tage die Woche zur Verfügung, um Sie zu unterstützen und alle Ihre Fragen zu beantworten.',
        ar: 'فريقنا التقني متاح 6 أيام في الأسبوع لمساعدتك والإجابة على جميع أسئلتك.',
      },
    },
  ],
}

// ============ MAIN UPDATE FUNCTION ============
async function updateTranslations() {
  console.log('🌍 Updating translations to 6 languages (fr, en, es, nl, de, ar)...\n')

  // 1. Update Products
  console.log('🚲 Updating product translations...')
  for (const p of productTranslations) {
    try {
      await client
        .patch(p._id)
        .set({
          shortDescription: p.shortDescription,
          description: p.description,
        })
        .commit()
      console.log(`   ✅ ${p._id}`)
    } catch (err) {
      console.error(`   ❌ ${p._id}: ${err.message}`)
    }
  }

  // 2. Update Homepage
  console.log('\n🏠 Updating homepage translations...')
  try {
    await client
      .patch('homePage')
      .set(homePageTranslations)
      .commit()
    console.log('   ✅ homePage')
  } catch (err) {
    console.error(`   ❌ homePage: ${err.message}`)
  }

  // 3. Update About Page
  console.log('\n📄 Updating about page translations...')
  try {
    await client
      .patch('aboutPage')
      .set(aboutPageTranslations)
      .commit()
    console.log('   ✅ aboutPage')
  } catch (err) {
    console.error(`   ❌ aboutPage: ${err.message}`)
  }

  console.log('\n🎉 Translation update complete!')
}

updateTranslations().catch(err => {
  console.error('❌ Update failed:', err.message)
  process.exit(1)
})
