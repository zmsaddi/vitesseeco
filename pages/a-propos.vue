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
          <h2 class="font-display text-2xl md:text-3xl font-bold text-white mb-6">{{ $t('about.our_story') }}</h2>
          <div class="space-y-4 text-text-secondary leading-relaxed">
            <p>{{ aboutText }}</p>
          </div>
        </div>
      </div>

      <!-- Values -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div v-for="(value, i) in aboutValues" :key="i" class="card p-8 text-center">
          <div class="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon :name="value.icon" class="w-8 h-8 text-accent" />
          </div>
          <h3 class="font-display text-xl font-semibold text-white mb-3">{{ value.title }}</h3>
          <p class="text-text-secondary text-sm leading-relaxed">{{ value.desc }}</p>
        </div>
      </div>

      <!-- Company Info -->
      <div class="mt-16 card p-8 text-center">
        <h2 class="font-display text-xl font-semibold text-white mb-4">{{ $t('about.company_info') }}</h2>
        <div class="text-text-secondary text-sm space-y-1">
          <p><strong class="text-white">VITESSE ECO</strong> — SAS (Société par Actions Simplifiée)</p>
          <p>SIREN : 100 732 247 | SIRET : 100 732 247 00018</p>
          <p>APE : 46.90Z</p>
          <p>32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France</p>
          <p>{{ $t('about.active_since') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const l = useLocalizedField()

useHead({ title: `${t('about.title')} — Vitesse Eco` })

const query = groq`*[_type == "aboutPage"][0] { story }`
const { data: aboutData } = useSanityFetch(query)

const aboutText = computed(() => {
  if (aboutData.value?.story) return l(aboutData.value.story)
  return t('about.story_text')
})

const aboutValues = computed(() => [
  { icon: 'ph:seal-check', title: t('about.value1_title'), desc: t('about.value1_desc') },
  { icon: 'ph:truck', title: t('about.value2_title'), desc: t('about.value2_desc') },
  { icon: 'ph:wrench', title: t('about.value3_title'), desc: t('about.value3_desc') },
])
</script>
