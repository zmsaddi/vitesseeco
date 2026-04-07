<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('footer.cgv') }}</h1>
      <div class="card p-6 md:p-8">
        <div v-if="legalData" class="text-text-secondary leading-relaxed whitespace-pre-line">{{ l(legalData.cgv) }}</div>
        <div v-else class="text-text-secondary leading-relaxed space-y-4">
          <h2 class="text-white font-display text-xl font-semibold">Article 1 — Objet</h2>
          <p>Les présentes conditions générales de vente régissent les ventes de vélos électriques et accessoires par VITESSE ECO (SAS, SIREN 100 732 247), située au 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.</p>
          <h2 class="text-white font-display text-xl font-semibold">Article 2 — Prix</h2>
          <p>Les prix sont indiqués en euros TTC. VITESSE ECO se réserve le droit de modifier ses prix à tout moment. Les produits sont facturés sur la base des tarifs en vigueur au moment de la validation de la commande.</p>
          <h2 class="text-white font-display text-xl font-semibold">Article 3 — Livraison</h2>
          <p>La livraison est effectuée en France métropolitaine sous 5 à 10 jours ouvrés. Les frais de livraison sont offerts pour toute commande.</p>
          <h2 class="text-white font-display text-xl font-semibold">Article 4 — Droit de rétractation</h2>
          <p>Conformément à la législation française, vous disposez d'un délai de 14 jours à compter de la réception pour exercer votre droit de rétractation. Le produit doit être retourné dans son emballage d'origine, en parfait état.</p>
          <h2 class="text-white font-display text-xl font-semibold">Article 5 — Garantie</h2>
          <p>Tous nos vélos bénéficient de la garantie légale de conformité (2 ans) et de la garantie contre les vices cachés.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const l = useLocalizedField()
useHead({ title: `${t('footer.cgv')} — Vitesse Eco` })
const { data: legalData } = useSanityQuery(groq`*[_type == "legalPages"][0]`)
</script>
