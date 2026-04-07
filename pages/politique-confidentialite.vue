<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('footer.privacy') }}</h1>
      <div class="card p-6 md:p-8">
        <div v-if="legalData && l(legalData.politiqueConfidentialite)" class="text-text-secondary leading-relaxed whitespace-pre-line">{{ l(legalData.politiqueConfidentialite) }}</div>
        <div v-else class="text-text-secondary leading-relaxed space-y-4">
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
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const l = useLocalizedField()
useHead({ title: `${t('footer.privacy')} — Vitesse Eco` })
const { data: legalData } = useSanityFetch('legal-pages', groq`*[_type == "legalPages"][0]`)

const allTexts: Record<string, { collection: string; use: string; rights: string; cookies: string }> = {
  fr: {
    collection: "VITESSE ECO (SIREN 100 732 247) collecte uniquement les données nécessaires au traitement de vos commandes et à l'amélioration de nos services : nom, prénom, email, adresse de livraison, téléphone.",
    use: "Vos données sont utilisées exclusivement pour : le traitement de vos commandes, l'envoi de confirmations, la gestion du service après-vente, et, avec votre consentement, l'envoi de newsletters.",
    rights: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Contactez-nous à contact@vitesse-eco.fr.",
    cookies: "Ce site utilise des cookies techniques nécessaires à son fonctionnement et des cookies de préférence linguistique.",
  },
  en: {
    collection: "VITESSE ECO (SIREN 100 732 247) only collects data necessary for processing your orders and improving our services: name, email, delivery address, phone number.",
    use: "Your data is used exclusively for: processing your orders, sending confirmations, managing after-sales service, and, with your consent, sending newsletters.",
    rights: "In accordance with GDPR, you have the right to access, rectify, delete and transfer your data. Contact us at contact@vitesse-eco.fr.",
    cookies: "This site uses technical cookies necessary for its operation and language preference cookies.",
  },
  es: {
    collection: "VITESSE ECO (SIREN 100 732 247) solo recopila los datos necesarios para procesar tus pedidos y mejorar nuestros servicios: nombre, email, dirección de envío, teléfono.",
    use: "Tus datos se utilizan exclusivamente para: procesar tus pedidos, enviar confirmaciones, gestionar el servicio posventa y, con tu consentimiento, enviar newsletters.",
    rights: "De acuerdo con el RGPD, tienes derecho a acceder, rectificar, eliminar y transferir tus datos. Contáctanos en contact@vitesse-eco.fr.",
    cookies: "Este sitio utiliza cookies técnicas necesarias para su funcionamiento y cookies de preferencia de idioma.",
  },
  nl: {
    collection: "VITESSE ECO (SIREN 100 732 247) verzamelt alleen gegevens die nodig zijn voor het verwerken van je bestellingen en het verbeteren van onze diensten: naam, email, bezorgadres, telefoonnummer.",
    use: "Je gegevens worden uitsluitend gebruikt voor: het verwerken van je bestellingen, het verzenden van bevestigingen, het beheren van de klantenservice en, met je toestemming, het verzenden van nieuwsbrieven.",
    rights: "Conform de AVG heb je het recht op inzage, rectificatie, verwijdering en overdracht van je gegevens. Neem contact met ons op via contact@vitesse-eco.fr.",
    cookies: "Deze site gebruikt technische cookies die nodig zijn voor de werking en taalvoorkeurcookies.",
  },
  de: {
    collection: "VITESSE ECO (SIREN 100 732 247) erhebt nur Daten, die für die Bearbeitung Ihrer Bestellungen und die Verbesserung unserer Dienste erforderlich sind: Name, E-Mail, Lieferadresse, Telefonnummer.",
    use: "Ihre Daten werden ausschließlich verwendet für: die Bearbeitung Ihrer Bestellungen, den Versand von Bestätigungen, die Verwaltung des Kundendienstes und, mit Ihrer Zustimmung, den Versand von Newslettern.",
    rights: "Gemäß DSGVO haben Sie das Recht auf Zugang, Berichtigung, Löschung und Übertragbarkeit Ihrer Daten. Kontaktieren Sie uns unter contact@vitesse-eco.fr.",
    cookies: "Diese Website verwendet technische Cookies, die für ihren Betrieb erforderlich sind, sowie Sprachpräferenz-Cookies.",
  },
  ar: {
    collection: "VITESSE ECO (SIREN 100 732 247) تجمع فقط البيانات اللازمة لمعالجة طلباتك وتحسين خدماتنا: الاسم، البريد الإلكتروني، عنوان التوصيل، رقم الهاتف.",
    use: "تُستخدم بياناتك حصرياً لـ: معالجة طلباتك، إرسال التأكيدات، إدارة خدمة ما بعد البيع، وبموافقتك إرسال النشرات الإخبارية.",
    rights: "وفقاً لقانون حماية البيانات RGPD، لديك الحق في الوصول والتصحيح والحذف ونقل بياناتك. تواصل معنا على contact@vitesse-eco.fr.",
    cookies: "يستخدم هذا الموقع ملفات تعريف الارتباط التقنية اللازمة لعمله وملفات تفضيل اللغة.",
  },
}
const texts = computed(() => allTexts[locale.value] || allTexts.fr)
</script>
