/**
 * Create 30+ FAQ entries in Sanity CMS (5+ per category)
 * Categories: general, technical, shipping, payment, maintenance
 */
import { createClient } from '@sanity/client'

const client = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_TOKEN,
})

const faqs = [
  // ━━━━━━ GENERAL (6) ━━━━━━
  {
    category: 'general',
    sortOrder: 1,
    question: {
      fr: 'Qu\'est-ce qu\'un fatbike électrique ?',
      en: 'What is an electric fatbike?',
      es: '¿Qué es una fatbike eléctrica?',
      nl: 'Wat is een elektrische fatbike?',
      de: 'Was ist ein elektrisches Fatbike?',
      ar: 'ما هو الفات بايك الكهربائي؟',
    },
    answer: {
      fr: 'Un fatbike électrique est un vélo équipé de pneus surdimensionnés (3.8" à 5" de large) et d\'un moteur électrique de 250W qui assiste le pédalage jusqu\'à 25 km/h. Les gros pneus offrent une adhérence exceptionnelle sur tous les terrains (sable, neige, gravier, routes mouillées) et un confort de roulage supérieur. Chez Vitesse Eco, tous nos modèles sont des VAE homologués conformes à la réglementation européenne.',
      en: 'An electric fatbike is a bicycle fitted with oversized tyres (3.8" to 5" wide) and a 250W electric motor that assists pedalling up to 25 km/h. The fat tyres provide exceptional grip on all terrains (sand, snow, gravel, wet roads) and superior riding comfort. At Vitesse Eco, all our models are approved e-bikes compliant with European regulations.',
      es: 'Una fatbike eléctrica es una bicicleta con neumáticos anchos (3.8" a 5") y un motor eléctrico de 250W que asiste el pedaleo hasta 25 km/h.',
      nl: 'Een elektrische fatbike is een fiets met extra brede banden (3.8" tot 5") en een 250W elektrische motor die trapondersteuning biedt tot 25 km/u.',
      de: 'Ein elektrisches Fatbike ist ein Fahrrad mit überbreiten Reifen (3,8" bis 5") und einem 250W-Elektromotor, der das Treten bis 25 km/h unterstützt.',
      ar: 'الفات بايك الكهربائي هو دراجة مزودة بإطارات عريضة (3.8 إلى 5 بوصات) ومحرك كهربائي 250 واط يساعد على التبديل حتى 25 كم/ساعة.',
    },
  },
  {
    category: 'general',
    sortOrder: 2,
    question: {
      fr: 'Faut-il un permis pour conduire un fatbike électrique ?',
      en: 'Do I need a licence to ride an electric fatbike?',
      es: '¿Necesito permiso para conducir una fatbike eléctrica?',
      nl: 'Heb ik een rijbewijs nodig voor een elektrische fatbike?',
      de: 'Brauche ich einen Führerschein für ein elektrisches Fatbike?',
      ar: 'هل أحتاج رخصة لقيادة فات بايك كهربائي؟',
    },
    answer: {
      fr: 'Non, aucun permis n\'est nécessaire. Nos fatbikes sont des Vélos à Assistance Électrique (VAE) avec un moteur de 250W limité à 25 km/h. Selon la loi française (Article R311-1 du Code de la route), ils sont classés comme des vélos ordinaires. Pas de permis, pas d\'immatriculation, pas d\'assurance obligatoire. Vous pouvez rouler partout où un vélo est autorisé.',
      en: 'No, no licence is required. Our fatbikes are Pedal-Assist Electric Bikes (VAE) with a 250W motor limited to 25 km/h. Under French law, they are classified as ordinary bicycles. No licence, no registration, no mandatory insurance.',
      es: 'No, no se necesita permiso. Nuestras fatbikes son VAE con motor de 250W limitado a 25 km/h, clasificadas como bicicletas ordinarias.',
      nl: 'Nee, geen rijbewijs nodig. Onze fatbikes zijn VAE\'s met een 250W motor beperkt tot 25 km/u, geclassificeerd als gewone fietsen.',
      de: 'Nein, kein Führerschein erforderlich. Unsere Fatbikes sind VAEs mit 250W-Motor, begrenzt auf 25 km/h, und gelten als normale Fahrräder.',
      ar: 'لا، لا حاجة لرخصة. دراجاتنا هي دراجات مساعدة كهربائية بمحرك 250 واط محدود بـ 25 كم/ساعة، مصنفة كدراجات عادية.',
    },
  },
  {
    category: 'general',
    sortOrder: 3,
    question: {
      fr: 'Où se trouve votre magasin ?',
      en: 'Where is your store located?',
      es: '¿Dónde se encuentra su tienda?',
      nl: 'Waar is uw winkel?',
      de: 'Wo befindet sich Ihr Geschäft?',
      ar: 'أين يقع متجركم؟',
    },
    answer: {
      fr: 'Notre magasin se situe au 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France. Vous pouvez nous rendre visite pour essayer nos modèles, récupérer vos commandes ou bénéficier de notre service après-vente. N\'hésitez pas à nous contacter avant votre visite pour vous assurer de la disponibilité du modèle souhaité.',
      en: 'Our store is at 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France. You can visit to test our models, pick up your orders or use our after-sales service.',
      es: 'Nuestra tienda está en 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Francia.',
      nl: 'Onze winkel bevindt zich op 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankrijk.',
      de: 'Unser Geschäft befindet sich in der 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich.',
      ar: 'يقع متجرنا في 32 شارع فوبورغ دو بون نوف، 86000 بواتييه، فرنسا.',
    },
  },
  {
    category: 'general',
    sortOrder: 4,
    question: {
      fr: 'Puis-je essayer un vélo avant d\'acheter ?',
      en: 'Can I test a bike before buying?',
      es: '¿Puedo probar una bicicleta antes de comprar?',
      nl: 'Kan ik een fiets testen voor aankoop?',
      de: 'Kann ich ein Fahrrad vor dem Kauf testen?',
      ar: 'هل يمكنني تجربة الدراجة قبل الشراء؟',
    },
    answer: {
      fr: 'Oui, absolument ! Nous encourageons nos clients à essayer les vélos avant l\'achat. Rendez-vous dans notre magasin à Poitiers pour tester les modèles qui vous intéressent. Nous vous conseillerons sur le modèle le plus adapté à votre utilisation, votre taille et vos besoins. Contactez-nous pour prendre rendez-vous.',
      en: 'Yes, absolutely! We encourage customers to test bikes before purchasing. Visit our store in Poitiers to try the models that interest you. Contact us to schedule an appointment.',
      es: 'Sí, por supuesto. Visite nuestra tienda en Poitiers para probar los modelos. Contáctenos para programar una cita.',
      nl: 'Ja, natuurlijk! Bezoek onze winkel in Poitiers om modellen te testen. Neem contact op voor een afspraak.',
      de: 'Ja, natürlich! Besuchen Sie unser Geschäft in Poitiers zum Testen. Kontaktieren Sie uns für einen Termin.',
      ar: 'نعم بالتأكيد! زوروا متجرنا في بواتييه لتجربة الموديلات. تواصلوا معنا لحجز موعد.',
    },
  },
  {
    category: 'general',
    sortOrder: 5,
    question: {
      fr: 'Vos vélos sont-ils adaptés aux personnes de grande taille ?',
      en: 'Are your bikes suitable for tall people?',
      es: '¿Sus bicicletas son adecuadas para personas altas?',
      nl: 'Zijn uw fietsen geschikt voor lange mensen?',
      de: 'Sind Ihre Fahrräder für große Personen geeignet?',
      ar: 'هل دراجاتكم مناسبة للأشخاص طوال القامة؟',
    },
    answer: {
      fr: 'Oui, nous proposons des modèles pour toutes les tailles. Notre V20Max avec ses roues de 24" est spécialement conçu pour les cyclistes de 175 cm et plus. Pour les adolescents ou les personnes de petite taille, le V20Mini avec ses roues de 16" est parfait. N\'hésitez pas à nous contacter pour des conseils personnalisés sur la taille.',
      en: 'Yes, we offer models for all heights. Our V20Max with 24" wheels is designed for riders 175cm and taller. The V20Mini with 16" wheels is perfect for teenagers or shorter riders.',
      es: 'Sí, ofrecemos modelos para todas las tallas. El V20Max con ruedas de 24" está diseñado para ciclistas de 175 cm o más.',
      nl: 'Ja, wij bieden modellen voor alle lengtes. De V20Max met 24" wielen is ontworpen voor rijders van 175 cm en langer.',
      de: 'Ja, wir bieten Modelle für alle Größen. Das V20Max mit 24"-Rädern ist für Fahrer ab 175 cm konzipiert.',
      ar: 'نعم، نوفر نماذج لجميع الأطوال. V20Max بعجلات 24 بوصة مصمم للراكبين بطول 175 سم وأكثر.',
    },
  },

  // ━━━━━━ TECHNICAL (5) ━━━━━━
  {
    category: 'technical',
    sortOrder: 10,
    question: {
      fr: 'Quelle est l\'autonomie de vos vélos électriques ?',
      en: 'What is the range of your electric bikes?',
      es: '¿Cuál es la autonomía de sus bicicletas eléctricas?',
      nl: 'Wat is het bereik van uw elektrische fietsen?',
      de: 'Wie groß ist die Reichweite Ihrer E-Bikes?',
      ar: 'ما هو مدى دراجاتكم الكهربائية؟',
    },
    answer: {
      fr: 'L\'autonomie varie selon le modèle et les conditions d\'utilisation. Voici les autonomies indicatives :\n\n• V20Mini : 30-40 km (batterie 36V 13AH)\n• V20Pro / Q30 / C28 : 40-50 km (batterie 48V 15.6AH)\n• V20Limited / S20Pro / D50 : 50-60 km (batterie 48V 18.2AH)\n• V20Cross : 60-70 km (batterie 48V 22AH)\n• EB30 : 90-100 km (double batterie 15.6AH)\n• V20Limited Pro : jusqu\'à 100 km (double batterie)\n\nCes chiffres dépendent du poids du cycliste, du terrain, du vent et du niveau d\'assistance utilisé.',
      en: 'Range varies by model:\n• V20Mini: 30-40 km\n• V20Pro/Q30/C28: 40-50 km\n• V20Limited/S20Pro/D50: 50-60 km\n• V20Cross: 60-70 km\n• EB30: 90-100 km (dual battery)\n• V20Limited Pro: up to 100 km (dual battery)\n\nActual range depends on rider weight, terrain, wind and assistance level.',
      es: 'La autonomía varía según el modelo: desde 30-40 km (V20Mini) hasta 100 km (V20Limited Pro con doble batería).',
      nl: 'Het bereik varieert per model: van 30-40 km (V20Mini) tot 100 km (V20Limited Pro met dubbele accu).',
      de: 'Die Reichweite variiert je nach Modell: von 30-40 km (V20Mini) bis 100 km (V20Limited Pro mit Doppelakku).',
      ar: 'يختلف المدى حسب النموذج: من 30-40 كم (V20Mini) إلى 100 كم (V20Limited Pro ببطارية مزدوجة).',
    },
  },
  {
    category: 'technical',
    sortOrder: 11,
    question: {
      fr: 'Quelle est la vitesse maximale ?',
      en: 'What is the maximum speed?',
      es: '¿Cuál es la velocidad máxima?',
      nl: 'Wat is de maximale snelheid?',
      de: 'Was ist die Höchstgeschwindigkeit?',
      ar: 'ما هي السرعة القصوى؟',
    },
    answer: {
      fr: 'Conformément à la réglementation européenne pour les VAE, l\'assistance électrique se coupe à 25 km/h. Au-delà, vous pouvez continuer à pédaler sans assistance. Tous nos modèles sont équipés d\'un moteur 250W homologué, ce qui signifie qu\'ils sont classés comme des vélos ordinaires (pas de permis ni d\'immatriculation nécessaires).',
      en: 'In compliance with European regulations for e-bikes, electric assistance cuts off at 25 km/h. Beyond that, you can continue pedalling without assistance. All our models have an approved 250W motor.',
      es: 'Según la regulación europea, la asistencia eléctrica se corta a 25 km/h. Todos nuestros modelos tienen motor homologado de 250W.',
      nl: 'Volgens de Europese regelgeving stopt de elektrische ondersteuning bij 25 km/u. Alle modellen hebben een goedgekeurde 250W motor.',
      de: 'Gemäß der europäischen Vorschriften endet die elektrische Unterstützung bei 25 km/h. Alle Modelle haben einen zugelassenen 250W-Motor.',
      ar: 'وفقاً للوائح الأوروبية، تتوقف المساعدة الكهربائية عند 25 كم/ساعة. جميع موديلاتنا مزودة بمحرك 250 واط معتمد.',
    },
  },
  {
    category: 'technical',
    sortOrder: 12,
    question: {
      fr: 'Combien de temps faut-il pour charger la batterie ?',
      en: 'How long does it take to charge the battery?',
      es: '¿Cuánto tiempo tarda en cargarse la batería?',
      nl: 'Hoe lang duurt het om de accu op te laden?',
      de: 'Wie lange dauert das Aufladen des Akkus?',
      ar: 'كم من الوقت يستغرق شحن البطارية؟',
    },
    answer: {
      fr: 'Le temps de charge varie de 4 à 6 heures pour une charge complète, selon le modèle et la capacité de la batterie. Vous pouvez charger la batterie sur une prise domestique standard. La batterie peut être chargée directement sur le vélo ou retirée pour être chargée à l\'intérieur. Nous recommandons de ne pas décharger complètement la batterie et de maintenir la charge entre 20% et 80% pour prolonger sa durée de vie.',
      en: 'Charging time varies from 4 to 6 hours for a full charge. You can charge on a standard domestic outlet. The battery can be charged on the bike or removed for indoor charging. We recommend keeping charge between 20-80% for longer battery life.',
      es: 'El tiempo de carga varía de 4 a 6 horas para una carga completa. Se puede cargar en un enchufe doméstico estándar.',
      nl: 'De oplaadtijd varieert van 4 tot 6 uur voor een volledige lading. U kunt opladen via een standaard stopcontact.',
      de: 'Die Ladezeit beträgt 4 bis 6 Stunden für eine vollständige Ladung. Sie können an einer normalen Steckdose laden.',
      ar: 'يتراوح وقت الشحن من 4 إلى 6 ساعات للشحن الكامل. يمكنك الشحن من مقبس منزلي عادي.',
    },
  },
  {
    category: 'technical',
    sortOrder: 13,
    question: {
      fr: 'Quel type de freins équipe vos vélos ?',
      en: 'What type of brakes do your bikes have?',
      es: '¿Qué tipo de frenos tienen sus bicicletas?',
      nl: 'Wat voor type remmen hebben uw fietsen?',
      de: 'Welche Bremsen haben Ihre Fahrräder?',
      ar: 'ما نوع المكابح في دراجاتكم؟',
    },
    answer: {
      fr: 'Tous nos modèles sont équipés de freins à disque hydrauliques avant et arrière. C\'est le système de freinage le plus performant pour les vélos électriques : puissance de freinage constante par tous les temps (pluie, boue), dosage précis, et durée de vie supérieure aux freins mécaniques. Les freins hydrauliques sont particulièrement importants sur les fatbikes en raison de leur poids et de leur vitesse.',
      en: 'All our models feature front and rear hydraulic disc brakes — the most effective braking system for electric bikes: consistent stopping power in all weather, precise modulation, and longer lifespan than mechanical brakes.',
      es: 'Todos nuestros modelos tienen frenos de disco hidráulicos delanteros y traseros, el sistema de frenado más eficiente para bicicletas eléctricas.',
      nl: 'Alle modellen hebben hydraulische schijfremmen voor en achter — het meest effectieve remsysteem voor e-bikes.',
      de: 'Alle Modelle haben hydraulische Scheibenbremsen vorne und hinten — das effektivste Bremssystem für E-Bikes.',
      ar: 'جميع موديلاتنا مزودة بمكابح قرصية هيدروليكية أمامية وخلفية — أقوى نظام كبح للدراجات الكهربائية.',
    },
  },
  {
    category: 'technical',
    sortOrder: 14,
    question: {
      fr: 'Le vélo est-il livré monté ou en kit ?',
      en: 'Is the bike delivered assembled or as a kit?',
      es: '¿La bicicleta se entrega montada o en kit?',
      nl: 'Wordt de fiets gemonteerd of als bouwpakket geleverd?',
      de: 'Wird das Fahrrad montiert oder als Bausatz geliefert?',
      ar: 'هل تُسلم الدراجة مجمعة أم كطقم؟',
    },
    answer: {
      fr: 'Nos vélos sont livrés pré-assemblés à 90%. Il vous reste à fixer le guidon, la selle, les pédales et la roue avant — environ 20-30 minutes avec les outils fournis. Un guide de montage illustré et une vidéo sont inclus. Si vous récupérez en magasin à Poitiers, nous assemblons le vélo complètement et effectuons les réglages pour vous.',
      en: 'Our bikes come 90% pre-assembled. You just need to attach the handlebars, seat, pedals and front wheel — about 20-30 minutes with included tools. If you pick up in-store, we fully assemble and adjust the bike for you.',
      es: 'Nuestras bicicletas vienen 90% pre-ensambladas. Solo queda fijar el manillar, el sillín, los pedales y la rueda delantera (20-30 minutos).',
      nl: 'Onze fietsen worden 90% voorgemonteerd geleverd. U hoeft alleen het stuur, zadel, pedalen en voorwiel te bevestigen (20-30 minuten).',
      de: 'Unsere Fahrräder werden zu 90% vormontiert geliefert. Sie müssen nur Lenker, Sattel, Pedale und Vorderrad anbringen (20-30 Minuten).',
      ar: 'تُسلم دراجاتنا مجمعة بنسبة 90%. يبقى فقط تركيب المقود والمقعد والدواسات والعجلة الأمامية (20-30 دقيقة).',
    },
  },

  // ━━━━━━ SHIPPING (5) ━━━━━━
  {
    category: 'shipping',
    sortOrder: 20,
    question: {
      fr: 'Quels sont les délais de livraison ?',
      en: 'What are the delivery times?',
      es: '¿Cuáles son los plazos de entrega?',
      nl: 'Wat zijn de levertijden?',
      de: 'Wie sind die Lieferzeiten?',
      ar: 'ما هي مواعيد التسليم؟',
    },
    answer: {
      fr: 'Les délais de livraison dépendent de la méthode choisie :\n\n• Retrait en magasin (Poitiers) : sous 24-48h\n• Livraison standard en France métropolitaine : 5-7 jours ouvrés\n• Livraison express : 2-3 jours ouvrés\n• Belgique, Luxembourg : 7-10 jours ouvrés\n• Allemagne, Pays-Bas, Espagne : 7-14 jours ouvrés\n\nVous recevrez un email avec un numéro de suivi dès l\'expédition de votre commande.',
      en: 'Delivery times depend on the method chosen:\n• Store pickup (Poitiers): within 24-48h\n• Standard delivery in France: 5-7 business days\n• Express: 2-3 business days\n• Belgium, Luxembourg: 7-10 business days\n• Germany, Netherlands, Spain: 7-14 business days',
      es: 'Los plazos dependen del método: recogida en tienda 24-48h, entrega estándar en Francia 5-7 días, express 2-3 días.',
      nl: 'Levertijden hangen af van de methode: afhalen in winkel 24-48u, standaard in Frankrijk 5-7 werkdagen, express 2-3 werkdagen.',
      de: 'Die Lieferzeiten hängen von der Methode ab: Abholung 24-48h, Standard in Frankreich 5-7 Werktage, Express 2-3 Werktage.',
      ar: 'تعتمد مواعيد التسليم على الطريقة: استلام من المتجر 24-48 ساعة، توصيل عادي في فرنسا 5-7 أيام عمل.',
    },
  },
  {
    category: 'shipping',
    sortOrder: 21,
    question: {
      fr: 'Livrez-vous en dehors de la France ?',
      en: 'Do you deliver outside France?',
      es: '¿Entregan fuera de Francia?',
      nl: 'Levert u buiten Frankrijk?',
      de: 'Liefern Sie außerhalb Frankreichs?',
      ar: 'هل تقومون بالتوصيل خارج فرنسا؟',
    },
    answer: {
      fr: 'Oui, nous livrons dans plusieurs pays européens : France métropolitaine, Belgique, Luxembourg, Allemagne, Pays-Bas et Espagne. Les frais de livraison varient selon le pays et le poids du colis. Consultez notre page de commande pour voir les tarifs exacts pour votre destination.',
      en: 'Yes, we deliver to several European countries: mainland France, Belgium, Luxembourg, Germany, Netherlands and Spain. Shipping costs vary by country.',
      es: 'Sí, entregamos en varios países europeos: Francia, Bélgica, Luxemburgo, Alemania, Países Bajos y España.',
      nl: 'Ja, wij leveren in verschillende Europese landen: Frankrijk, België, Luxemburg, Duitsland, Nederland en Spanje.',
      de: 'Ja, wir liefern in mehrere europäische Länder: Frankreich, Belgien, Luxemburg, Deutschland, Niederlande und Spanien.',
      ar: 'نعم، نقوم بالتوصيل إلى عدة دول أوروبية: فرنسا، بلجيكا، لوكسمبورغ، ألمانيا، هولندا وإسبانيا.',
    },
  },
  {
    category: 'shipping',
    sortOrder: 22,
    question: {
      fr: 'La livraison est-elle gratuite ?',
      en: 'Is delivery free?',
      es: '¿El envío es gratuito?',
      nl: 'Is de bezorging gratis?',
      de: 'Ist die Lieferung kostenlos?',
      ar: 'هل التوصيل مجاني؟',
    },
    answer: {
      fr: 'Le retrait en magasin à Poitiers est toujours gratuit. Pour la livraison à domicile, nous proposons la livraison gratuite en France métropolitaine à partir d\'un certain montant de commande. Les frais exacts sont affichés lors de la commande et dépendent de votre adresse et de la méthode de livraison choisie.',
      en: 'Store pickup in Poitiers is always free. For home delivery, we offer free shipping in mainland France above a certain order amount. Exact costs are shown during checkout.',
      es: 'La recogida en tienda es siempre gratuita. Para la entrega a domicilio, ofrecemos envío gratis en Francia a partir de cierto monto.',
      nl: 'Afhalen in de winkel is altijd gratis. Voor thuisbezorging bieden we gratis verzending in Frankrijk boven een bepaald bedrag.',
      de: 'Die Abholung im Geschäft ist immer kostenlos. Für die Hauslieferung bieten wir kostenlosen Versand in Frankreich ab einem bestimmten Bestellwert.',
      ar: 'الاستلام من المتجر مجاني دائماً. للتوصيل المنزلي، نقدم شحناً مجانياً في فرنسا فوق مبلغ معين.',
    },
  },
  {
    category: 'shipping',
    sortOrder: 23,
    question: {
      fr: 'Comment suivre ma commande ?',
      en: 'How can I track my order?',
      es: '¿Cómo puedo seguir mi pedido?',
      nl: 'Hoe kan ik mijn bestelling volgen?',
      de: 'Wie kann ich meine Bestellung verfolgen?',
      ar: 'كيف يمكنني تتبع طلبي؟',
    },
    answer: {
      fr: 'Dès l\'expédition de votre commande, vous recevrez un email avec un numéro de suivi. Vous pouvez également suivre l\'état de votre commande depuis votre espace client sur notre site, dans la rubrique "Mes commandes". Si vous n\'avez pas reçu d\'email de suivi sous 48h après votre commande, contactez-nous à contact@vitesse-eco.fr.',
      en: 'Once your order is shipped, you will receive an email with a tracking number. You can also track your order from your account page under "My Orders".',
      es: 'Una vez enviado su pedido, recibirá un email con un número de seguimiento. También puede seguirlo desde su cuenta.',
      nl: 'Zodra uw bestelling is verzonden, ontvangt u een email met een trackingnummer. U kunt ook volgen via uw account.',
      de: 'Sobald Ihre Bestellung versandt ist, erhalten Sie eine E-Mail mit Sendungsverfolgungsnummer. Sie können auch über Ihr Konto verfolgen.',
      ar: 'بمجرد شحن طلبك، ستتلقى بريداً إلكترونياً برقم التتبع. يمكنك أيضاً متابعة طلبك من حسابك.',
    },
  },
  {
    category: 'shipping',
    sortOrder: 24,
    question: {
      fr: 'Que faire si mon vélo arrive endommagé ?',
      en: 'What if my bike arrives damaged?',
      es: '¿Qué hacer si mi bicicleta llega dañada?',
      nl: 'Wat als mijn fiets beschadigd aankomt?',
      de: 'Was tun, wenn mein Fahrrad beschädigt ankommt?',
      ar: 'ماذا أفعل إذا وصلت دراجتي تالفة؟',
    },
    answer: {
      fr: 'Tous nos vélos sont expédiés dans un emballage renforcé. Si malgré cela votre vélo arrive endommagé :\n\n1. Photographiez l\'emballage et les dommages avant d\'ouvrir le colis\n2. Signalez le problème au transporteur lors de la réception\n3. Contactez-nous dans les 48h à contact@vitesse-eco.fr avec les photos\n4. Nous organiserons un remplacement ou une réparation selon le cas\n\nVos droits sont protégés par la garantie légale de conformité (2 ans).',
      en: 'If your bike arrives damaged: 1) Photograph the packaging and damage, 2) Report to the carrier, 3) Contact us within 48h at contact@vitesse-eco.fr with photos, 4) We will arrange replacement or repair.',
      es: 'Si llega dañada: fotografíe el embalaje, repórtelo al transportista, contáctenos en 48h con fotos, organizaremos un reemplazo o reparación.',
      nl: 'Als uw fiets beschadigd aankomt: fotografeer de verpakking, meld bij de bezorger, neem binnen 48u contact op met foto\'s.',
      de: 'Falls beschädigt: Verpackung fotografieren, beim Lieferdienst melden, innerhalb 48h mit Fotos kontaktieren.',
      ar: 'إذا وصلت تالفة: صوّر العبوة والأضرار، أبلغ شركة النقل، تواصل معنا خلال 48 ساعة بالصور.',
    },
  },

  // ━━━━━━ PAYMENT (5) ━━━━━━
  {
    category: 'payment',
    sortOrder: 30,
    question: {
      fr: 'Quels modes de paiement acceptez-vous ?',
      en: 'What payment methods do you accept?',
      es: '¿Qué métodos de pago aceptan?',
      nl: 'Welke betaalmethoden accepteert u?',
      de: 'Welche Zahlungsmethoden akzeptieren Sie?',
      ar: 'ما هي طرق الدفع المقبولة؟',
    },
    answer: {
      fr: 'Actuellement, nous proposons le paiement en magasin lors du retrait de votre commande. Nous acceptons les espèces, la carte bancaire et le virement bancaire. Le paiement en ligne par carte bancaire (Visa, Mastercard) sera disponible prochainement via notre plateforme sécurisée.',
      en: 'Currently, we offer in-store payment when picking up your order. We accept cash, bank card and bank transfer. Online card payment (Visa, Mastercard) will be available soon.',
      es: 'Actualmente ofrecemos pago en tienda al recoger. Aceptamos efectivo, tarjeta y transferencia. El pago online estará disponible pronto.',
      nl: 'Momenteel bieden we betaling in de winkel bij afhalen. We accepteren contant, pinpas en bankoverschrijving. Online betaling komt binnenkort.',
      de: 'Derzeit bieten wir Zahlung im Geschäft bei Abholung. Wir akzeptieren Bargeld, Karte und Überweisung. Online-Zahlung kommt bald.',
      ar: 'حالياً نوفر الدفع في المتجر عند الاستلام. نقبل النقد والبطاقة والتحويل البنكي. الدفع عبر الإنترنت سيتوفر قريباً.',
    },
  },
  {
    category: 'payment',
    sortOrder: 31,
    question: {
      fr: 'Le paiement en ligne est-il sécurisé ?',
      en: 'Is online payment secure?',
      es: '¿El pago en línea es seguro?',
      nl: 'Is online betaling veilig?',
      de: 'Ist die Online-Zahlung sicher?',
      ar: 'هل الدفع عبر الإنترنت آمن؟',
    },
    answer: {
      fr: 'Oui, la sécurité est notre priorité. Notre site utilise un certificat SSL (HTTPS) pour chiffrer toutes les communications. Lorsque le paiement en ligne sera disponible, il sera traité via Stripe, une plateforme de paiement certifiée PCI DSS Niveau 1 (le plus haut niveau de certification de sécurité). Vos données bancaires ne transitent jamais par nos serveurs.',
      en: 'Yes, security is our priority. Our site uses SSL (HTTPS) encryption. When online payment becomes available, it will be processed via Stripe, a PCI DSS Level 1 certified platform. Your bank details never pass through our servers.',
      es: 'Sí, nuestro sitio usa cifrado SSL (HTTPS). El pago será procesado por Stripe, certificado PCI DSS Nivel 1.',
      nl: 'Ja, onze site gebruikt SSL (HTTPS) versleuteling. Betaling wordt verwerkt via Stripe, PCI DSS Level 1 gecertificeerd.',
      de: 'Ja, unsere Website verwendet SSL (HTTPS). Die Zahlung wird über Stripe abgewickelt, PCI DSS Level 1 zertifiziert.',
      ar: 'نعم، موقعنا يستخدم تشفير SSL (HTTPS). سيتم معالجة الدفع عبر Stripe المعتمدة بشهادة PCI DSS المستوى 1.',
    },
  },
  {
    category: 'payment',
    sortOrder: 32,
    question: {
      fr: 'Puis-je payer en plusieurs fois ?',
      en: 'Can I pay in instalments?',
      es: '¿Puedo pagar a plazos?',
      nl: 'Kan ik in termijnen betalen?',
      de: 'Kann ich in Raten zahlen?',
      ar: 'هل يمكنني الدفع بالتقسيط؟',
    },
    answer: {
      fr: 'Le paiement en plusieurs fois n\'est pas encore disponible sur notre site. Cependant, certaines cartes bancaires proposent des facilités de paiement en 3 ou 4 fois. Renseignez-vous auprès de votre banque. En magasin, nous pouvons discuter d\'arrangements de paiement personnalisés pour les commandes importantes.',
      en: 'Instalment payment is not yet available on our site. However, some bank cards offer 3 or 4-instalment options. Check with your bank. In-store, we can discuss custom payment arrangements for large orders.',
      es: 'El pago a plazos aún no está disponible en nuestro sitio. Consulte con su banco sobre opciones de fraccionamiento.',
      nl: 'Betaling in termijnen is nog niet beschikbaar. Informeer bij uw bank naar splitsingsopties.',
      de: 'Ratenzahlung ist noch nicht verfügbar. Erkundigen Sie sich bei Ihrer Bank nach Teilzahlungsoptionen.',
      ar: 'الدفع بالتقسيط غير متوفر بعد على موقعنا. استفسر من بنكك عن خيارات التقسيط.',
    },
  },
  {
    category: 'payment',
    sortOrder: 33,
    question: {
      fr: 'Proposez-vous des codes de réduction ?',
      en: 'Do you offer discount codes?',
      es: '¿Ofrecen códigos de descuento?',
      nl: 'Biedt u kortingscodes aan?',
      de: 'Bieten Sie Rabattcodes an?',
      ar: 'هل تقدمون أكواد خصم؟',
    },
    answer: {
      fr: 'Oui, nous proposons régulièrement des codes de réduction pour nos clients. Vous pouvez saisir votre code promo dans le panier avant de passer à la caisse. Pour recevoir nos offres exclusives, suivez-nous sur les réseaux sociaux ou inscrivez-vous à notre newsletter. Des promotions spéciales sont également proposées lors d\'événements (soldes, Black Friday, etc.).',
      en: 'Yes, we regularly offer discount codes. Enter your promo code in the cart before checkout. Follow us on social media or subscribe to our newsletter for exclusive offers.',
      es: 'Sí, ofrecemos códigos de descuento regularmente. Ingrese su código en el carrito. Síganos en redes sociales para ofertas exclusivas.',
      nl: 'Ja, we bieden regelmatig kortingscodes aan. Voer uw code in het winkelmandje in. Volg ons op sociale media voor exclusieve aanbiedingen.',
      de: 'Ja, wir bieten regelmäßig Rabattcodes an. Geben Sie Ihren Code im Warenkorb ein. Folgen Sie uns für exklusive Angebote.',
      ar: 'نعم، نقدم أكواد خصم بانتظام. أدخل الكود في السلة قبل الدفع. تابعونا لعروض حصرية.',
    },
  },
  {
    category: 'payment',
    sortOrder: 34,
    question: {
      fr: 'Puis-je obtenir une facture ?',
      en: 'Can I get an invoice?',
      es: '¿Puedo obtener una factura?',
      nl: 'Kan ik een factuur krijgen?',
      de: 'Kann ich eine Rechnung bekommen?',
      ar: 'هل يمكنني الحصول على فاتورة؟',
    },
    answer: {
      fr: 'Oui, une facture est automatiquement générée pour chaque commande. Vous la recevrez par email. Elle est également téléchargeable depuis votre espace client dans la section "Mes commandes". Pour les entreprises, nous pouvons émettre des factures avec TVA détaillée. Contactez-nous à contact@vitesse-eco.fr pour toute demande spécifique.',
      en: 'Yes, an invoice is automatically generated for each order and sent by email. It\'s also downloadable from your account. For businesses, we can issue detailed VAT invoices.',
      es: 'Sí, se genera una factura automáticamente. La recibirá por email y puede descargarla desde su cuenta.',
      nl: 'Ja, een factuur wordt automatisch gegenereerd en per email verstuurd. Ook downloadbaar vanuit uw account.',
      de: 'Ja, eine Rechnung wird automatisch erstellt und per E-Mail versandt. Auch über Ihr Konto herunterladbar.',
      ar: 'نعم، يتم إنشاء فاتورة تلقائياً لكل طلب وإرسالها عبر البريد الإلكتروني. يمكن تحميلها أيضاً من حسابك.',
    },
  },

  // ━━━━━━ MAINTENANCE (5) ━━━━━━
  {
    category: 'maintenance',
    sortOrder: 40,
    question: {
      fr: 'Comment entretenir mon fatbike électrique au quotidien ?',
      en: 'How do I maintain my electric fatbike daily?',
      es: '¿Cómo mantengo mi fatbike eléctrica a diario?',
      nl: 'Hoe onderhoud ik mijn elektrische fatbike dagelijks?',
      de: 'Wie pflege ich mein elektrisches Fatbike täglich?',
      ar: 'كيف أعتني بفات بايكي الكهربائي يومياً؟',
    },
    answer: {
      fr: 'L\'entretien quotidien est simple :\n\n• Vérifiez la pression des pneus (recommandé : 0.8-1.2 bar pour la route, 0.5-0.8 bar pour le tout-terrain)\n• Vérifiez que les freins fonctionnent correctement\n• Gardez la chaîne lubrifiée (toutes les 200 km ou après une sortie sous la pluie)\n• Nettoyez le vélo avec un chiffon humide (évitez le jet haute pression sur les composants électriques)\n• Rechargez la batterie après chaque sortie (ne la laissez pas se vider complètement)\n• Rangez le vélo à l\'abri de la pluie et du gel',
      en: 'Daily maintenance is simple:\n• Check tyre pressure (0.8-1.2 bar for road, 0.5-0.8 bar for off-road)\n• Verify brakes work properly\n• Keep chain lubricated (every 200 km)\n• Clean with a damp cloth (avoid high-pressure water on electrical components)\n• Recharge after each ride\n• Store sheltered from rain and frost',
      es: 'Mantenimiento diario: verificar presión de neumáticos, comprobar frenos, lubricar cadena, limpiar con paño húmedo, recargar después de cada salida.',
      nl: 'Dagelijks onderhoud: bandenspanning controleren, remmen checken, ketting smeren, reinigen met vochtige doek, opladen na elke rit.',
      de: 'Tägliche Pflege: Reifendruck prüfen, Bremsen kontrollieren, Kette schmieren, mit feuchtem Tuch reinigen, nach jeder Fahrt laden.',
      ar: 'العناية اليومية: فحص ضغط الإطارات، التحقق من المكابح، تشحيم السلسلة، التنظيف بقطعة قماش رطبة، الشحن بعد كل رحلة.',
    },
  },
  {
    category: 'maintenance',
    sortOrder: 41,
    question: {
      fr: 'Quelle est la durée de vie de la batterie ?',
      en: 'What is the battery lifespan?',
      es: '¿Cuál es la vida útil de la batería?',
      nl: 'Wat is de levensduur van de accu?',
      de: 'Wie lang ist die Lebensdauer des Akkus?',
      ar: 'ما هو عمر البطارية؟',
    },
    answer: {
      fr: 'Nos batteries lithium-ion sont conçues pour durer entre 500 et 1 000 cycles de charge complète, ce qui équivaut à 5-10 ans d\'utilisation normale. Après cette période, la batterie conserve encore environ 70-80% de sa capacité initiale. Pour maximiser la durée de vie : maintenez la charge entre 20% et 80%, stockez à température ambiante (10-20°C), et utilisez uniquement le chargeur d\'origine.',
      en: 'Our lithium-ion batteries are designed for 500-1,000 full charge cycles, equivalent to 5-10 years of normal use. After this period, the battery retains about 70-80% of initial capacity.',
      es: 'Nuestras baterías están diseñadas para 500-1.000 ciclos de carga, equivalente a 5-10 años de uso normal.',
      nl: 'Onze accu\'s zijn ontworpen voor 500-1.000 laadcycli, equivalent aan 5-10 jaar normaal gebruik.',
      de: 'Unsere Akkus sind für 500-1.000 Ladezyklen ausgelegt, was 5-10 Jahren normalem Gebrauch entspricht.',
      ar: 'بطارياتنا مصممة لـ 500-1000 دورة شحن كاملة، أي ما يعادل 5-10 سنوات من الاستخدام العادي.',
    },
  },
  {
    category: 'maintenance',
    sortOrder: 42,
    question: {
      fr: 'Puis-je rouler sous la pluie ?',
      en: 'Can I ride in the rain?',
      es: '¿Puedo circular bajo la lluvia?',
      nl: 'Kan ik in de regen rijden?',
      de: 'Kann ich im Regen fahren?',
      ar: 'هل يمكنني القيادة تحت المطر؟',
    },
    answer: {
      fr: 'Oui, nos vélos sont conçus pour résister aux intempéries. Le moteur et le système électrique sont protégés contre les éclaboussures (norme IPX4). Cependant, nous recommandons :\n\n• D\'éviter de rouler dans l\'eau profonde (au-dessus des moyeux)\n• De sécher le vélo après une sortie sous la pluie\n• De ne jamais utiliser un jet haute pression pour nettoyer les composants électriques\n• De retirer la batterie pour la sécher séparément si elle a été très exposée\n\nLes freins à disque hydrauliques conservent leur efficacité même par temps de pluie.',
      en: 'Yes, our bikes are designed to withstand weather. The motor and electrical system are splash-resistant (IPX4). However, avoid deep water, dry the bike after rain, never use high-pressure water on electrical components.',
      es: 'Sí, nuestras bicicletas están diseñadas para resistir la lluvia (norma IPX4). Evite el agua profunda y seque después de la lluvia.',
      nl: 'Ja, onze fietsen zijn ontworpen om regen te weerstaan (IPX4). Vermijd diep water en droog na regen.',
      de: 'Ja, unsere Fahrräder sind wetterfest (IPX4). Vermeiden Sie tiefes Wasser und trocknen Sie nach Regen.',
      ar: 'نعم، دراجاتنا مصممة لتحمل الأمطار (معيار IPX4). تجنب المياه العميقة وجففها بعد المطر.',
    },
  },
  {
    category: 'maintenance',
    sortOrder: 43,
    question: {
      fr: 'Où faire réparer mon vélo ?',
      en: 'Where can I get my bike repaired?',
      es: '¿Dónde puedo reparar mi bicicleta?',
      nl: 'Waar kan ik mijn fiets laten repareren?',
      de: 'Wo kann ich mein Fahrrad reparieren lassen?',
      ar: 'أين يمكنني إصلاح دراجتي؟',
    },
    answer: {
      fr: 'Plusieurs options s\'offrent à vous :\n\n1. Notre magasin à Poitiers : service après-vente complet, pièces d\'origine\n2. Tout atelier vélo : les composants mécaniques (freins, pneus, chaîne) sont standards et réparables par tout vélociste\n3. Vous-même : les opérations de base (réglage freins, changement de chambre à air, lubrification) sont accessibles avec un outillage minimal\n\nPour les problèmes électriques (moteur, contrôleur, batterie), nous recommandons de nous contacter directement.',
      en: 'Several options: 1) Our store in Poitiers for full after-sales service, 2) Any bike shop for mechanical parts, 3) DIY for basic maintenance. For electrical issues, contact us directly.',
      es: 'Opciones: 1) Nuestra tienda en Poitiers, 2) Cualquier taller de bicicletas para partes mecánicas, 3) Usted mismo para mantenimiento básico.',
      nl: 'Opties: 1) Onze winkel in Poitiers, 2) Elke fietsenwinkel voor mechanische onderdelen, 3) Zelf voor basisonderhoud.',
      de: 'Optionen: 1) Unser Geschäft in Poitiers, 2) Jede Fahrradwerkstatt für mechanische Teile, 3) Selbst für Grundwartung.',
      ar: 'الخيارات: 1) متجرنا في بواتييه، 2) أي ورشة دراجات للأجزاء الميكانيكية، 3) بنفسك للصيانة الأساسية.',
    },
  },
  {
    category: 'maintenance',
    sortOrder: 44,
    question: {
      fr: 'Quelle est la garantie sur vos vélos ?',
      en: 'What warranty do you offer on your bikes?',
      es: '¿Qué garantía ofrecen en sus bicicletas?',
      nl: 'Welke garantie biedt u op uw fietsen?',
      de: 'Welche Garantie bieten Sie auf Ihre Fahrräder?',
      ar: 'ما هو الضمان على دراجاتكم؟',
    },
    answer: {
      fr: 'Tous nos vélos bénéficient de :\n\n• Garantie légale de conformité : 2 ans (couvrant tout défaut de fabrication)\n• Garantie constructeur sur le cadre : 5 ans\n• Garantie sur la batterie : 2 ans ou 500 cycles\n• Garantie sur le moteur : 2 ans\n\nLa garantie ne couvre pas l\'usure normale (plaquettes de frein, pneus, chaîne) ni les dommages causés par un mauvais usage. Conservez votre facture d\'achat comme preuve de garantie.',
      en: 'All our bikes include:\n• Legal conformity warranty: 2 years\n• Frame warranty: 5 years\n• Battery warranty: 2 years or 500 cycles\n• Motor warranty: 2 years\n\nNormal wear (brake pads, tyres, chain) is not covered.',
      es: 'Garantía legal: 2 años, cuadro: 5 años, batería: 2 años o 500 ciclos, motor: 2 años. El desgaste normal no está cubierto.',
      nl: 'Wettelijke garantie: 2 jaar, frame: 5 jaar, accu: 2 jaar of 500 cycli, motor: 2 jaar. Normale slijtage is niet gedekt.',
      de: 'Gesetzliche Garantie: 2 Jahre, Rahmen: 5 Jahre, Akku: 2 Jahre oder 500 Zyklen, Motor: 2 Jahre. Normaler Verschleiß ist nicht abgedeckt.',
      ar: 'ضمان قانوني: سنتان، الهيكل: 5 سنوات، البطارية: سنتان أو 500 دورة، المحرك: سنتان. الاستهلاك العادي غير مشمول.',
    },
  },
]

async function main() {
  console.log(`🚀 Creating ${faqs.length} FAQ entries in Sanity...\n`)

  for (let i = 0; i < faqs.length; i++) {
    const f = faqs[i]
    console.log(`❓ ${i + 1}/${faqs.length}: ${f.question.fr.slice(0, 50)}...`)

    await client.create({
      _type: 'faq',
      question: f.question,
      answer: f.answer,
      category: f.category,
      sortOrder: f.sortOrder,
      isPublished: true,
    })
  }

  console.log(`\n🎉 All ${faqs.length} FAQ entries created!`)
}

main().catch(console.error)
