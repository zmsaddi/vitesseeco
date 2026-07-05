<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('legal.impressum') }}</h1>
      <div class="card p-6 md:p-8 text-text-secondary leading-relaxed space-y-6">
        <section v-for="(s, i) in sections" :key="i">
          <h2 class="text-white font-display text-lg font-semibold mb-2">{{ s.h }}</h2>
          <p class="whitespace-pre-line text-sm">{{ s.p }}</p>
        </section>
        <p class="text-xs pt-4 border-t border-dark-tertiary">
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">https://ec.europa.eu/consumers/odr</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * U-K2 — Impressum (German market legal requirement, §5 DDG/TMG).
 * German is the legally authoritative text; other locales are courtesy
 * translations. Content lives in-page (cgv.vue pattern) so locale JSONs
 * only carry the page title.
 */
const { t, locale } = useI18n()
useHead({
  title: `${t('legal.impressum')} — Vitesse Eco`,
  meta: [{ name: 'description', content: `${t('legal.impressum')} — Vitesse Eco` }],
})

const COMPANY = 'VITESSE ECO SAS\n32 Rue du Faubourg du Pont Neuf\n86000 Poitiers, Frankreich'
const CONTACT = 'Tel.: +33 7 45 83 00 49\nE-Mail: contact@vitesse-eco.fr'
const REGISTER = 'RCS Poitiers — SIREN 100 732 247\nSIRET 100 732 247 00018 — APE 46.90Z'
const VAT = 'FR43 100 732 247'

type Section = { h: string; p: string }
const allSections: Record<string, Section[]> = {
  de: [
    { h: 'Anbieter', p: COMPANY },
    { h: 'Vertreten durch', p: 'Die Geschäftsführung der VITESSE ECO SAS' },
    { h: 'Kontakt', p: CONTACT },
    { h: 'Registereintrag', p: REGISTER },
    { h: 'Umsatzsteuer-Identifikationsnummer', p: `USt-IdNr. gemäß § 27a UStG: ${VAT}` },
    { h: 'Verantwortlich für den Inhalt', p: 'VITESSE ECO SAS, Anschrift wie oben' },
    { h: 'EU-Streitschlichtung', p: 'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.' },
  ],
  fr: [
    { h: 'Éditeur', p: COMPANY.replace('Frankreich', 'France') },
    { h: 'Représentée par', p: 'La direction de VITESSE ECO SAS' },
    { h: 'Contact', p: CONTACT },
    { h: 'Immatriculation', p: REGISTER },
    { h: 'TVA intracommunautaire', p: VAT },
    { h: 'Responsable de la publication', p: 'VITESSE ECO SAS, adresse ci-dessus' },
    { h: 'Règlement des litiges en ligne (UE)', p: "La Commission européenne met à disposition une plateforme de règlement en ligne des litiges. Nous ne sommes ni disposés ni tenus de participer à une procédure de règlement des litiges devant un organisme de médiation de la consommation." },
  ],
  en: [
    { h: 'Provider', p: COMPANY.replace('Frankreich', 'France') },
    { h: 'Represented by', p: 'The management of VITESSE ECO SAS' },
    { h: 'Contact', p: CONTACT },
    { h: 'Company registration', p: REGISTER },
    { h: 'VAT identification number', p: VAT },
    { h: 'Responsible for content', p: 'VITESSE ECO SAS, address as above' },
    { h: 'EU online dispute resolution', p: 'The European Commission provides a platform for online dispute resolution (ODR). We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.' },
  ],
  es: [
    { h: 'Editor', p: COMPANY.replace('Frankreich', 'Francia') },
    { h: 'Representada por', p: 'La dirección de VITESSE ECO SAS' },
    { h: 'Contacto', p: CONTACT },
    { h: 'Registro mercantil', p: REGISTER },
    { h: 'Número de IVA intracomunitario', p: VAT },
    { h: 'Responsable del contenido', p: 'VITESSE ECO SAS, dirección arriba indicada' },
    { h: 'Resolución de litigios en línea (UE)', p: 'La Comisión Europea pone a disposición una plataforma de resolución de litigios en línea. No estamos dispuestos ni obligados a participar en procedimientos de resolución de litigios ante una junta arbitral de consumo.' },
  ],
  nl: [
    { h: 'Aanbieder', p: COMPANY.replace('Frankreich', 'Frankrijk') },
    { h: 'Vertegenwoordigd door', p: 'De directie van VITESSE ECO SAS' },
    { h: 'Contact', p: CONTACT },
    { h: 'Handelsregister', p: REGISTER },
    { h: 'Btw-identificatienummer', p: VAT },
    { h: 'Verantwoordelijk voor de inhoud', p: 'VITESSE ECO SAS, adres zoals hierboven' },
    { h: 'Online geschillenbeslechting (EU)', p: 'De Europese Commissie biedt een platform voor onlinegeschillenbeslechting. Wij zijn niet bereid of verplicht deel te nemen aan geschillenbeslechtingsprocedures voor een consumentenarbitragecommissie.' },
  ],
  ar: [
    { h: 'الناشر', p: COMPANY.replace('Frankreich', 'فرنسا') },
    { h: 'ممثلة بـ', p: 'إدارة شركة VITESSE ECO SAS' },
    { h: 'التواصل', p: CONTACT },
    { h: 'السجل التجاري', p: REGISTER },
    { h: 'رقم ضريبة القيمة المضافة', p: VAT },
    { h: 'المسؤول عن المحتوى', p: 'VITESSE ECO SAS، العنوان أعلاه' },
    { h: 'تسوية النزاعات عبر الإنترنت (الاتحاد الأوروبي)', p: 'توفر المفوضية الأوروبية منصة لتسوية النزاعات عبر الإنترنت. لسنا مستعدين ولا ملزمين بالمشاركة في إجراءات تسوية النزاعات أمام هيئة تحكيم للمستهلكين.' },
  ],
}
const sections = computed(() => allSections[locale.value] || allSections.de)
</script>
