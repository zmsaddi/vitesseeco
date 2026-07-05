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
    article3: "La livraison est offerte en France métropolitaine, en Belgique et aux Pays-Bas (48 à 72 h ouvrées ; la Belgique et les Pays-Bas sont desservis par notre propre service de livraison). Livraison au Luxembourg, en Allemagne et en Espagne selon les tarifs affichés lors de la commande.",
    article4: "Conformément à la législation française, vous disposez d'un délai de 14 jours à compter de la réception pour exercer votre droit de rétractation. Le produit doit être retourné dans son emballage d'origine, en parfait état.",
    article5: "Tous nos vélos bénéficient de la garantie légale de conformité (2 ans) et de la garantie contre les vices cachés.",
  },
  en: {
    article1: "These general terms and conditions of sale govern the sale of electric bikes and accessories by VITESSE ECO (SAS, SIREN 100 732 247), located at 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France.",
    article2: "Prices are indicated in euros including all taxes. VITESSE ECO reserves the right to modify its prices at any time. Products are invoiced based on the rates in effect at the time of order validation.",
    article3: "Delivery is free to mainland France, Belgium and the Netherlands (48–72 business hours; Belgium and the Netherlands are served by our own delivery service). Delivery to Luxembourg, Germany and Spain at the rates shown at checkout.",
    article4: "In accordance with French law, you have 14 days from receipt to exercise your right of withdrawal. The product must be returned in its original packaging, in perfect condition.",
    article5: "All our bikes benefit from the legal conformity guarantee (2 years) and the guarantee against hidden defects.",
  },
  es: {
    article1: "Las presentes condiciones generales de venta rigen las ventas de bicicletas eléctricas y accesorios por VITESSE ECO (SAS, SIREN 100 732 247), situada en 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Francia.",
    article2: "Los precios se indican en euros con todos los impuestos incluidos. VITESSE ECO se reserva el derecho de modificar sus precios en cualquier momento.",
    article3: "La entrega es gratuita en Francia metropolitana, Bélgica y los Países Bajos (48–72 h laborables; Bélgica y los Países Bajos son atendidos por nuestro propio servicio de reparto). Entrega en Luxemburgo, Alemania y España según las tarifas mostradas al finalizar la compra.",
    article4: "De acuerdo con la legislación francesa, dispones de 14 días desde la recepción para ejercer tu derecho de desistimiento. El producto debe ser devuelto en su embalaje original, en perfecto estado.",
    article5: "Todas nuestras bicicletas se benefician de la garantía legal de conformidad (2 años) y de la garantía contra vicios ocultos.",
  },
  nl: {
    article1: "Deze algemene verkoopvoorwaarden regelen de verkoop van elektrische fietsen en accessoires door VITESSE ECO (SAS, SIREN 100 732 247), gevestigd op 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankrijk.",
    article2: "Prijzen zijn vermeld in euro's inclusief alle belastingen. VITESSE ECO behoudt zich het recht voor om prijzen op elk moment te wijzigen.",
    article3: "Levering is gratis in Frankrijk, België en Nederland (48–72 werkuren; België en Nederland worden bediend door onze eigen bezorgdienst). Levering in Luxemburg, Duitsland en Spanje tegen de tarieven die bij het afrekenen worden getoond.",
    article4: "Volgens de Franse wetgeving heb je 14 dagen na ontvangst om je herroepingsrecht uit te oefenen. Het product moet worden teruggestuurd in de originele verpakking, in perfecte staat.",
    article5: "Al onze fietsen profiteren van de wettelijke conformiteitsgarantie (2 jaar) en de garantie tegen verborgen gebreken.",
  },
  de: {
    article1: "Diese allgemeinen Geschäftsbedingungen regeln den Verkauf von Elektrofahrrädern und Zubehör durch VITESSE ECO (SAS, SIREN 100 732 247), ansässig in 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich.",
    article2: "Die Preise sind in Euro inklusive aller Steuern angegeben. VITESSE ECO behält sich das Recht vor, seine Preise jederzeit zu ändern.",
    article3: "Die Lieferung ist nach Frankreich, Belgien und in die Niederlande kostenlos (48–72 Werkstunden; Belgien und die Niederlande werden von unserem eigenen Lieferdienst bedient). Lieferung nach Luxemburg, Deutschland und Spanien zu den im Checkout angezeigten Tarifen.",
    article4: "Gemäß französischem Recht haben Sie 14 Tage nach Erhalt Zeit, Ihr Widerrufsrecht auszuüben. Das Produkt muss in der Originalverpackung in einwandfreiem Zustand zurückgesendet werden.",
    article5: "Alle unsere Fahrräder profitieren von der gesetzlichen Konformitätsgarantie (2 Jahre) und der Garantie gegen versteckte Mängel.",
  },
  ar: {
    article1: "تنظم شروط البيع العامة هذه مبيعات الدراجات الكهربائية والإكسسوارات من طرف VITESSE ECO (SAS, SIREN 100 732 247)، الكائنة بـ 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France.",
    article2: "الأسعار معروضة باليورو شاملة جميع الضرائب. تحتفظ VITESSE ECO بالحق في تعديل أسعارها في أي وقت.",
    article3: "التوصيل مجاني إلى فرنسا وبلجيكا وهولندا (48–72 ساعة عمل؛ بلجيكا وهولندا تُخدمان عبر خدمة التوصيل الخاصة بنا). التوصيل إلى لوكسمبورغ وألمانيا وإسبانيا حسب التعرفة المعروضة عند الدفع.",
    article4: "وفقاً للتشريع الفرنسي، لديك 14 يوماً من تاريخ الاستلام لممارسة حق الانسحاب. يجب إعادة المنتج في تغليفه الأصلي وبحالة ممتازة.",
    article5: "تستفيد جميع دراجاتنا من ضمان المطابقة القانوني (سنتان) والضمان ضد العيوب المخفية.",
  },
}
const texts = computed(() => allTexts[locale.value] || allTexts.fr)
</script>
