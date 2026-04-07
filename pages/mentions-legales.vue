<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('footer.mentions_legales') }}</h1>
      <div class="card p-6 md:p-8 prose-invert">
        <div v-if="legalData" class="text-text-secondary leading-relaxed whitespace-pre-line">{{ l(legalData.mentionsLegales) }}</div>
        <div v-else class="text-text-secondary leading-relaxed space-y-4">
          <h2 class="text-white font-display text-xl font-semibold">Éditeur du site</h2>
          <p>VITESSE ECO — SAS (Société par Actions Simplifiée)<br>
            SIREN : 100 732 247 | SIRET : 100 732 247 00018<br>
            APE : 46.90Z — Commerce de gros non spécialisé<br>
            Siège social : 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France<br>
            Email : contact@vitesse-eco.fr<br>
            Site web : www.vitesse-eco.com</p>
          <h2 class="text-white font-display text-xl font-semibold">Hébergeur</h2>
          <p>Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, USA</p>
          <h2 class="text-white font-display text-xl font-semibold">Propriété intellectuelle</h2>
          <p>L'ensemble du contenu de ce site (textes, images, logos, vidéos) est la propriété exclusive de VITESSE ECO ou de ses partenaires. Toute reproduction est interdite sans autorisation écrite préalable.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const l = useLocalizedField()
useHead({ title: `${t('footer.mentions_legales')} — Vitesse Eco` })
const { data: legalData } = useSanityQuery(groq`*[_type == "legalPages"][0]`)
</script>
