/**
 * U-S3 — First content batch: e-bike buying guide, 6 locales, with
 * related-product internal links (U-P9 renders them as product blocks).
 *
 * Idempotent: fixed _id, createOrReplace — safe to rerun after edits.
 * Featured image: uploads public/poster.webp as a placeholder the owner
 * can swap in Studio.
 *
 * Run from cms/:
 *   npx sanity exec scripts/add-buying-guide-article.mjs --with-user-token
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getCliClient } from 'sanity/cli'

const client = getCliClient({ apiVersion: '2024-01-01' })

const title = {
  fr: 'Guide d’achat 2026 : bien choisir son fatbike électrique',
  en: '2026 buying guide: how to choose your electric fatbike',
  es: 'Guía de compra 2026: cómo elegir tu fatbike eléctrica',
  nl: 'Koopgids 2026: zo kies je de juiste elektrische fatbike',
  de: 'Kaufratgeber 2026: das richtige E-Fatbike finden',
  ar: 'دليل الشراء 2026: كيف تختار دراجتك الكهربائية المناسبة',
}

const excerpt = {
  fr: 'Moteur, batterie, autonomie, taille, budget : tout ce qu’il faut vérifier avant d’acheter un vélo électrique, expliqué simplement.',
  en: 'Motor, battery, range, size, budget: everything to check before buying an e-bike, explained simply.',
  es: 'Motor, batería, autonomía, talla, presupuesto: todo lo que debes comprobar antes de comprar una bici eléctrica, explicado de forma sencilla.',
  nl: 'Motor, accu, actieradius, maat, budget: alles wat je moet controleren vóór je een e-bike koopt, simpel uitgelegd.',
  de: 'Motor, Akku, Reichweite, Rahmengröße, Budget: alles, was Sie vor dem E-Bike-Kauf prüfen sollten — einfach erklärt.',
  ar: 'المحرك، البطارية، المدى، المقاس، الميزانية: كل ما يجب التحقق منه قبل شراء دراجة كهربائية، بشرح مبسّط.',
}

const content = {
  fr: `Un fatbike électrique se choisit en cinq questions. Voici la méthode que nous utilisons en boutique à Poitiers — la même que notre sélecteur interactif sur vitesse-eco.fr/guide.

1. QUEL USAGE ?

Trajets quotidiens (travail, courses) : privilégiez le confort — position droite, porte-bagages, garde-boue. Balades et chemins : pneus larges 20 à 26 pouces et fourche suspendue. Usage mixte ville/campagne : un fatbike 20 pouces pliant est le plus polyvalent.

2. LE MOTEUR : LA RÈGLE EUROPÉENNE

En Europe, un vélo à assistance électrique est limité à 250 W nominal et 25 km/h. Au-delà, il est immatriculable comme cyclomoteur (assurance, casque moto, interdiction des pistes cyclables). Tous nos vélos respectent la norme EN 15194. Le couple (Nm) compte plus que les watts : 45 Nm suffisent en ville, visez 65 Nm et plus pour les côtes ou les charges lourdes.

3. LA BATTERIE : LES WATTHEURES, PAS LES AMPÈRES

La vraie mesure d’autonomie, c’est le wattheure (Wh) = tension (V) × capacité (Ah). Une 48 V 15 Ah = 720 Wh. Comptez en conditions réelles 8 à 12 Wh par kilomètre selon le poids, le vent et le mode d’assistance : une 720 Wh couvre donc 60 à 90 km réels. Méfiez-vous des autonomies annoncées « jusqu’à » : elles supposent le mode éco, un cycliste léger et zéro vent.

4. LA TAILLE ET LE CONFORT

Vérifiez la hauteur de selle mini/maxi par rapport à votre entrejambe et le poids total du vélo si vous devez le monter dans un ascenseur ou un coffre (un fatbike pliant pèse 25 à 35 kg). Freins hydrauliques recommandés dès que vous dépassez 23 kg de vélo ou roulez sous la pluie.

5. LE BUDGET RÉALISTE

Moins de 1 000 € : premier prix correct pour des trajets courts. 1 000 à 1 800 € : le cœur du marché — batterie de marque, freins hydrauliques, garantie sérieuse. Plus de 1 800 € : gros couple, double batterie ou équipement complet. N’oubliez pas l’antivol en U (60 à 100 €) et l’assurance vol si vous stationnez dehors.

NOTRE CHECKLIST AVANT ACHAT

— Norme EN 15194 et limitation 25 km/h
— Wattheures réels de la batterie (pas seulement les Ah)
— Couple moteur adapté à votre relief
— Freins hydrauliques si usage quotidien
— Garantie 2 ans et disponibilité des pièces (batterie, chargeur, écran)
— Test du service client AVANT l’achat : posez une question, chronométrez la réponse

Besoin d’aide pour trancher ? Utilisez notre sélecteur en 3 questions sur vitesse-eco.fr/guide, comparez les modèles sur vitesse-eco.fr/comparatif, ou écrivez-nous sur WhatsApp — réponse 7j/7. Livraison gratuite en France, garantie 2 ans, retour 14 jours.`,

  en: `Choosing an electric fatbike comes down to five questions. This is the method we use in our Poitiers shop — the same logic as our interactive selector at vitesse-eco.fr/guide.

1. WHAT WILL YOU USE IT FOR?

Daily commuting (work, groceries): prioritise comfort — upright position, rack, mudguards. Trails and leisure rides: wide tyres (20 to 26 inches) and a suspension fork. Mixed city/country use: a 20-inch folding fatbike is the most versatile choice.

2. THE MOTOR: THE EUROPEAN RULE

In Europe, a pedal-assist bike is limited to 250 W nominal and 25 km/h. Anything above that legally becomes a moped (insurance, motorcycle helmet, no cycle paths). All our bikes comply with EN 15194. Torque (Nm) matters more than watts: 45 Nm is fine in town; aim for 65 Nm or more for hills or heavy loads.

3. THE BATTERY: WATT-HOURS, NOT AMPS

The real measure of range is watt-hours (Wh) = voltage (V) × capacity (Ah). A 48 V 15 Ah battery = 720 Wh. In real conditions expect 8 to 12 Wh per kilometre depending on weight, wind and assist mode — so 720 Wh covers a genuine 60 to 90 km. Be wary of “up to” range claims: they assume eco mode, a light rider and zero wind.

4. SIZE AND COMFORT

Check the minimum/maximum saddle height against your inseam, and the total weight if you need to carry the bike into a lift or car boot (a folding fatbike weighs 25 to 35 kg). Hydraulic brakes are recommended above 23 kg of bike or if you ride in the rain.

5. A REALISTIC BUDGET

Under €1,000: decent entry level for short trips. €1,000–1,800: the sweet spot — branded battery, hydraulic brakes, solid warranty. Over €1,800: high torque, dual battery or full equipment. Budget for a U-lock (€60–100) and theft insurance if you park outside.

OUR PRE-PURCHASE CHECKLIST

— EN 15194 compliance and 25 km/h limit
— Real battery watt-hours (not just Ah)
— Motor torque matched to your terrain
— Hydraulic brakes for daily use
— 2-year warranty and spare-parts availability (battery, charger, display)
— Test customer service BEFORE buying: ask a question, time the answer

Need help deciding? Use our 3-question selector at vitesse-eco.fr/guide, compare models at vitesse-eco.fr/comparatif, or message us on WhatsApp — we answer 7 days a week. Free delivery in France, 2-year warranty, 14-day returns.`,

  es: `Elegir una fatbike eléctrica se reduce a cinco preguntas. Este es el método que usamos en nuestra tienda de Poitiers — la misma lógica que nuestro selector interactivo en vitesse-eco.fr/guide.

1. ¿PARA QUÉ LA VAS A USAR?

Trayectos diarios (trabajo, compras): prioriza la comodidad — postura erguida, portaequipajes, guardabarros. Caminos y paseos: neumáticos anchos (20 a 26 pulgadas) y horquilla con suspensión. Uso mixto ciudad/campo: una fatbike plegable de 20 pulgadas es la opción más versátil.

2. EL MOTOR: LA NORMA EUROPEA

En Europa, una bicicleta de pedaleo asistido está limitada a 250 W nominales y 25 km/h. Por encima de eso se considera legalmente un ciclomotor (seguro, casco de moto, prohibición de carriles bici). Todas nuestras bicis cumplen la norma EN 15194. El par motor (Nm) importa más que los vatios: 45 Nm bastan en ciudad; busca 65 Nm o más para cuestas o cargas pesadas.

3. LA BATERÍA: VATIOS-HORA, NO AMPERIOS

La medida real de autonomía son los vatios-hora (Wh) = tensión (V) × capacidad (Ah). Una batería de 48 V y 15 Ah = 720 Wh. En condiciones reales calcula de 8 a 12 Wh por kilómetro según peso, viento y modo de asistencia: 720 Wh cubren de 60 a 90 km reales. Desconfía de las autonomías «hasta»: suponen modo eco, ciclista ligero y cero viento.

4. TALLA Y COMODIDAD

Comprueba la altura mínima/máxima del sillín respecto a tu entrepierna y el peso total si tienes que subirla a un ascensor o al maletero (una fatbike plegable pesa de 25 a 35 kg). Frenos hidráulicos recomendados a partir de 23 kg de bici o si circulas con lluvia.

5. UN PRESUPUESTO REALISTA

Menos de 1.000 €: gama de entrada correcta para trayectos cortos. De 1.000 a 1.800 €: el corazón del mercado — batería de marca, frenos hidráulicos, garantía seria. Más de 1.800 €: mucho par, doble batería o equipamiento completo. No olvides el candado en U (60–100 €) y el seguro antirrobo si aparcas en la calle.

NUESTRA LISTA DE COMPROBACIÓN

— Norma EN 15194 y límite de 25 km/h
— Vatios-hora reales de la batería (no solo los Ah)
— Par motor adecuado a tu terreno
— Frenos hidráulicos para uso diario
— Garantía de 2 años y disponibilidad de repuestos (batería, cargador, pantalla)
— Prueba el servicio al cliente ANTES de comprar: haz una pregunta y cronometra la respuesta

¿Necesitas ayuda para decidir? Usa nuestro selector de 3 preguntas en vitesse-eco.fr/guide, compara modelos en vitesse-eco.fr/comparatif o escríbenos por WhatsApp — respondemos los 7 días de la semana. Envío gratuito a Francia, garantía de 2 años, devolución en 14 días.`,

  nl: `De juiste elektrische fatbike kiezen draait om vijf vragen. Dit is de methode die we in onze winkel in Poitiers gebruiken — dezelfde logica als onze interactieve keuzehulp op vitesse-eco.fr/guide.

1. WAARVOOR GA JE HEM GEBRUIKEN?

Dagelijks woon-werkverkeer en boodschappen: kies voor comfort — rechtop zitten, bagagedrager, spatborden. Paden en tochten: brede banden (20 tot 26 inch) en een geveerde voorvork. Gemengd gebruik stad/buiten: een opvouwbare 20-inch fatbike is het meest veelzijdig.

2. DE MOTOR: DE EUROPESE REGEL

In Europa is een e-bike met trapondersteuning beperkt tot 250 W nominaal en 25 km/u. Daarboven geldt hij wettelijk als bromfiets (verzekering, helm, verbod op fietspaden). Al onze fietsen voldoen aan EN 15194. Koppel (Nm) zegt meer dan watts: 45 Nm volstaat in de stad; mik op 65 Nm of meer voor hellingen of zware lasten.

3. DE ACCU: WATTUREN, GEEN AMPÈRES

De echte maat voor actieradius is wattuur (Wh) = spanning (V) × capaciteit (Ah). Een 48 V 15 Ah accu = 720 Wh. Reken in de praktijk op 8 tot 12 Wh per kilometer, afhankelijk van gewicht, wind en ondersteuningsstand: 720 Wh is dus goed voor 60 tot 90 echte kilometers. Wees kritisch op “tot”-claims: die gaan uit van eco-stand, een lichte fietser en windstilte.

4. MAAT EN COMFORT

Controleer de minimale/maximale zadelhoogte ten opzichte van je binnenbeenlengte en het totale gewicht als je de fiets een lift of kofferbak in moet tillen (een vouwbare fatbike weegt 25 tot 35 kg). Hydraulische remmen zijn aan te raden boven 23 kg of als je in de regen rijdt.

5. EEN REALISTISCH BUDGET

Onder € 1.000: nette instapper voor korte ritten. € 1.000–1.800: het hart van de markt — merk-accu, hydraulische remmen, degelijke garantie. Boven € 1.800: veel koppel, dubbele accu of complete uitrusting. Vergeet het U-slot niet (€ 60–100) en een diefstalverzekering als je buiten parkeert.

ONZE CHECKLIST VÓÓR AANKOOP

— EN 15194-norm en 25 km/u-begrenzing
— Echte wattuten van de accu (niet alleen Ah)
— Motorkoppel passend bij jouw omgeving
— Hydraulische remmen bij dagelijks gebruik
— 2 jaar garantie en beschikbaarheid van onderdelen (accu, lader, display)
— Test de klantenservice VÓÓR je koopt: stel een vraag en klok het antwoord

Hulp nodig bij het kiezen? Gebruik onze keuzehulp met 3 vragen op vitesse-eco.fr/guide, vergelijk modellen op vitesse-eco.fr/comparatif of stuur ons een WhatsApp-bericht — we antwoorden 7 dagen per week. Gratis levering in Frankrijk, 2 jaar garantie, 14 dagen retourrecht.`,

  de: `Die Wahl des richtigen E-Fatbikes lässt sich auf fünf Fragen reduzieren. Nach dieser Methode beraten wir in unserem Geschäft in Poitiers — dieselbe Logik wie unser interaktiver Berater auf vitesse-eco.fr/guide.

1. WOFÜR WOLLEN SIE ES NUTZEN?

Täglicher Arbeitsweg und Einkäufe: Komfort zuerst — aufrechte Sitzposition, Gepäckträger, Schutzbleche. Wege und Touren: breite Reifen (20 bis 26 Zoll) und Federgabel. Gemischte Nutzung Stadt/Land: ein faltbares 20-Zoll-Fatbike ist am vielseitigsten.

2. DER MOTOR: DIE EUROPÄISCHE REGEL

In Europa ist ein Pedelec auf 250 W Nenndauerleistung und 25 km/h begrenzt. Darüber gilt es rechtlich als Kleinkraftrad (Versicherungskennzeichen, Helmpflicht, Radwegverbot). Alle unsere Räder entsprechen der Norm EN 15194. Das Drehmoment (Nm) ist wichtiger als die Wattzahl: 45 Nm reichen in der Stadt; für Steigungen oder schwere Lasten sollten es 65 Nm oder mehr sein.

3. DER AKKU: WATTSTUNDEN STATT AMPERE

Das echte Maß für Reichweite sind Wattstunden (Wh) = Spannung (V) × Kapazität (Ah). Ein 48-V-15-Ah-Akku = 720 Wh. Rechnen Sie unter realen Bedingungen mit 8 bis 12 Wh pro Kilometer, je nach Gewicht, Wind und Unterstützungsstufe: 720 Wh reichen also für ehrliche 60 bis 90 km. Vorsicht bei „bis zu“-Angaben: Sie setzen Eco-Modus, leichten Fahrer und Windstille voraus.

4. GRÖSSE UND KOMFORT

Prüfen Sie die minimale/maximale Sattelhöhe im Verhältnis zu Ihrer Schrittlänge sowie das Gesamtgewicht, falls Sie das Rad in Aufzug oder Kofferraum heben müssen (ein faltbares Fatbike wiegt 25 bis 35 kg). Hydraulische Bremsen sind ab 23 kg Radgewicht oder bei Regenfahrten empfehlenswert.

5. EIN REALISTISCHES BUDGET

Unter 1.000 €: solider Einstieg für kurze Strecken. 1.000 bis 1.800 €: das Herz des Marktes — Marken-Akku, hydraulische Bremsen, seriöse Garantie. Über 1.800 €: hohes Drehmoment, Doppelakku oder Vollausstattung. Planen Sie ein Bügelschloss (60–100 €) und eine Diebstahlversicherung ein, wenn Sie draußen parken.

UNSERE CHECKLISTE VOR DEM KAUF

— Norm EN 15194 und 25-km/h-Begrenzung
— Echte Wattstunden des Akkus (nicht nur Ah)
— Drehmoment passend zu Ihrem Gelände
— Hydraulische Bremsen bei täglicher Nutzung
— 2 Jahre Garantie und Ersatzteilverfügbarkeit (Akku, Ladegerät, Display)
— Testen Sie den Kundenservice VOR dem Kauf: Stellen Sie eine Frage und stoppen Sie die Antwortzeit

Unsicher? Nutzen Sie unseren 3-Fragen-Berater auf vitesse-eco.fr/guide, vergleichen Sie Modelle auf vitesse-eco.fr/comparatif oder schreiben Sie uns per WhatsApp — wir antworten an 7 Tagen die Woche. Kostenlose Lieferung nach Frankreich, 2 Jahre Garantie, 14 Tage Widerrufsrecht.`,

  ar: `اختيار الدراجة الكهربائية الصحيحة يتلخص في خمسة أسئلة. هذه هي الطريقة التي نستخدمها في متجرنا في بواتييه — وهي نفس منطق المرشد التفاعلي على vitesse-eco.fr/guide.

1. ما هو استخدامك؟

التنقل اليومي (عمل، تسوق): الأولوية للراحة — جلسة مستقيمة، حامل أمتعة، رفارف. الطرق والنزهات: إطارات عريضة (20 إلى 26 إنش) وشوكة أمامية بنوابض. استخدام مختلط مدينة/ريف: الدراجة القابلة للطي مقاس 20 إنش هي الأكثر تنوعاً.

2. المحرك: القاعدة الأوروبية

في أوروبا، الدراجة الكهربائية بمساعدة الدواسة محدودة بقدرة 250 واط اسمية وسرعة 25 كم/س. أي تجاوز يجعلها قانونياً دراجة نارية (تأمين، خوذة، منع من مسارات الدراجات). جميع دراجاتنا مطابقة لمعيار EN 15194. عزم الدوران (نيوتن.متر) أهم من الواط: 45 ن.م تكفي في المدينة؛ استهدف 65 ن.م أو أكثر للمرتفعات أو الأحمال الثقيلة.

3. البطارية: واط-ساعة وليس أمبير

المقياس الحقيقي للمدى هو الواط-ساعة (Wh) = الجهد (V) × السعة (Ah). بطارية 48 فولت 15 أمبير = 720 واط-ساعة. في الظروف الواقعية احسب 8 إلى 12 واط-ساعة لكل كيلومتر حسب الوزن والرياح ومستوى المساعدة: أي أن 720 واط-ساعة تغطي 60 إلى 90 كم فعلياً. احذر من عبارات «حتى X كم»: فهي تفترض الوضع الاقتصادي وسائقاً خفيفاً وبلا رياح.

4. المقاس والراحة

تحقق من ارتفاع السرج الأدنى/الأقصى مقارنة بطول ساقك الداخلي، ومن الوزن الإجمالي إذا كنت ستحمل الدراجة في مصعد أو صندوق سيارة (الدراجة القابلة للطي تزن 25 إلى 35 كغ). ننصح بالمكابح الهيدروليكية إذا تجاوز وزن الدراجة 23 كغ أو كنت تقود تحت المطر.

5. الميزانية الواقعية

أقل من 1000 يورو: مستوى دخول مقبول للمسافات القصيرة. من 1000 إلى 1800 يورو: قلب السوق — بطارية من علامة معروفة، مكابح هيدروليكية، ضمان جدي. أكثر من 1800 يورو: عزم عالٍ، بطارية مزدوجة أو تجهيزات كاملة. لا تنسَ القفل الحديدي (60–100 يورو) وتأمين السرقة إذا كنت تركن في الخارج.

قائمة التحقق قبل الشراء

— معيار EN 15194 وحد السرعة 25 كم/س
— الواط-ساعة الحقيقية للبطارية (وليس الأمبير فقط)
— عزم محرك مناسب لتضاريس منطقتك
— مكابح هيدروليكية للاستخدام اليومي
— ضمان سنتين وتوفر قطع الغيار (بطارية، شاحن، شاشة)
— اختبر خدمة العملاء قبل الشراء: اطرح سؤالاً واحسب زمن الرد

تحتاج مساعدة في القرار؟ استخدم مرشدنا ذا الأسئلة الثلاثة على vitesse-eco.fr/guide، وقارن الموديلات على vitesse-eco.fr/comparatif، أو راسلنا على واتساب — نرد طوال أيام الأسبوع. توصيل مجاني في فرنسا، ضمان سنتان، إرجاع خلال 14 يوماً.`,
}

// seoFields is a plain (non-localized) object in this schema — FR is the
// primary market, so SEO title/description are French.
const seo = {
  title: 'Guide d’achat vélo électrique 2026 | Vitesse Eco',
  description: excerpt.fr.slice(0, 160),
}

// ── main ──────────────────────────────────────────────────────────────
const imagePath = fileURLToPath(new URL('../../public/poster.webp', import.meta.url))
console.log('Uploading featured image (public/poster.webp)…')
const asset = await client.assets.upload('image', readFileSync(imagePath), {
  filename: 'guide-achat-2026.webp',
})

// Internal links: the 4 best-stocked available bikes become related-product
// blocks on the article page (U-P9 renderer).
const bikes = await client.fetch(
  `*[_type == "product" && productType == "bike" && isAvailable == true && stock > 0] | order(stock desc)[0...4]{ _id, "name": name.fr }`
)
console.log('Related products:', bikes.map((b) => b.name).join(' · ') || '(none found)')

const doc = {
  _id: 'article-buying-guide-2026',
  _type: 'article',
  title: { _type: 'localizedString', ...title },
  slug: { _type: 'slug', current: 'guide-achat-velo-electrique-2026' },
  excerpt: { _type: 'localizedString', ...excerpt },
  content: { _type: 'localizedText', ...content },
  featuredImage: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } },
  author: 'Vitesse Eco',
  publishedAt: new Date().toISOString(),
  relatedProducts: bikes.map((b, i) => ({ _type: 'reference', _ref: b._id, _key: `rel-${i}` })),
  isPublished: true,
  seo: { _type: 'seoFields', title: seo.title, description: seo.description },
}

await client.createOrReplace(doc)
console.log('\n✅ Article published: /blog/guide-achat-velo-electrique-2026 (6 locales, 4 related products)')
