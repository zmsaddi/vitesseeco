<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="section-title mb-4">{{ pageTitle }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ pageSubtitle }}</p>
      </div>

      <!-- Brand Story with Image -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-16">
        <div class="card overflow-hidden">
          <img src="/poster.webp" alt="Vitesse Eco" width="1200" height="630" class="w-full h-full object-cover" />
        </div>
        <div class="flex flex-col justify-center">
          <h2 class="font-display text-2xl md:text-3xl font-bold text-white mb-6">{{ $t('about.our_story') }}</h2>
          <div class="space-y-4 text-text-secondary leading-relaxed">
            <p>{{ aboutText }}</p>
          </div>
        </div>
      </div>

      <!-- U-P12: proof in numbers — scannable trust band -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        <div v-for="stat in stats" :key="stat.label" class="card p-5 text-center">
          <p class="font-display text-2xl md:text-3xl font-black text-accent">{{ stat.value }}</p>
          <p class="text-text-secondary text-xs md:text-sm mt-1">{{ stat.label }}</p>
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

      <!-- U-P12: never a dead-end page — route the reader to the catalog -->
      <div class="mt-10 card p-8 text-center bg-accent/5 border-accent/30">
        <h2 class="font-display text-xl md:text-2xl font-bold text-white mb-4">{{ $t('about.cta_title') }}</h2>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <NuxtLink :to="localePath('/produits')" class="btn-primary">{{ $t('cart.empty_cta') }}</NuxtLink>
          <NuxtLink :to="localePath('/contact')" class="btn-secondary">{{ $t('nav.contact') }}</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const l = useLocalizedField()
const localePath = useLocalePath()

const stats = computed(() => [
  { value: '140+', label: t('about.stat_products') },
  { value: '10', label: t('about.stat_brands') },
  { value: '6', label: t('about.stat_countries') },
  { value: '2', label: t('about.stat_warranty') },
])

const query = groq`*[_type == "aboutPage"][0]{ title, subtitle, story, values, seo }`
const { data: aboutData } = useSanityFetch('about-page', query)

useSeoMeta({
  title: () => aboutData.value?.seo?.title || `${t('about.title')} — Vitesse Eco`,
  description: () => aboutData.value?.seo?.description || '',
})

const pageTitle = computed(() => aboutData.value?.title ? l(aboutData.value.title) : t('about.title'))
const pageSubtitle = computed(() => aboutData.value?.subtitle ? l(aboutData.value.subtitle) : t('about.subtitle'))

const aboutText = computed(() => {
  if (aboutData.value?.story) return l(aboutData.value.story)
  return t('about.story_text')
})

const iconMap: Record<string, string> = {
  'seal-check': 'ph:seal-check',
  'truck': 'ph:truck',
  'wrench': 'ph:wrench',
}

const aboutValues = computed(() => {
  if (aboutData.value?.values?.length) {
    return aboutData.value.values.map((v: any) => ({
      icon: iconMap[v.icon] || `ph:${v.icon}`,
      title: l(v.title),
      desc: l(v.description),
    }))
  }
  return [
    { icon: 'ph:seal-check', title: t('about.value1_title'), desc: t('about.value1_desc') },
    { icon: 'ph:truck', title: t('about.value2_title'), desc: t('about.value2_desc') },
    { icon: 'ph:wrench', title: t('about.value3_title'), desc: t('about.value3_desc') },
  ]
})
</script>
