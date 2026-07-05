<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('footer.cgv') }}</h1>
      <LegalSections v-if="legalData?.cgvSections?.length" :sections="legalData.cgvSections" />

      <div v-else-if="legalData && l(legalData.cgv)" class="card p-6 md:p-8 text-text-secondary leading-relaxed whitespace-pre-line">{{ l(legalData.cgv) }}</div>

      <div v-else class="card p-6 md:p-8 text-text-secondary leading-relaxed space-y-4">
          <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.article1') }}</h2>
          <p>{{ texts.article1 }}</p>
          <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.article2') }}</h2>
          <p>{{ texts.article2 }}</p>
          <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.article3') }}</h2>
          <p>{{ texts.article3 }}</p>
          <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.article4') }}</h2>
          <p>{{ texts.article4 }}</p>
          <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.article5') }}</h2>
          <p>{{ texts.article5 }}</p>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const l = useLocalizedField()
useHead({
  title: `${t('footer.cgv')} — Vitesse Eco`,
  meta: [{ name: 'description', content: `${t('footer.cgv')} — Vitesse Eco` }],
})
const { data: legalData } = useSanityFetch('legal-pages', groq`*[_type == "legalPages"][0]{ cgv, cgvSections }`)

const allTexts: Record<string, Record<string, string>> = {
  fr: {
    article1: "Les présentes conditions générales de vente régissent les ventes de vélos électriques et accessoires par VITESSE ECO (SAS, SIREN 100 732 247), située au 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.",
    article2: "Les prix sont indiqués en euros TTC. VITESSE ECO se réserve le droit de modifier ses prix à tout moment. Les produits sont facturés sur la base des tarifs en vigueur au moment de la validation de la commande.",
    article3: "La livraison à domicile est offerte par notre propre service en Belgique, aux Pays-Bas et dans la région de Poitiers (codes postaux 86xxx), sous 48 à 72 h ouvrées. Le paiement à la livraison est accepté en Belgique et aux Pays-Bas. Pour les autres destinations : retrait gratuit en magasin à Poitiers — nos zones de livraison s'étendent progressivement.",
    article4: "Conformément à la législation française, vous disposez d'un délai de 14 jours à compter de la réception pour exercer votre droit de rétractation. Le produit doit être retourné dans son emballage d'origine, en parfait état.",
    article5: "Tous nos vélos bénéficient de la garantie légale de conformité (2 ans) et de la garantie contre les vices cachés.",
  },
  en: {
    article1: "These general terms and conditions of sale govern the sale of electric bikes and accessories by VITESSE ECO (SAS, SIREN 100 732 247), located at 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France.",
    article2: "Prices are indicated in euros including all taxes. VITESSE ECO reserves the right to modify its prices at any time. Products are invoiced based on the rates in effect at the time of order validation.",
    article3: "Free home delivery by our own service to Belgium, the Netherlands and the Poitiers region (postal codes 86xxx), within 48–72 business hours. Cash on delivery is accepted in Belgium and the Netherlands. Other destinations: free store pickup in Poitiers — our delivery zones are expanding.",
    article4: "In accordance with French law, you have 14 days from receipt to exercise your right of withdrawal. The product must be returned in its original packaging, in perfect condition.",
    article5: "All our bikes benefit from the legal conformity guarantee (2 years) and the guarantee against hidden defects.",
  },
  es: {
    article1: "Las presentes condiciones generales de venta rigen las ventas de bicicletas eléctricas y accesorios por VITESSE ECO (SAS, SIREN 100 732 247), situada en 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Francia.",
    article2: "Los precios se indican en euros con todos los impuestos incluidos. VITESSE ECO se reserva el derecho de modificar sus precios en cualquier momento.",
    article3: "Entrega a domicilio gratuita con nuestro propio servicio en Bélgica, los Países Bajos y la región de Poitiers (códigos postales 86xxx), en 48–72 h laborables. Se acepta pago contra reembolso en Bélgica y los Países Bajos. Otros destinos: recogida gratuita en nuestra tienda de Poitiers — nuestras zonas de entrega se amplían progresivamente.",
    article4: "De acuerdo con la legislación francesa, dispones de 14 días desde la recepción para ejercer tu derecho de desistimiento. El producto debe ser devuelto en su embalaje original, en perfecto estado.",
    article5: "Todas nuestras bicicletas se benefician de la garantía legal de conformidad (2 años) y de la garantía contra vicios ocultos.",
  },
  nl: {
    article1: "Deze algemene verkoopvoorwaarden regelen de verkoop van elektrische fietsen en accessoires door VITESSE ECO (SAS, SIREN 100 732 247), gevestigd op 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankrijk.",
    article2: "Prijzen zijn vermeld in euro's inclusief alle belastingen. VITESSE ECO behoudt zich het recht voor om prijzen op elk moment te wijzigen.",
    article3: "Gratis thuisbezorging door onze eigen dienst in België, Nederland en de regio Poitiers (postcodes 86xxx), binnen 48–72 werkuren. Contant betalen bij levering kan in België en Nederland. Overige bestemmingen: gratis afhalen in onze winkel in Poitiers — onze bezorgzones breiden zich uit.",
    article4: "Volgens de Franse wetgeving heb je 14 dagen na ontvangst om je herroepingsrecht uit te oefenen. Het product moet worden teruggestuurd in de originele verpakking, in perfecte staat.",
    article5: "Al onze fietsen profiteren van de wettelijke conformiteitsgarantie (2 jaar) en de garantie tegen verborgen gebreken.",
  },
  de: {
    article1: "Diese allgemeinen Geschäftsbedingungen regeln den Verkauf von Elektrofahrrädern und Zubehör durch VITESSE ECO (SAS, SIREN 100 732 247), ansässig in 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich.",
    article2: "Die Preise sind in Euro inklusive aller Steuern angegeben. VITESSE ECO behält sich das Recht vor, seine Preise jederzeit zu ändern.",
    article3: "Kostenlose Lieferung nach Hause durch unseren eigenen Dienst nach Belgien, in die Niederlande und in die Region Poitiers (Postleitzahlen 86xxx), innerhalb von 48–72 Werkstunden. Barzahlung bei Lieferung ist in Belgien und den Niederlanden möglich. Andere Ziele: kostenlose Abholung in unserem Geschäft in Poitiers — unsere Lieferzonen werden schrittweise erweitert.",
    article4: "Gemäß französischem Recht haben Sie 14 Tage nach Erhalt Zeit, Ihr Widerrufsrecht auszuüben. Das Produkt muss in der Originalverpackung in einwandfreiem Zustand zurückgesendet werden.",
    article5: "Alle unsere Fahrräder profitieren von der gesetzlichen Konformitätsgarantie (2 Jahre) und der Garantie gegen versteckte Mängel.",
  },
  ar: {
    article1: "تنظم شروط البيع العامة هذه مبيعات الدراجات الكهربائية والإكسسوارات من طرف VITESSE ECO (SAS, SIREN 100 732 247)، الكائنة بـ 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France.",
    article2: "الأسعار معروضة باليورو شاملة جميع الضرائب. تحتفظ VITESSE ECO بالحق في تعديل أسعارها في أي وقت.",
    article3: "التوصيل المنزلي مجاني عبر خدمتنا الخاصة إلى بلجيكا وهولندا ومنطقة بواتييه (الرموز البريدية 86xxx) خلال 48–72 ساعة عمل. الدفع عند الاستلام متاح في بلجيكا وهولندا. بقية الوجهات: استلام مجاني من متجرنا في بواتييه — ومناطق التوصيل تتوسع تدريجياً.",
    article4: "وفقاً للتشريع الفرنسي، لديك 14 يوماً من تاريخ الاستلام لممارسة حق الانسحاب. يجب إعادة المنتج في تغليفه الأصلي وبحالة ممتازة.",
    article5: "تستفيد جميع دراجاتنا من ضمان المطابقة القانوني (سنتان) والضمان ضد العيوب المخفية.",
  },
}
const texts = computed(() => allTexts[locale.value] || allTexts.fr)
</script>
