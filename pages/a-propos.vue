<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="section-title mb-4">{{ $t('about.title') }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ $t('about.subtitle') }}</p>
      </div>

      <!-- Brand Story with Image -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-16">
        <div class="card overflow-hidden">
          <img src="/poster.jpeg" alt="Vitesse Eco" class="w-full h-full object-cover" />
        </div>
        <div class="flex flex-col justify-center">
          <h2 class="font-display text-2xl md:text-3xl font-bold text-white mb-6">Notre Histoire</h2>
          <div class="space-y-4 text-text-secondary leading-relaxed">
            <p>
              Vitesse Eco est née d'une passion pour la mobilité électrique et le respect de l'environnement.
              Basée en France, notre mission est de rendre les fatbikes électriques accessibles à tous.
            </p>
            <p>
              Nous sélectionnons rigoureusement chaque modèle pour garantir qualité, performance et durabilité.
              Chaque vélo est testé et approuvé avant d'être proposé à nos clients.
            </p>
            <p>
              Notre gamme couvre tous les besoins : du vélo urbain compact au tout-terrain puissant,
              en passant par des modèles pliables et des versions longue autonomie.
            </p>
          </div>
        </div>
      </div>

      <!-- Values -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div v-for="value in values" :key="value.title" class="card p-8 text-center">
          <div class="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon :name="value.icon" class="w-8 h-8 text-accent" />
          </div>
          <h3 class="font-display text-xl font-semibold text-white mb-3">{{ value.title }}</h3>
          <p class="text-text-secondary text-sm leading-relaxed">{{ value.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

useHead({ title: `${t('about.title')} — Vitesse Eco` })

const values = [
  {
    icon: 'ph:seal-check',
    title: 'Qualité Garantie',
    description: 'Tous nos vélos sont équipés de composants premium : moteur 250W, freins hydrauliques, batteries haute capacité.',
  },
  {
    icon: 'ph:truck',
    title: 'Livraison Soignée',
    description: 'Chaque vélo est soigneusement emballé et livré à votre porte en France métropolitaine sous 5 jours ouvrés.',
  },
  {
    icon: 'ph:wrench',
    title: 'SAV Dédié',
    description: 'Notre équipe technique est disponible 6 jours sur 7 pour vous accompagner et répondre à toutes vos questions.',
  },
]
</script>
