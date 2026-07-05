<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('legal.batteries') }}</h1>
      <div class="card p-6 md:p-8 text-text-secondary leading-relaxed space-y-6">
        <div class="flex items-start gap-4 bg-accent/10 border border-accent/30 rounded-xl p-4">
          <Icon name="ph:battery-warning" class="w-8 h-8 text-accent shrink-0" />
          <p class="text-sm text-white">{{ banner }}</p>
        </div>
        <section v-for="(s, i) in sections" :key="i">
          <h2 class="text-white font-display text-lg font-semibold mb-2">{{ s.h }}</h2>
          <p class="whitespace-pre-line text-sm">{{ s.p }}</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * U-K2 — Battery take-back notice (German BattG obligation for e-bike
 * sellers; same duty exists EU-wide under directive 2006/66/EC).
 * German is the authoritative text for DE customers.
 */
const { t, locale } = useI18n()
useHead({
  title: `${t('legal.batteries')} — Vitesse Eco`,
  meta: [{ name: 'description', content: `${t('legal.batteries')} — Vitesse Eco` }],
})

const ADDR = 'VITESSE ECO SAS, 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France'

type Section = { h: string; p: string }
const allContent: Record<string, { banner: string; sections: Section[] }> = {
  de: {
    banner: 'Batterien und Akkus gehören nicht in den Hausmüll. Sie sind gesetzlich verpflichtet, Altbatterien zurückzugeben — die Rückgabe ist kostenlos.',
    sections: [
      { h: 'Hinweis nach Batteriegesetz (BattG)', p: 'Im Zusammenhang mit dem Vertrieb von Batterien und Akkus (auch in Fahrzeugen und Geräten eingebaut) sind wir als Händler verpflichtet, Sie auf Folgendes hinzuweisen: Sie sind als Endnutzer zur Rückgabe gebrauchter Batterien gesetzlich verpflichtet.' },
      { h: 'Kostenlose Rückgabe', p: `E-Bike-Akkus (Industriebatterien) können Sie nach Gebrauch unentgeltlich an uns zurückgeben:\n${ADDR}\nAlternativ können Sie Altbatterien bei kommunalen Sammelstellen oder im Handel vor Ort abgeben. Bitte kontaktieren Sie uns vor dem Versand eines Lithium-Akkus (contact@vitesse-eco.fr) — beschädigte Akkus dürfen nicht per Post versendet werden.` },
      { h: 'Bedeutung der Symbole', p: 'Das Symbol der durchgestrichenen Mülltonne bedeutet: Batterien und Akkus dürfen nicht in den Hausmüll. Zeichen unter dem Symbol: Pb = enthält Blei, Cd = enthält Cadmium, Hg = enthält Quecksilber.' },
      { h: 'Sicherheit bei Lithium-Akkus', p: 'Kleben Sie die Pole vor der Rückgabe ab, um Kurzschlüsse zu vermeiden. Lagern Sie beschädigte Akkus getrennt und trocken, und geben Sie sie nur persönlich bei einer Sammelstelle ab.' },
    ],
  },
  fr: {
    banner: 'Les batteries et accumulateurs ne doivent jamais être jetés avec les ordures ménagères. Leur reprise est gratuite.',
    sections: [
      { h: 'Obligation légale', p: "En tant que distributeur de batteries et d'accumulateurs (y compris intégrés dans les véhicules), nous vous informons que vous êtes tenu, en tant qu'utilisateur final, de rapporter les batteries usagées (directive 2006/66/CE, loi allemande BattG pour nos clients en Allemagne)." },
      { h: 'Reprise gratuite', p: `Vous pouvez nous retourner gratuitement les batteries de vélo électrique usagées :\n${ADDR}\nVous pouvez aussi les déposer dans un point de collecte municipal ou chez un distributeur local. Contactez-nous avant tout envoi d'une batterie lithium (contact@vitesse-eco.fr) — une batterie endommagée ne doit jamais être expédiée par la poste.` },
      { h: 'Signification des symboles', p: 'La poubelle barrée signifie que les batteries ne doivent pas être jetées avec les déchets ménagers. Sigles éventuels : Pb = plomb, Cd = cadmium, Hg = mercure.' },
      { h: 'Sécurité des batteries lithium', p: 'Protégez les bornes avec du ruban adhésif avant la reprise pour éviter tout court-circuit. Stockez une batterie endommagée au sec, à part, et remettez-la uniquement en main propre à un point de collecte.' },
    ],
  },
  en: {
    banner: 'Batteries must never be disposed of with household waste. Returning them is free of charge.',
    sections: [
      { h: 'Legal obligation', p: 'As a distributor of batteries (including those built into vehicles), we inform you that as an end user you are legally required to return used batteries (EU directive 2006/66/EC; German BattG for our customers in Germany).' },
      { h: 'Free take-back', p: `You can return used e-bike batteries to us free of charge:\n${ADDR}\nYou may also drop them off at municipal collection points or local retailers. Please contact us before shipping any lithium battery (contact@vitesse-eco.fr) — damaged batteries must never be sent by post.` },
      { h: 'Meaning of the symbols', p: 'The crossed-out wheeled bin means batteries must not go into household waste. Markings below the symbol: Pb = lead, Cd = cadmium, Hg = mercury.' },
      { h: 'Lithium battery safety', p: 'Tape over the terminals before returning to prevent short circuits. Store a damaged battery dry and separately, and hand it in personally at a collection point only.' },
    ],
  },
  es: {
    banner: 'Las baterías nunca deben desecharse con la basura doméstica. Su devolución es gratuita.',
    sections: [
      { h: 'Obligación legal', p: 'Como distribuidor de baterías (incluidas las integradas en vehículos), le informamos de que, como usuario final, está legalmente obligado a devolver las baterías usadas (directiva 2006/66/CE; ley alemana BattG para nuestros clientes en Alemania).' },
      { h: 'Devolución gratuita', p: `Puede devolvernos gratuitamente las baterías usadas de bicicleta eléctrica:\n${ADDR}\nTambién puede depositarlas en puntos de recogida municipales o comercios locales. Contáctenos antes de enviar una batería de litio (contact@vitesse-eco.fr) — una batería dañada nunca debe enviarse por correo.` },
      { h: 'Significado de los símbolos', p: 'El contenedor tachado significa que las baterías no deben tirarse a la basura doméstica. Siglas bajo el símbolo: Pb = plomo, Cd = cadmio, Hg = mercurio.' },
      { h: 'Seguridad de las baterías de litio', p: 'Cubra los bornes con cinta adhesiva antes de la devolución para evitar cortocircuitos. Guarde una batería dañada seca y separada, y entréguela únicamente en mano en un punto de recogida.' },
    ],
  },
  nl: {
    banner: 'Batterijen en accu’s horen nooit bij het huisvuil. Inleveren is gratis.',
    sections: [
      { h: 'Wettelijke verplichting', p: 'Als distributeur van batterijen en accu’s (ook ingebouwd in voertuigen) wijzen wij u erop dat u als eindgebruiker wettelijk verplicht bent gebruikte batterijen in te leveren (EU-richtlijn 2006/66/EG; Duitse BattG voor onze klanten in Duitsland).' },
      { h: 'Gratis inname', p: `U kunt gebruikte e-bike-accu’s gratis aan ons retourneren:\n${ADDR}\nU kunt ze ook inleveren bij gemeentelijke inzamelpunten of lokale winkels. Neem vóór verzending van een lithiumaccu contact met ons op (contact@vitesse-eco.fr) — een beschadigde accu mag nooit per post worden verzonden.` },
      { h: 'Betekenis van de symbolen', p: 'De doorgekruiste afvalcontainer betekent dat batterijen niet bij het huisvuil mogen. Tekens onder het symbool: Pb = lood, Cd = cadmium, Hg = kwik.' },
      { h: 'Veiligheid van lithiumaccu’s', p: 'Plak de polen af vóór inlevering om kortsluiting te voorkomen. Bewaar een beschadigde accu droog en apart, en lever deze alleen persoonlijk in bij een inzamelpunt.' },
    ],
  },
  ar: {
    banner: 'لا تُرمى البطاريات أبداً مع النفايات المنزلية. إعادتها مجانية.',
    sections: [
      { h: 'الالتزام القانوني', p: 'بصفتنا موزعاً للبطاريات (بما فيها المدمجة في المركبات)، نعلمك أنك ملزم قانوناً كمستخدم نهائي بإعادة البطاريات المستعملة (التوجيه الأوروبي 2006/66/EC؛ وقانون BattG الألماني لعملائنا في ألمانيا).' },
      { h: 'الاستعادة المجانية', p: `يمكنك إعادة بطاريات الدراجات الكهربائية المستعملة إلينا مجاناً:\n${ADDR}\nكما يمكنك تسليمها لنقاط الجمع البلدية أو المتاجر المحلية. تواصل معنا قبل شحن أي بطارية ليثيوم (contact@vitesse-eco.fr) — البطارية التالفة لا تُرسل بالبريد أبداً.` },
      { h: 'معنى الرموز', p: 'سلة المهملات المشطوبة تعني أن البطاريات لا تُرمى مع النفايات المنزلية. الرموز أسفلها: Pb = رصاص، Cd = كادميوم، Hg = زئبق.' },
      { h: 'سلامة بطاريات الليثيوم', p: 'غطِّ الأقطاب بشريط لاصق قبل الإعادة لتجنب التماس الكهربائي. خزّن البطارية التالفة جافة ومنفصلة، وسلّمها يدوياً فقط في نقطة جمع.' },
    ],
  },
}
const content = computed(() => allContent[locale.value] || allContent.fr)
const banner = computed(() => content.value.banner)
const sections = computed(() => content.value.sections)
</script>
