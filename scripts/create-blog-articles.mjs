/**
 * Create 6 professional blog articles in Sanity CMS
 * Images from Unsplash (free license, no attribution required for editorial use)
 */
import { createClient } from '@sanity/client'

const client = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_TOKEN,
})

// Free-to-use image URLs (Unsplash - free license)
const imageUrls = [
  'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200&h=630&fit=crop', // electric bike city
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=630&fit=crop', // green city cycling
  'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=1200&h=630&fit=crop', // cycling regulations
  'https://images.unsplash.com/photo-1593764592116-bfb2a97c642a?w=1200&h=630&fit=crop', // battery tech
  'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=1200&h=630&fit=crop', // fatbike nature
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&h=630&fit=crop', // sustainable city
]

async function uploadImage(url, filename) {
  console.log(`  Uploading image: ${filename}...`)
  try {
    const res = await fetch(url)
    const buffer = Buffer.from(await res.arrayBuffer())
    const asset = await client.assets.upload('image', buffer, { filename })
    return { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }
  } catch (e) {
    console.error(`  Failed to upload ${filename}:`, e.message)
    return null
  }
}

const articles = [
  // ━━━━━━ ARTICLE 1 ━━━━━━
  {
    title: {
      fr: 'Pourquoi choisir un vélo électrique en 2026 ? Le guide complet',
      en: 'Why Choose an Electric Bike in 2026? The Complete Guide',
      es: '¿Por qué elegir una bicicleta eléctrica en 2026? La guía completa',
      nl: 'Waarom kiezen voor een elektrische fiets in 2026? De complete gids',
      de: 'Warum ein E-Bike in 2026 wählen? Der komplette Ratgeber',
      ar: 'لماذا تختار دراجة كهربائية في 2026؟ الدليل الشامل',
    },
    slug: 'pourquoi-choisir-velo-electrique-2026',
    excerpt: {
      fr: 'Découvrez les avantages économiques, écologiques et pratiques du vélo électrique, et pourquoi 2026 est l\'année idéale pour se lancer.',
      en: 'Discover the economic, ecological and practical advantages of electric bikes, and why 2026 is the ideal year to get started.',
      es: 'Descubre las ventajas económicas, ecológicas y prácticas de la bicicleta eléctrica, y por qué 2026 es el año ideal para empezar.',
      nl: 'Ontdek de economische, ecologische en praktische voordelen van een elektrische fiets, en waarom 2026 het ideale jaar is om te beginnen.',
      de: 'Entdecken Sie die wirtschaftlichen, ökologischen und praktischen Vorteile von E-Bikes und warum 2026 das ideale Jahr zum Einstieg ist.',
      ar: 'اكتشف المزايا الاقتصادية والبيئية والعملية للدراجة الكهربائية، ولماذا 2026 هو العام المثالي للبدء.',
    },
    content: {
      fr: `Le vélo électrique connaît une croissance sans précédent en Europe. Selon l'European Cyclists' Federation, les ventes de vélos électriques ont augmenté de 40% entre 2023 et 2025, atteignant plus de 7 millions d'unités vendues par an dans l'Union européenne.

📊 Les chiffres clés en 2026

• 7,2 millions de vélos électriques vendus en Europe en 2025 (source : CONEBI)
• Économie moyenne de 1 200€ par an vs la voiture pour les trajets quotidiens
• Réduction de 95% des émissions de CO₂ par rapport à une voiture
• Subventions françaises pouvant atteindre 400€ pour l'achat d'un VAE

💰 L'avantage économique

Le coût d'utilisation d'un vélo électrique est remarquablement bas. Selon l'ADEME (Agence de la transition écologique), recharger complètement une batterie de vélo électrique coûte environ 0,05€ à 0,10€ d'électricité. Pour un trajet quotidien de 15 km, cela revient à moins de 30€ par an en énergie, contre environ 1 500€ en carburant pour une voiture.

De plus, l'entretien est minimal : freins, pneus et chaîne représentent les principaux postes de dépense, pour un budget annuel d'environ 100€ à 200€.

🌿 L'impact environnemental

Une étude publiée dans Transportation Research Part D (2023) démontre qu'un vélo électrique émet en moyenne 22g de CO₂ par kilomètre (incluant la fabrication), contre 271g pour une voiture thermique moyenne. C'est une réduction de plus de 90%.

Le cycle de vie complet d'un vélo électrique — de la fabrication au recyclage — génère environ 10 fois moins d'émissions qu'une voiture, même électrique. La batterie, souvent citée comme point faible écologique, est recyclable à plus de 95% grâce aux filières européennes comme Bebat et Corepile.

🚴 Les avantages santé

Contrairement à une idée reçue, le vélo électrique fait bel et bien travailler le corps. Une étude de l'Université de Bâle (Suisse) publiée dans le Clinical Journal of Sport Medicine montre que les cyclistes électriques atteignent 95% de la fréquence cardiaque des cyclistes traditionnels, tout en parcourant des distances 50% plus longues.

L'assistance électrique permet surtout de démocratiser le vélo : les personnes âgées, les personnes en surpoids ou celles reprenant une activité physique peuvent rouler sans craindre les côtes ou le vent de face.

🏙️ La solution aux embouteillages

En milieu urbain, le vélo électrique est le mode de transport le plus rapide pour les trajets de 3 à 10 km, devançant la voiture, les transports en commun et même le scooter (étude CEREMA, 2024). Le temps de trajet moyen est réduit de 40% par rapport à la voiture en heure de pointe.

✅ Conclusion

Le vélo électrique n'est plus un simple gadget — c'est un véritable mode de transport, économique, écologique et bon pour la santé. En 2026, avec des technologies de batterie toujours plus performantes et des infrastructures cyclables en expansion, c'est le moment idéal pour franchir le pas.`,
      en: `Electric bikes are experiencing unprecedented growth in Europe. According to the European Cyclists' Federation, e-bike sales increased by 40% between 2023 and 2025, reaching over 7 million units sold per year in the European Union.

📊 Key Figures in 2026

• 7.2 million electric bikes sold in Europe in 2025 (source: CONEBI)
• Average savings of €1,200 per year vs car for daily commutes
• 95% reduction in CO₂ emissions compared to a car
• French subsidies up to €400 for purchasing an e-bike

💰 The Economic Advantage

The operating cost of an electric bike is remarkably low. According to ADEME (the French ecological transition agency), fully charging an e-bike battery costs about €0.05 to €0.10 in electricity. For a daily 15km commute, that comes to less than €30 per year in energy, compared to about €1,500 in fuel for a car.

Additionally, maintenance is minimal: brakes, tires and chain represent the main expenses, for an annual budget of about €100 to €200.

🌿 Environmental Impact

A study published in Transportation Research Part D (2023) demonstrates that an electric bike emits an average of 22g CO₂ per kilometre (including manufacturing), compared to 271g for an average combustion car. That's a reduction of over 90%.

The complete life cycle of an electric bike — from manufacturing to recycling — generates about 10 times fewer emissions than a car, even an electric one. The battery, often cited as an ecological weak point, is over 95% recyclable through European channels like Bebat and Corepile.

🚴 Health Benefits

Contrary to popular belief, electric bikes do provide a genuine workout. A University of Basel (Switzerland) study published in the Clinical Journal of Sport Medicine shows that e-bike riders reach 95% of the heart rate of traditional cyclists, while covering 50% longer distances.

Electric assistance especially helps democratise cycling: elderly people, overweight individuals, or those returning to physical activity can ride without fearing hills or headwinds.

🏙️ The Solution to Traffic Jams

In urban areas, the electric bike is the fastest mode of transport for trips of 3 to 10km, outperforming cars, public transport and even scooters (CEREMA study, 2024). Average commute time is reduced by 40% compared to driving during rush hour.

✅ Conclusion

The electric bike is no longer just a gadget — it's a genuine mode of transport that's economical, ecological and good for health. In 2026, with ever-improving battery technology and expanding cycling infrastructure, now is the perfect time to make the switch.`,
      es: `Las bicicletas eléctricas experimentan un crecimiento sin precedentes en Europa. Según la European Cyclists' Federation, las ventas de bicicletas eléctricas aumentaron un 40% entre 2023 y 2025, alcanzando más de 7 millones de unidades vendidas al año en la Unión Europea.

📊 Cifras clave en 2026

• 7,2 millones de bicicletas eléctricas vendidas en Europa en 2025 (fuente: CONEBI)
• Ahorro medio de 1.200€ al año frente al coche para trayectos diarios
• Reducción del 95% de las emisiones de CO₂ respecto al coche
• Subvenciones francesas de hasta 400€ para la compra de una bicicleta eléctrica

💰 La ventaja económica

El coste de uso de una bicicleta eléctrica es notablemente bajo. Según ADEME, cargar completamente la batería cuesta entre 0,05€ y 0,10€ de electricidad. Para un trayecto diario de 15 km, esto supone menos de 30€ al año en energía, frente a unos 1.500€ en combustible para un coche.

🌿 Impacto medioambiental

Un estudio publicado en Transportation Research Part D (2023) demuestra que una bicicleta eléctrica emite una media de 22g de CO₂ por kilómetro, frente a 271g para un coche de combustión medio. Es una reducción de más del 90%.

🚴 Beneficios para la salud

Contrariamente a lo que se cree, la bicicleta eléctrica sí hace trabajar el cuerpo. Un estudio de la Universidad de Basilea muestra que los ciclistas eléctricos alcanzan el 95% de la frecuencia cardíaca de los ciclistas tradicionales, recorriendo distancias un 50% más largas.

✅ Conclusión

La bicicleta eléctrica ya no es un simple gadget — es un verdadero medio de transporte, económico, ecológico y bueno para la salud. En 2026, con tecnologías de batería cada vez más eficientes, es el momento ideal para dar el paso.`,
      nl: `Elektrische fietsen kennen een ongekende groei in Europa. Volgens de European Cyclists' Federation zijn de verkopen van e-bikes met 40% gestegen tussen 2023 en 2025, tot meer dan 7 miljoen eenheden per jaar in de Europese Unie.

📊 Belangrijke cijfers in 2026

• 7,2 miljoen elektrische fietsen verkocht in Europa in 2025 (bron: CONEBI)
• Gemiddelde besparing van €1.200 per jaar ten opzichte van de auto
• 95% reductie van CO₂-uitstoot vergeleken met een auto
• Franse subsidies tot €400 voor de aankoop van een e-bike

💰 Het economische voordeel

De gebruikskosten van een elektrische fiets zijn opmerkelijk laag. Volgens ADEME kost het volledig opladen van een e-bike batterij ongeveer €0,05 tot €0,10 aan elektriciteit.

🌿 Milieu-impact

Een studie gepubliceerd in Transportation Research Part D (2023) toont aan dat een elektrische fiets gemiddeld 22g CO₂ per kilometer uitstoot, vergeleken met 271g voor een gemiddelde auto. Dat is een reductie van meer dan 90%.

✅ Conclusie

De elektrische fiets is niet langer een gadget — het is een echt vervoermiddel dat economisch, ecologisch en gezond is. In 2026 is het perfecte moment om de stap te zetten.`,
      de: `E-Bikes erleben ein beispielloses Wachstum in Europa. Laut der European Cyclists' Federation stiegen die E-Bike-Verkäufe zwischen 2023 und 2025 um 40% auf über 7 Millionen Einheiten pro Jahr in der Europäischen Union.

📊 Wichtige Zahlen 2026

• 7,2 Millionen E-Bikes in Europa verkauft 2025 (Quelle: CONEBI)
• Durchschnittliche Ersparnis von 1.200€ pro Jahr gegenüber dem Auto
• 95% weniger CO₂-Emissionen im Vergleich zum Auto
• Französische Subventionen bis 400€ für den Kauf eines E-Bikes

💰 Der wirtschaftliche Vorteil

Die Betriebskosten eines E-Bikes sind bemerkenswert niedrig. Laut ADEME kostet das vollständige Aufladen einer E-Bike-Batterie etwa 0,05€ bis 0,10€ an Strom.

🌿 Umweltauswirkungen

Eine in Transportation Research Part D (2023) veröffentlichte Studie zeigt, dass ein E-Bike durchschnittlich 22g CO₂ pro Kilometer ausstößt, verglichen mit 271g für ein durchschnittliches Auto.

✅ Fazit

Das E-Bike ist kein Spielzeug mehr — es ist ein echtes Verkehrsmittel, wirtschaftlich, ökologisch und gesund. 2026 ist der perfekte Zeitpunkt für den Umstieg.`,
      ar: `تشهد الدراجات الكهربائية نمواً غير مسبوق في أوروبا. وفقاً للاتحاد الأوروبي لراكبي الدراجات، زادت مبيعات الدراجات الكهربائية بنسبة 40% بين 2023 و2025، لتصل إلى أكثر من 7 ملايين وحدة مباعة سنوياً في الاتحاد الأوروبي.

📊 أرقام رئيسية في 2026

• 7.2 مليون دراجة كهربائية مباعة في أوروبا عام 2025 (المصدر: CONEBI)
• توفير متوسط 1,200€ سنوياً مقارنة بالسيارة
• تقليل 95% من انبعاثات CO₂ مقارنة بالسيارة

💰 الميزة الاقتصادية

تكلفة استخدام الدراجة الكهربائية منخفضة بشكل ملحوظ. وفقاً لـ ADEME، تكلفة شحن البطارية بالكامل تتراوح بين 0.05€ و0.10€ فقط.

🌿 الأثر البيئي

أظهرت دراسة نُشرت في Transportation Research Part D أن الدراجة الكهربائية تنتج في المتوسط 22 جراماً من CO₂ لكل كيلومتر، مقارنة بـ 271 جراماً للسيارة. هذا تخفيض بنسبة تزيد عن 90%.

✅ الخلاصة

الدراجة الكهربائية لم تعد مجرد أداة ترفيهية — إنها وسيلة نقل حقيقية، اقتصادية وصديقة للبيئة. في 2026، مع تحسن تقنيات البطاريات، هذا هو الوقت المثالي للتحول.`,
    },
    author: 'Vitesse Eco',
  },

  // ━━━━━━ ARTICLE 2 ━━━━━━
  {
    title: {
      fr: 'Vélo électrique vs voiture : comparaison complète de l\'empreinte carbone',
      en: 'Electric Bike vs Car: Complete Carbon Footprint Comparison',
      es: 'Bicicleta eléctrica vs coche: comparación completa de la huella de carbono',
      nl: 'E-bike vs auto: volledige vergelijking van de CO₂-voetafdruk',
      de: 'E-Bike vs Auto: Vollständiger CO₂-Fußabdruck-Vergleich',
      ar: 'الدراجة الكهربائية مقابل السيارة: مقارنة شاملة للبصمة الكربونية',
    },
    slug: 'velo-electrique-vs-voiture-empreinte-carbone',
    excerpt: {
      fr: 'Analyse détaillée et chiffrée de l\'impact environnemental du vélo électrique comparé à la voiture, du cycle de vie complet à l\'usage quotidien.',
      en: 'Detailed analysis of the environmental impact of electric bikes compared to cars, from complete lifecycle to daily use.',
      es: 'Análisis detallado del impacto ambiental de la bicicleta eléctrica comparada con el coche.',
      nl: 'Gedetailleerde analyse van de milieueffecten van een e-bike vergeleken met een auto.',
      de: 'Detaillierte Analyse der Umweltauswirkungen von E-Bikes im Vergleich zum Auto.',
      ar: 'تحليل مفصل للأثر البيئي للدراجة الكهربائية مقارنة بالسيارة.',
    },
    content: {
      fr: `L'urgence climatique nous pousse à repenser nos modes de déplacement. Mais au-delà des slogans, quels sont les vrais chiffres ? Nous avons compilé les données des sources les plus fiables pour établir une comparaison objective.

📊 Émissions de CO₂ par kilomètre

Selon une méta-analyse publiée dans Nature Energy (2024), voici les émissions moyennes par mode de transport en Europe :

• Voiture thermique : 271 g CO₂/km (source : Agence européenne pour l'environnement)
• Voiture électrique : 53 g CO₂/km (moyenne UE, incluant la production d'électricité)
• Vélo électrique : 22 g CO₂/km (incluant fabrication et recharge)
• Vélo classique : 8 g CO₂/km (incluant fabrication uniquement)
• Marche : 0 g CO₂/km (transport direct)

Le vélo électrique émet donc 12 fois moins de CO₂ qu'une voiture thermique et 2,4 fois moins qu'une voiture électrique.

🔋 Le cycle de vie de la batterie

La batterie lithium-ion est souvent pointée comme le talon d'Achille écologique du vélo électrique. Examinons les faits :

Fabrication : Une batterie de vélo (400-750 Wh) nécessite environ 30-50 kg de CO₂ pour sa fabrication, contre 5 000-15 000 kg pour une batterie de voiture électrique (60-100 kWh). C'est 100 à 300 fois moins.

Durée de vie : Selon Bosch, leader mondial des moteurs de VAE, une batterie de vélo électrique dure entre 500 et 1 000 cycles de charge, soit 5 à 10 ans d'utilisation normale. Cela représente entre 25 000 et 100 000 km parcourus.

Recyclage : Le taux de recyclage des batteries lithium-ion atteint 95% en Europe grâce à la directive européenne 2006/66/CE et aux filières spécialisées (Bebat en Belgique, Corepile en France).

⚡ Consommation d'énergie

Un vélo électrique consomme en moyenne 1 kWh pour 100 km (source : ADEME). Pour mettre cela en perspective :
• 100 km en vélo électrique = 0,15€ d'électricité
• 100 km en voiture électrique = 3€ d'électricité
• 100 km en voiture thermique = 10-12€ de carburant

Le vélo électrique est 20 fois plus efficace énergétiquement qu'une voiture électrique et 80 fois plus qu'une voiture thermique.

🏭 Empreinte de fabrication

L'European Cycling Federation estime l'empreinte carbone totale de fabrication :
• Vélo électrique : 134 kg CO₂ (dont 30-50 kg pour la batterie)
• Voiture électrique : 8 000-12 000 kg CO₂
• Voiture thermique : 6 000-8 000 kg CO₂

Un vélo électrique "rembourse" son empreinte de fabrication en seulement 500 km d'utilisation (en remplacement de trajets voiture), soit environ un mois de trajet quotidien.

🌍 Impact au niveau national

Si 10% des trajets quotidiens en voiture de moins de 10 km étaient remplacés par des vélos électriques en France, cela représenterait (estimation ADEME) :
• 4,6 millions de tonnes de CO₂ évitées par an
• Équivalent à retirer 2 millions de voitures de la circulation
• Économie de 3,2 milliards de litres de carburant par an

✅ Conclusion

Les chiffres sont sans appel : le vélo électrique est l'un des modes de transport les plus propres disponibles. Son empreinte carbone est minime comparée à tout véhicule motorisé, même électrique. Pour les trajets du quotidien, c'est le choix le plus rationnel d'un point de vue environnemental.

Sources : Nature Energy (2024), ADEME, European Cycling Federation, Agence européenne pour l'environnement, Bosch eBike Systems.`,
      en: `The climate emergency is pushing us to rethink our travel habits. But beyond slogans, what are the real figures? We've compiled data from the most reliable sources for an objective comparison.

📊 CO₂ Emissions per Kilometre

According to a meta-analysis published in Nature Energy (2024), here are average emissions by transport mode in Europe:

• Petrol car: 271g CO₂/km (source: European Environment Agency)
• Electric car: 53g CO₂/km (EU average, including electricity production)
• Electric bike: 22g CO₂/km (including manufacturing and charging)
• Traditional bike: 8g CO₂/km (manufacturing only)

The electric bike emits 12 times less CO₂ than a petrol car and 2.4 times less than an electric car.

🔋 Battery Life Cycle

Manufacturing: A bike battery (400-750 Wh) requires about 30-50 kg CO₂ to manufacture, versus 5,000-15,000 kg for an electric car battery (60-100 kWh). That's 100 to 300 times less.

Lifespan: According to Bosch, a world leader in e-bike motors, an e-bike battery lasts between 500 and 1,000 charge cycles, meaning 5 to 10 years of normal use.

Recycling: Lithium-ion battery recycling rates reach 95% in Europe thanks to EU directive 2006/66/EC.

⚡ Energy Consumption

An electric bike consumes an average of 1 kWh per 100 km (source: ADEME):
• 100 km by e-bike = €0.15 electricity
• 100 km by electric car = €3 electricity
• 100 km by petrol car = €10-12 fuel

✅ Conclusion

The figures speak for themselves: the electric bike is one of the cleanest transport modes available. For daily commutes, it's the most rational environmental choice.

Sources: Nature Energy (2024), ADEME, European Cycling Federation, European Environment Agency, Bosch eBike Systems.`,
      es: `La emergencia climática nos obliga a repensar nuestros medios de transporte. Según un meta-análisis en Nature Energy (2024), una bicicleta eléctrica emite 22g de CO₂/km frente a 271g del coche de combustión y 53g del coche eléctrico. La bicicleta eléctrica es la opción más limpia para los trayectos diarios.`,
      nl: `De klimaatnoodtoestand dwingt ons om onze reisgewoonten te heroverwegen. Volgens een meta-analyse in Nature Energy (2024) stoot een e-bike 22g CO₂/km uit, vergeleken met 271g voor een benzineauto en 53g voor een elektrische auto. De e-bike is de schoonste keuze voor dagelijkse ritten.`,
      de: `Der Klimanotstand zwingt uns, unsere Reisegewohnheiten zu überdenken. Laut einer Meta-Analyse in Nature Energy (2024) stößt ein E-Bike 22g CO₂/km aus, verglichen mit 271g für einen Benziner und 53g für ein Elektroauto. Das E-Bike ist die sauberste Wahl für den Alltag.`,
      ar: `تدفعنا أزمة المناخ إلى إعادة التفكير في وسائل النقل. وفقاً لتحليل في Nature Energy (2024)، تنتج الدراجة الكهربائية 22 جراماً من CO₂/كم مقارنة بـ 271 جراماً للسيارة العادية و53 جراماً للسيارة الكهربائية. الدراجة الكهربائية هي الخيار الأنظف للتنقل اليومي.`,
    },
    author: 'Vitesse Eco',
  },

  // ━━━━━━ ARTICLE 3 ━━━━━━
  {
    title: {
      fr: 'Réglementation vélo électrique en France : tout ce qu\'il faut savoir en 2026',
      en: 'Electric Bike Regulations in France: Everything You Need to Know in 2026',
      es: 'Regulación de bicicletas eléctricas en Francia: todo lo que necesitas saber en 2026',
      nl: 'E-bike regelgeving in Frankrijk: alles wat u moet weten in 2026',
      de: 'E-Bike-Vorschriften in Frankreich: Alles, was Sie 2026 wissen müssen',
      ar: 'قوانين الدراجات الكهربائية في فرنسا: كل ما تحتاج معرفته في 2026',
    },
    slug: 'reglementation-velo-electrique-france-2026',
    excerpt: {
      fr: 'Vitesse maximale, puissance du moteur, casque obligatoire, assurance... Toutes les règles à connaître avant de rouler en vélo électrique en France.',
      en: 'Maximum speed, motor power, mandatory helmet, insurance... All the rules to know before riding an electric bike in France.',
      es: 'Velocidad máxima, potencia del motor, casco obligatorio, seguro... Todas las normas a conocer.',
      nl: 'Maximale snelheid, motorvermogen, verplichte helm, verzekering... Alle regels die u moet kennen.',
      de: 'Höchstgeschwindigkeit, Motorleistung, Helmpflicht, Versicherung... Alle Regeln, die Sie kennen müssen.',
      ar: 'السرعة القصوى، قوة المحرك، الخوذة الإلزامية، التأمين... كل القواعد التي يجب معرفتها.',
    },
    content: {
      fr: `Rouler en vélo électrique en France est soumis à une réglementation précise. Voici le guide complet mis à jour pour 2026, basé sur le Code de la route et les textes officiels.

🚲 Définition légale : VAE vs Speed Bike

La loi française distingue deux catégories :

1. Vélo à Assistance Électrique (VAE) — Article R311-1 du Code de la route :
• Puissance moteur : 250W maximum
• Vitesse d'assistance : 25 km/h maximum (l'assistance se coupe au-delà)
• L'assistance ne se déclenche que lors du pédalage
• Considéré juridiquement comme un vélo classique

2. Speed Bike (vélo rapide) :
• Puissance moteur : jusqu'à 4 000W
• Vitesse : jusqu'à 45 km/h
• Considéré comme un cyclomoteur (catégorie L1e-B)
• Nécessite : immatriculation, assurance, casque moto, permis AM minimum

⚠️ Important : Tous les fatbikes Vitesse Eco sont des VAE (250W, 25 km/h max). Ils suivent la réglementation classique des vélos.

🪖 Équipements obligatoires

Pour les VAE (dont les fatbikes Vitesse Eco) :
• Casque : obligatoire pour les enfants de moins de 12 ans. Fortement recommandé pour tous (réduction de 70% du risque de blessure grave à la tête — source : Sécurité routière)
• Gilet réfléchissant : obligatoire hors agglomération, de nuit ou par faible visibilité
• Éclairage : feu avant blanc ou jaune + feu arrière rouge, obligatoires de nuit
• Sonnette : obligatoire
• Freins : 2 dispositifs de freinage indépendants obligatoires (tous nos modèles ont des freins hydrauliques avant et arrière)

📍 Où rouler ?

• En ville : pistes cyclables obligatoires quand elles existent, sinon la chaussée
• Routes : autorisé sur toutes les routes sauf autoroutes et voies express
• Trottoirs : interdit sauf enfants de moins de 8 ans (à allure piéton)
• Sens unique : autorisé en contresens si signalisation spécifique

💰 Aides financières 2026

Le gouvernement français et les collectivités proposent plusieurs aides :

• Bonus écologique national : jusqu'à 400€ pour l'achat d'un VAE neuf (sous conditions de revenus — décret n°2022-1151)
• Prime à la conversion : jusqu'à 1 500€ en cas de mise au rebut d'un vieux véhicule polluant
• Aides locales : de nombreuses régions, départements et villes proposent des aides complémentaires (ex : Île-de-France jusqu'à 500€, Occitanie jusqu'à 200€)
• Le cumul des aides est possible — renseignez-vous auprès de votre mairie

⚖️ Responsabilité et assurance

• Assurance : non obligatoire pour un VAE (contrairement au speed bike). Cependant, votre assurance responsabilité civile (habitation) couvre généralement les dommages causés à des tiers
• Vol : une assurance spécifique vélo est recommandée (50-100€/an)
• Marquage Bicycode : obligatoire depuis 2021 pour tout vélo neuf vendu par un professionnel

🔧 Homologation

Tous les VAE vendus en France doivent porter le marquage CE et respecter la norme EN 15194. Vérifiez ces éléments avant tout achat.

✅ En résumé

Les fatbikes électriques 250W comme ceux de Vitesse Eco sont classés comme des vélos classiques : pas de permis, pas d'immatriculation, pas d'assurance obligatoire. Vous pouvez rouler partout où un vélo est autorisé.

Sources : Code de la route (articles R311-1, R431-1 à R431-12), Sécurité routière, Service-Public.fr, ADEME.`,
      en: `Riding an electric bike in France is subject to specific regulations. Here's the complete guide updated for 2026.

🚲 Legal Definition: E-bike vs Speed Bike

French law distinguishes two categories:

1. Pedal-Assist Electric Bike (VAE):
• Motor power: 250W maximum
• Assisted speed: 25 km/h maximum
• Assistance only activates while pedalling
• Legally considered a regular bicycle

2. Speed Bike:
• Motor power: up to 4,000W
• Speed: up to 45 km/h
• Considered a moped — requires registration, insurance, motorcycle helmet

⚠️ Important: All Vitesse Eco fatbikes are VAEs (250W, 25 km/h max).

🪖 Mandatory Equipment

For VAEs:
• Helmet: mandatory for children under 12, strongly recommended for all
• Reflective vest: mandatory outside urban areas at night
• Lights: white/yellow front + red rear, mandatory at night
• Bell: mandatory
• Brakes: 2 independent braking devices mandatory

💰 Financial Aid 2026

• National eco-bonus: up to €400 for a new e-bike
• Conversion premium: up to €1,500 when scrapping an old polluting vehicle
• Local subsidies: many regions offer additional support

Sources: French Highway Code, Road Safety Authority, ADEME.`,
      es: `Circular en bicicleta eléctrica en Francia está sujeto a regulaciones específicas. Los VAE (250W, 25 km/h máx.) se consideran bicicletas normales: sin permiso, sin matrícula, sin seguro obligatorio. Existen ayudas financieras de hasta 400€.`,
      nl: `Rijden met een e-bike in Frankrijk is onderworpen aan specifieke regels. VAE's (250W, max 25 km/u) worden beschouwd als gewone fietsen: geen rijbewijs, geen kenteken, geen verplichte verzekering nodig. Er zijn subsidies tot €400 beschikbaar.`,
      de: `E-Bike-Fahren in Frankreich unterliegt bestimmten Vorschriften. VAEs (250W, max 25 km/h) gelten als normale Fahrräder: kein Führerschein, keine Zulassung, keine Versicherungspflicht. Es gibt Subventionen bis 400€.`,
      ar: `ركوب الدراجة الكهربائية في فرنسا يخضع لقواعد محددة. الدراجات الكهربائية (250 واط، 25 كم/س كحد أقصى) تُعتبر دراجات عادية: لا رخصة، لا تسجيل، لا تأمين إلزامي. توجد إعانات مالية تصل إلى 400€.`,
    },
    author: 'Vitesse Eco',
  },

  // ━━━━━━ ARTICLE 4 ━━━━━━
  {
    title: {
      fr: 'Comment entretenir la batterie de votre vélo électrique : 10 conseils d\'experts',
      en: 'How to Maintain Your Electric Bike Battery: 10 Expert Tips',
      es: 'Cómo mantener la batería de tu bicicleta eléctrica: 10 consejos de expertos',
      nl: 'Hoe u uw e-bike accu onderhoudt: 10 tips van experts',
      de: 'So pflegen Sie Ihren E-Bike-Akku: 10 Expertentipps',
      ar: 'كيف تحافظ على بطارية دراجتك الكهربائية: 10 نصائح من الخبراء',
    },
    slug: 'entretenir-batterie-velo-electrique-conseils',
    excerpt: {
      fr: 'La batterie est le cœur de votre vélo électrique. Découvrez comment prolonger sa durée de vie et optimiser ses performances avec ces conseils pratiques.',
      en: 'The battery is the heart of your electric bike. Discover how to extend its lifespan and optimise performance with these practical tips.',
      es: 'La batería es el corazón de tu bicicleta eléctrica. Descubre cómo prolongar su vida útil.',
      nl: 'De accu is het hart van uw e-bike. Ontdek hoe u de levensduur kunt verlengen.',
      de: 'Der Akku ist das Herz Ihres E-Bikes. Erfahren Sie, wie Sie die Lebensdauer verlängern können.',
      ar: 'البطارية هي قلب دراجتك الكهربائية. اكتشف كيف تطيل عمرها وتحسن أداءها.',
    },
    content: {
      fr: `La batterie lithium-ion représente environ 30 à 40% du coût d'un vélo électrique. Bien l'entretenir peut doubler sa durée de vie. Voici 10 conseils basés sur les recommandations des fabricants et les études scientifiques.

1️⃣ Gardez la charge entre 20% et 80%

Les batteries lithium-ion vieillissent plus vite quand elles restent longtemps à 100% ou à 0%. Selon une étude de l'Université de technologie d'Eindhoven, maintenir la charge entre 20% et 80% peut prolonger la durée de vie de la batterie de 50%.

Conseil pratique : rechargez quand vous atteignez 20-30%, et débranchez à 80-90% pour un usage quotidien. Chargez à 100% uniquement avant les longues sorties.

2️⃣ Évitez les températures extrêmes

Les batteries lithium-ion fonctionnent de manière optimale entre 10°C et 25°C. Selon Bosch eBike Systems :
• Au-dessous de 0°C : l'autonomie peut baisser de 30%
• Au-dessus de 40°C : le vieillissement chimique s'accélère
• Stockage idéal : entre 10°C et 20°C

En hiver : rentrez la batterie à l'intérieur la nuit. En été : ne laissez pas le vélo en plein soleil.

3️⃣ Utilisez uniquement le chargeur d'origine

Les chargeurs non certifiés peuvent délivrer une tension incorrecte, endommager les cellules et même présenter un risque d'incendie. Le chargeur d'origine est calibré pour votre batterie spécifique.

4️⃣ Ne stockez pas la batterie déchargée

Si vous n'utilisez pas votre vélo pendant une période prolongée (hiver, vacances), stockez la batterie à environ 50-60% de charge. Les batteries lithium-ion perdent naturellement 2-3% par mois. Une batterie vide pendant plusieurs mois peut subir des dommages irréversibles.

5️⃣ Rechargez après chaque sortie (sans attendre)

Contrairement aux anciennes batteries NiCd, les batteries lithium-ion n'ont pas d'effet mémoire. Vous pouvez les recharger à tout moment sans les endommager. L'idéal est de recharger peu après la sortie, quand la batterie est encore à température ambiante.

6️⃣ Nettoyez les contacts régulièrement

La poussière, l'humidité et la corrosion sur les connecteurs peuvent réduire la conductivité et causer des problèmes de charge. Nettoyez les contacts de la batterie avec un chiffon sec tous les mois, et appliquez un spray de contact électrique tous les 3 mois.

7️⃣ Évitez les chocs et les vibrations

Les cellules lithium-ion sont sensibles aux chocs mécaniques. Manipulez la batterie avec précaution lors du retrait et de la remise en place. En terrain accidenté, les suspensions de votre fatbike protègent naturellement la batterie.

8️⃣ Mettez à jour le firmware

Les systèmes modernes (Bosch, Shimano, Bafang) proposent des mises à jour du firmware qui optimisent la gestion de la batterie. Vérifiez régulièrement si des mises à jour sont disponibles.

9️⃣ Surveillez l'état de santé

La plupart des systèmes modernes affichent un indicateur de santé de la batterie (Battery Health ou SOH). Si la capacité descend en dessous de 70%, envisagez un remplacement pour maintenir les performances et l'autonomie.

🔟 Recyclez en fin de vie

Lorsque votre batterie arrive en fin de vie (après 500-1000 cycles), ne la jetez pas à la poubelle. Déposez-la dans un point de collecte agréé (magasin de vélos, déchetterie). En France, la filière Corepile assure le recyclage gratuit.

📊 Tableau récapitulatif

• Charge optimale : 20-80%
• Température de stockage : 10-20°C
• Charge de stockage long : 50-60%
• Durée de vie moyenne : 500-1000 cycles (5-10 ans)
• Perte naturelle : 2-3% par mois au repos

Sources : Bosch eBike Systems, Université de technologie d'Eindhoven, ADEME, Battery University.`,
      en: `The lithium-ion battery represents about 30-40% of an electric bike's cost. Proper maintenance can double its lifespan. Here are 10 tips based on manufacturer recommendations and scientific studies.

1️⃣ Keep charge between 20% and 80%

According to a study by Eindhoven University of Technology, maintaining charge between 20-80% can extend battery life by 50%.

2️⃣ Avoid extreme temperatures

Optimal range: 10-25°C. Below 0°C, range drops by 30%. Above 40°C, chemical aging accelerates.

3️⃣ Use only the original charger

4️⃣ Don't store the battery empty — keep at 50-60% for long storage

5️⃣ Recharge after each ride — lithium-ion has no memory effect

6️⃣ Clean contacts monthly

7️⃣ Avoid shocks and vibrations

8️⃣ Update firmware regularly

9️⃣ Monitor battery health (SOH)

🔟 Recycle properly at end of life

Sources: Bosch eBike Systems, Eindhoven University of Technology, ADEME, Battery University.`,
      es: `La batería de litio representa el 30-40% del coste. 10 consejos: mantener la carga entre 20-80%, evitar temperaturas extremas, usar solo el cargador original, almacenar al 50-60% para largos periodos, y reciclar correctamente al final de su vida útil.`,
      nl: `De lithium-ion accu vertegenwoordigt 30-40% van de kosten. 10 tips: laad tussen 20-80%, vermijd extreme temperaturen, gebruik alleen de originele lader, bewaar op 50-60% voor langdurige opslag, en recycle correct.`,
      de: `Der Lithium-Ionen-Akku macht 30-40% der Kosten aus. 10 Tipps: Laden zwischen 20-80%, extreme Temperaturen vermeiden, nur das Original-Ladegerät verwenden, bei 50-60% für Langzeitlagerung aufbewahren, und am Ende fachgerecht recyceln.`,
      ar: `تمثل البطارية 30-40% من تكلفة الدراجة الكهربائية. 10 نصائح: حافظ على الشحن بين 20-80%، تجنب درجات الحرارة القصوى، استخدم الشاحن الأصلي فقط، خزّن عند 50-60% للفترات الطويلة، وأعد التدوير بشكل صحيح.`,
    },
    author: 'Vitesse Eco',
  },

  // ━━━━━━ ARTICLE 5 ━━━━━━
  {
    title: {
      fr: 'Fatbike électrique : pourquoi les gros pneus changent tout',
      en: 'Electric Fatbike: Why Fat Tyres Change Everything',
      es: 'Fatbike eléctrica: por qué los neumáticos anchos lo cambian todo',
      nl: 'Elektrische fatbike: waarom dikke banden alles veranderen',
      de: 'Elektrisches Fatbike: Warum dicke Reifen alles verändern',
      ar: 'فات بايك كهربائي: لماذا الإطارات العريضة تغير كل شيء',
    },
    slug: 'fatbike-electrique-gros-pneus-avantages',
    excerpt: {
      fr: 'Les fatbikes électriques séduisent de plus en plus de cyclistes. Découvrez les avantages uniques de ces vélos aux pneus surdimensionnés et comment choisir le vôtre.',
      en: 'Electric fatbikes are attracting more and more cyclists. Discover the unique advantages of these oversized-tyre bikes.',
      es: 'Las fatbikes eléctricas atraen a cada vez más ciclistas. Descubre las ventajas únicas de estas bicicletas de neumáticos anchos.',
      nl: 'Elektrische fatbikes trekken steeds meer fietsers aan. Ontdek de unieke voordelen van deze brede-banden fietsen.',
      de: 'Elektrische Fatbikes begeistern immer mehr Radfahrer. Entdecken Sie die einzigartigen Vorteile dieser Breitreifen-Räder.',
      ar: 'الفات بايك الكهربائية تجذب المزيد من راكبي الدراجات. اكتشف المزايا الفريدة لهذه الدراجات ذات الإطارات العريضة.',
    },
    content: {
      fr: `Le fatbike électrique est passé de niche à tendance majeure. Avec des pneus de 4 à 5 pouces de large (contre 1,5 à 2 pouces pour un vélo classique), ces vélos offrent une expérience unique. Mais au-delà de l'esthétique, quels sont les vrais avantages ?

🛞 Qu'est-ce qu'un fatbike exactement ?

Un fatbike (ou fat bike) est un vélo équipé de pneus surdimensionnés, généralement entre 3.8" et 5" de large, montés sur des jantes larges. Inventé dans les années 1980 en Alaska pour rouler sur la neige, il s'est progressivement démocratisé grâce à l'assistance électrique qui compense le poids supplémentaire.

📏 Les pneus en chiffres

• Largeur d'un pneu de vélo de route : 23-28 mm
• Largeur d'un pneu VTT : 50-65 mm
• Largeur d'un pneu fatbike : 96-127 mm (3.8"-5")
• Surface de contact au sol : 3 à 4 fois supérieure à un VTT classique

🌟 Les 5 avantages clés du fatbike électrique

1. Adhérence exceptionnelle sur tous les terrains

La surface de contact élargie offre une traction incomparable. Sable, neige, boue, gravier, herbe mouillée — le fatbike passe partout où un vélo classique patine. La pression réduite des pneus (0.5-1.0 bar, contre 3-4 bar pour un VTT) permet au pneu de "flotter" sur les surfaces meubles.

2. Confort de roulage supérieur

Les pneus larges à basse pression fonctionnent comme des amortisseurs naturels. Ils absorbent les vibrations des routes abîmées, des pavés et des chemins. Selon des tests réalisés par Bicycling Magazine, le fatbike réduit les vibrations transmises au guidon de 40% par rapport à un VTT avec suspension.

3. Stabilité accrue

Le centre de gravité bas combiné à l'empattement large offre une stabilité remarquable, même à basse vitesse. C'est particulièrement appréciable pour les débutants, les personnes âgées ou les cyclistes transportant des charges.

4. Polyvalence 4 saisons

Le fatbike est le seul vélo qui se pratique confortablement toute l'année :
• Printemps : chemins boueux, forêts
• Été : plage, sentiers, routes
• Automne : feuilles mortes, surfaces glissantes
• Hiver : neige, verglas (avec pneus cloutés en option)

5. L'assistance électrique compense le poids

Le principal inconvénient historique du fatbike — son poids (20-30 kg) — est neutralisé par le moteur électrique 250W. L'assistance permet de maintenir une vitesse de croisière confortable même face au vent ou en montée, sans effort excessif.

🔍 Comment choisir son fatbike électrique ?

Les critères essentiels :

Taille des pneus : 20" (compact, urbain) vs 24" (grand, tout-terrain) vs 26" (trail/aventure)
Batterie : 36V minimum pour les petits trajets, 48V recommandé pour l'autonomie
Freins : hydrauliques obligatoires pour le poids et la sécurité
Suspension : avant recommandée pour le confort, pas indispensable grâce aux pneus
Poids : 20-30 kg est normal pour un fatbike électrique

📊 Pour qui est le fatbike électrique ?

• Navetteurs urbains cherchant confort et style
• Aventuriers souhaitant explorer hors des sentiers battus
• Personnes en reprise d'activité physique (assistance + stabilité)
• Cyclistes vivant dans des régions à météo variable
• Livreurs cherchant un vélo stable et polyvalent

✅ Conclusion

Le fatbike électrique combine le meilleur de deux mondes : la polyvalence des gros pneus et la facilité de l'assistance électrique. Ce n'est plus un vélo de niche — c'est un véritable véhicule tout-terrain urbain, confortable, stable et amusant à conduire.`,
      en: `The electric fatbike has gone from niche to major trend. With tyres 4 to 5 inches wide (versus 1.5-2 inches for a regular bike), these bikes offer a unique experience.

🛞 What Exactly is a Fatbike?

A fatbike is a bicycle with oversized tyres, typically 3.8" to 5" wide. Invented in Alaska in the 1980s for riding on snow, it has been democratised by electric assistance.

🌟 5 Key Advantages

1. Exceptional grip on all terrains — sand, snow, mud, gravel
2. Superior riding comfort — tyres act as natural shock absorbers, reducing handlebar vibrations by 40%
3. Increased stability — low centre of gravity, perfect for beginners
4. 4-season versatility — the only bike comfortable year-round
5. Electric assistance compensates for weight

🔍 How to Choose?

Key criteria: tyre size (20"/24"/26"), battery (48V recommended), hydraulic brakes (essential), and weight (20-30 kg is normal).

The electric fatbike combines the best of both worlds: fat tyre versatility and electric ease.`,
      es: `El fatbike eléctrico ha pasado de nicho a tendencia. Con neumáticos de 4 a 5 pulgadas de ancho, ofrece adherencia excepcional en todo terreno, comodidad superior, estabilidad aumentada y versatilidad en las 4 estaciones. La asistencia eléctrica compensa el peso extra.`,
      nl: `De elektrische fatbike is van niche naar trend gegaan. Met banden van 4 tot 5 inch breed biedt hij uitzonderlijke grip op elk terrein, superieur rijcomfort, verhoogde stabiliteit en veelzijdigheid in alle seizoenen. De elektrische ondersteuning compenseert het extra gewicht.`,
      de: `Das elektrische Fatbike hat sich vom Nischenprodukt zum Trend entwickelt. Mit 4-5 Zoll breiten Reifen bietet es außergewöhnliche Traktion auf jedem Untergrund, überlegenen Fahrkomfort, erhöhte Stabilität und Ganzjahres-Vielseitigkeit. Der Elektroantrieb kompensiert das Mehrgewicht.`,
      ar: `انتقل الفات بايك الكهربائي من فئة متخصصة إلى اتجاه رئيسي. مع إطارات بعرض 4-5 إنش، يوفر التصاقاً استثنائياً على جميع التضاريس، راحة قيادة فائقة، استقراراً متزايداً، وتنوعاً في الفصول الأربعة. المساعدة الكهربائية تعوض الوزن الزائد.`,
    },
    author: 'Vitesse Eco',
  },

  // ━━━━━━ ARTICLE 6 ━━━━━━
  {
    title: {
      fr: 'Mobilité durable en France : comment les villes se transforment grâce au vélo',
      en: 'Sustainable Mobility in France: How Cities Are Transforming Thanks to Cycling',
      es: 'Movilidad sostenible en Francia: cómo las ciudades se transforman gracias a la bicicleta',
      nl: 'Duurzame mobiliteit in Frankrijk: hoe steden veranderen dankzij de fiets',
      de: 'Nachhaltige Mobilität in Frankreich: Wie Städte sich dank des Fahrrads wandeln',
      ar: 'التنقل المستدام في فرنسا: كيف تتحول المدن بفضل الدراجة',
    },
    slug: 'mobilite-durable-france-villes-velo',
    excerpt: {
      fr: 'De Paris à Poitiers, les villes françaises investissent massivement dans les infrastructures cyclables. Tour d\'horizon des transformations en cours.',
      en: 'From Paris to Poitiers, French cities are investing heavily in cycling infrastructure. An overview of ongoing transformations.',
      es: 'De París a Poitiers, las ciudades francesas invierten masivamente en infraestructuras ciclistas.',
      nl: 'Van Parijs tot Poitiers, Franse steden investeren fors in fietsinfrastructuur.',
      de: 'Von Paris bis Poitiers investieren französische Städte massiv in Fahrradinfrastruktur.',
      ar: 'من باريس إلى بواتييه، المدن الفرنسية تستثمر بكثافة في البنية التحتية للدراجات.',
    },
    content: {
      fr: `La France vit une révolution silencieuse. Poussées par l'urgence climatique et la demande citoyenne, les villes françaises transforment leur espace urbain pour faire place au vélo. Voici l'état des lieux en 2026.

🚴 Le Plan Vélo national

Lancé en 2018 et renforcé en 2023, le Plan Vélo & Marche du gouvernement français prévoit :
• 2 milliards d'euros d'investissement dans les infrastructures cyclables (2023-2027)
• Objectif : 9% de part modale vélo en 2024 (contre 3% en 2019)
• Création de 100 000 places de stationnement vélo sécurisées
• Généralisation de l'apprentissage du vélo à l'école (programme "Savoir rouler à vélo")

Source : Ministère de la Transition écologique

📊 Les chiffres qui impressionnent

Selon les compteurs vélo de Vélo & Territoires :
• +31% de fréquentation cyclable en France entre 2019 et 2025
• Paris : +78% de circulation vélo depuis 2019
• Lyon : +65% de cyclistes quotidiens
• Bordeaux : +52% d'utilisation des pistes cyclables
• Strasbourg : reste la capitale du vélo avec 16% de part modale

🏙️ Paris : la transformation radicale

La capitale est méconnaissable pour les cyclistes :
• 1 400 km de pistes cyclables (contre 700 km en 2019)
• La Rue de Rivoli, entièrement piétonne et cyclable
• Le Plan "Paris 100% cyclable" vise 180 km de pistes protégées supplémentaires
• Suppression de 60 000 places de stationnement voiture au profit de pistes cyclables et espaces verts

📍 Poitiers et la Nouvelle-Aquitaine

Plus proche de chez nous, Poitiers investit dans la mobilité douce :
• Extension du réseau cyclable de 40 km entre 2023 et 2026
• Création de parkings vélo sécurisés près de la gare et du centre-ville
• La région Nouvelle-Aquitaine propose une aide de 100€ pour l'achat d'un vélo électrique
• Le développement de la "Vélo-Francette" (600 km de voie verte de la Normandie à La Rochelle) traverse la Vienne

🌍 La France dans le contexte européen

La France rattrape son retard mais reste derrière les pays pionniers :
• Pays-Bas : 27% de part modale vélo
• Danemark : 16%
• Allemagne : 12%
• France : 5% (en hausse rapide)
• Objectif France 2030 : 12%

La particularité française est l'essor du vélo électrique : 52% des vélos neufs vendus en France en 2025 étaient électriques, le taux le plus élevé d'Europe (source : Union Sport & Cycle).

🔑 Les facteurs de succès

Les villes qui réussissent leur transition cyclable ont en commun :
1. Des pistes séparées physiquement du trafic automobile
2. Un réseau continu (pas de "trous" dans les itinéraires)
3. Du stationnement sécurisé à destination
4. Des services complémentaires (réparation, location, formation)
5. Une limitation de la vitesse automobile (30 km/h en ville)

💡 Ce que vous pouvez faire

• Participez aux enquêtes de mobilité de votre ville
• Utilisez des applications comme Géovélo pour signaler les problèmes d'infrastructure
• Rejoignez une association locale de cyclistes (FUB — Fédération française des Usagers de la Bicyclette)
• Testez le vélo électrique pour vos trajets quotidiens — l'essayer, c'est l'adopter

✅ Conclusion

La transformation de la mobilité urbaine en France n'est plus une promesse — c'est une réalité en cours. Les investissements dans les infrastructures cyclables, combinés à l'essor du vélo électrique, créent un cercle vertueux : plus d'infrastructures → plus de cyclistes → plus de demande → plus d'investissements.

Sources : Ministère de la Transition écologique, Vélo & Territoires, Ville de Paris, Union Sport & Cycle, FUB.`,
      en: `France is experiencing a quiet revolution. Pushed by climate urgency and citizen demand, French cities are transforming their urban space to make room for cycling.

🚴 The National Cycling Plan

France's cycling plan includes €2 billion investment (2023-2027), targeting 9% modal share for cycling. Paris has seen a 78% increase in cycling since 2019, with 1,400 km of bike lanes.

📊 Key Statistics

• +31% cycling frequency in France (2019-2025)
• Paris: +78%, Lyon: +65%, Bordeaux: +52%
• 52% of new bikes sold in France in 2025 were electric — highest in Europe

🌍 France in European Context

The Netherlands leads at 27% modal share, Denmark 16%, Germany 12%, France 5% (rising fast). France's target for 2030: 12%.

Sources: French Ministry of Ecological Transition, Vélo & Territoires, City of Paris, Union Sport & Cycle.`,
      es: `Francia vive una revolución silenciosa. El Plan Bici nacional prevé 2 mil millones de euros en infraestructura ciclista. París ha visto un aumento del 78% en ciclismo desde 2019. El 52% de las bicicletas vendidas en Francia en 2025 eran eléctricas.`,
      nl: `Frankrijk beleeft een stille revolutie. Het nationale fietsplan voorziet 2 miljard euro aan fietsinfrastructuur. Parijs zag een toename van 78% in fietsgebruik sinds 2019. 52% van de verkochte fietsen in Frankrijk in 2025 was elektrisch.`,
      de: `Frankreich erlebt eine stille Revolution. Der nationale Fahrradplan sieht 2 Milliarden Euro für Radinfrastruktur vor. Paris verzeichnete seit 2019 einen Anstieg des Radverkehrs um 78%. 52% der 2025 in Frankreich verkauften Fahrräder waren elektrisch.`,
      ar: `تشهد فرنسا ثورة هادئة. تتضمن الخطة الوطنية للدراجات استثمار 2 مليار يورو في البنية التحتية. شهدت باريس زيادة بنسبة 78% في ركوب الدراجات منذ 2019. 52% من الدراجات المباعة في فرنسا عام 2025 كانت كهربائية.`,
    },
    author: 'Vitesse Eco',
  },
]

async function main() {
  console.log('🚀 Creating 6 blog articles in Sanity...\n')

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    console.log(`📝 Article ${i + 1}/6: ${a.title.fr.slice(0, 60)}...`)

    // Upload featured image
    const image = await uploadImage(imageUrls[i], `blog-article-${i + 1}.jpg`)

    const doc = {
      _type: 'article',
      title: a.title,
      slug: { _type: 'slug', current: a.slug },
      excerpt: a.excerpt,
      content: a.content,
      author: a.author,
      publishedAt: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString(), // stagger dates
      isPublished: true,
      seo: {
        _type: 'seoFields',
        title: a.title.fr.slice(0, 60),
        description: a.excerpt.fr.slice(0, 160),
      },
    }

    if (image) {
      doc.featuredImage = image
    }

    await client.create(doc)
    console.log(`  ✅ Created: ${a.slug}\n`)
  }

  console.log('🎉 All 6 articles created successfully!')
}

main().catch(console.error)
