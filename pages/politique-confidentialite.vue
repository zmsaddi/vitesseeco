<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('footer.privacy') }}</h1>

      <LegalSections v-if="legalData?.privacySections?.length" :sections="legalData.privacySections" />

      <div v-else-if="legalData && l(legalData.politiqueConfidentialite)" class="card p-6 md:p-8 text-text-secondary leading-relaxed whitespace-pre-line">{{ l(legalData.politiqueConfidentialite) }}</div>

      <div v-else class="card p-6 md:p-8 text-text-secondary leading-relaxed space-y-4">
        <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.data_collection') }}</h2>
        <p>{{ texts.collection }}</p>
        <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.data_use') }}</h2>
        <p>{{ texts.use }}</p>
        <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.your_rights') }}</h2>
        <p>{{ texts.rights }}</p>
        <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.cookies') }}</h2>
        <p>{{ texts.cookies }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const l = useLocalizedField()
useHead({
  title: `${t('footer.privacy')} — Vitesse Eco`,
  meta: [{ name: 'description', content: `${t('footer.privacy')} — Vitesse Eco` }],
})
const { data: legalData } = useSanityFetch('legal-pages', groq`*[_type == "legalPages"][0]{ politiqueConfidentialite, privacySections }`)

const allTexts: Record<string, { collection: string; use: string; rights: string; cookies: string }> = {
  fr: {
    collection: "VITESSE ECO (SIREN 100 732 247) collecte uniquement les données nécessaires au traitement de vos commandes et à l'amélioration de nos services : nom, prénom, email, adresse de livraison, téléphone.",
    use: "Vos données sont utilisées exclusivement pour : le traitement de vos commandes, l'envoi de confirmations, la gestion du service après-vente, et, avec votre consentement, l'envoi de newsletters.",
    rights: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Contactez-nous à contact@vitesse-eco.fr.",
    cookies: "Ce site utilise des cookies techniques nécessaires à son fonctionnement et des cookies de préférence linguistique.",
  },
  en: {
    collection: "VITESSE ECO only collects data necessary for processing your orders: name, email, delivery address, phone number.",
    use: "Your data is used exclusively for: processing orders, sending confirmations, managing after-sales service, and with your consent, newsletters.",
    rights: "In accordance with GDPR, you have the right to access, rectify, delete and transfer your data. Contact us at contact@vitesse-eco.fr.",
    cookies: "This site uses technical cookies necessary for its operation and language preference cookies.",
  },
  es: { collection: "VITESSE ECO solo recopila los datos necesarios para procesar tus pedidos.", use: "Tus datos se utilizan exclusivamente para procesar pedidos y enviar confirmaciones.", rights: "De acuerdo con el RGPD, tienes derecho a acceder, rectificar y eliminar tus datos.", cookies: "Este sitio utiliza cookies técnicas necesarias para su funcionamiento." },
  nl: { collection: "VITESSE ECO verzamelt alleen gegevens die nodig zijn voor het verwerken van bestellingen.", use: "Je gegevens worden uitsluitend gebruikt voor het verwerken van bestellingen en het verzenden van bevestigingen.", rights: "Conform de AVG heb je het recht op inzage, rectificatie en verwijdering van je gegevens.", cookies: "Deze site gebruikt technische cookies die nodig zijn voor de werking." },
  de: { collection: "VITESSE ECO erhebt nur Daten, die für die Bearbeitung Ihrer Bestellungen erforderlich sind.", use: "Ihre Daten werden ausschließlich für die Bearbeitung von Bestellungen und den Versand von Bestätigungen verwendet.", rights: "Gemäß DSGVO haben Sie das Recht auf Zugang, Berichtigung und Löschung Ihrer Daten.", cookies: "Diese Website verwendet technische Cookies, die für ihren Betrieb erforderlich sind." },
  ar: { collection: "VITESSE ECO تجمع فقط البيانات اللازمة لمعالجة طلباتك.", use: "تُستخدم بياناتك حصرياً لمعالجة الطلبات وإرسال التأكيدات.", rights: "وفقاً لقانون RGPD، لديك الحق في الوصول والتصحيح والحذف.", cookies: "يستخدم هذا الموقع ملفات تعريف الارتباط التقنية اللازمة لعمله." },
}
const texts = computed(() => allTexts[locale.value] || allTexts.fr)
</script>
