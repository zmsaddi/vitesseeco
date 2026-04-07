<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('footer.privacy') }}</h1>
      <div class="card p-6 md:p-8">
        <div v-if="legalData" class="text-text-secondary leading-relaxed whitespace-pre-line">{{ l(legalData.politiqueConfidentialite) }}</div>
        <div v-else class="text-text-secondary leading-relaxed space-y-4">
          <h2 class="text-white font-display text-xl font-semibold">Collecte des données</h2>
          <p>VITESSE ECO (SIREN 100 732 247) collecte uniquement les données nécessaires au traitement de vos commandes et à l'amélioration de nos services : nom, prénom, email, adresse de livraison, téléphone.</p>
          <h2 class="text-white font-display text-xl font-semibold">Utilisation des données</h2>
          <p>Vos données sont utilisées exclusivement pour : le traitement de vos commandes, l'envoi de confirmations, la gestion du service après-vente, et, avec votre consentement, l'envoi de newsletters.</p>
          <h2 class="text-white font-display text-xl font-semibold">Vos droits</h2>
          <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Contactez-nous à contact@vitesse-eco.fr.</p>
          <h2 class="text-white font-display text-xl font-semibold">Cookies</h2>
          <p>Ce site utilise des cookies techniques nécessaires à son fonctionnement et des cookies de préférence linguistique.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const l = useLocalizedField()
useHead({ title: `${t('footer.privacy')} — Vitesse Eco` })
const { data: legalData } = useSanityQuery(groq`*[_type == "legalPages"][0]`)
</script>
