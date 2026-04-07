<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('footer.mentions_legales') }}</h1>
      <div class="card p-6 md:p-8">
        <div v-if="legalData && l(legalData.mentionsLegales)" class="text-text-secondary leading-relaxed whitespace-pre-line">{{ l(legalData.mentionsLegales) }}</div>
        <div v-else class="text-text-secondary leading-relaxed space-y-4">
          <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.editor') }}</h2>
          <p>VITESSE ECO — SAS (Société par Actions Simplifiée)<br>
            SIREN : 100 732 247 | SIRET : 100 732 247 00018<br>
            APE : 46.90Z<br>
            32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France<br>
            Email : contact@vitesse-eco.fr<br>
            Web : www.vitesse-eco.fr</p>
          <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.host') }}</h2>
          <p>Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, USA</p>
          <h2 class="text-white font-display text-xl font-semibold">{{ $t('legal.ip') }}</h2>
          <p>{{ ipText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const l = useLocalizedField()
useHead({ title: `${t('footer.mentions_legales')} — Vitesse Eco` })
const { data: legalData } = useSanityFetch('legal-pages', groq`*[_type == "legalPages"][0]`)

const ipTexts: Record<string, string> = {
  fr: "L'ensemble du contenu de ce site (textes, images, logos, vidéos) est la propriété exclusive de VITESSE ECO ou de ses partenaires. Toute reproduction est interdite sans autorisation écrite préalable.",
  en: "All content on this site (text, images, logos, videos) is the exclusive property of VITESSE ECO or its partners. Any reproduction is prohibited without prior written authorization.",
  es: "Todo el contenido de este sitio (textos, imágenes, logotipos, vídeos) es propiedad exclusiva de VITESSE ECO o de sus socios. Queda prohibida toda reproducción sin autorización previa por escrito.",
  nl: "Alle inhoud op deze site (teksten, afbeeldingen, logo's, video's) is het exclusieve eigendom van VITESSE ECO of haar partners. Reproductie is verboden zonder voorafgaande schriftelijke toestemming.",
  de: "Alle Inhalte dieser Website (Texte, Bilder, Logos, Videos) sind das ausschließliche Eigentum von VITESSE ECO oder ihrer Partner. Jede Reproduktion ist ohne vorherige schriftliche Genehmigung untersagt.",
  ar: "جميع محتويات هذا الموقع (نصوص، صور، شعارات، فيديوهات) هي ملكية حصرية لـ VITESSE ECO أو شركائها. يُمنع أي نسخ بدون إذن كتابي مسبق.",
}
const ipText = computed(() => ipTexts[locale.value] || ipTexts.fr)
</script>
