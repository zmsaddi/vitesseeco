<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-3xl">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="section-title mb-4">{{ $t('faq.title') }}</h1>
        <p class="text-text-secondary text-lg">{{ $t('faq.subtitle') }}</p>
      </div>

      <!-- Category filter -->
      <div class="flex flex-wrap gap-2 justify-center mb-8">
        <button
          v-for="cat in categories"
          :key="cat.value"
          @click="selectedCategory = cat.value"
          class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
          :class="selectedCategory === cat.value ? 'bg-accent text-primary' : 'bg-dark-secondary text-text-secondary hover:text-white'"
        >
          {{ cat.label }}
        </button>
      </div>

      <!-- FAQ items -->
      <div v-if="filteredFaqs?.length" class="space-y-3">
        <div v-for="(faq, i) in filteredFaqs" :key="faq._id || i" class="card overflow-hidden">
          <button
            @click="toggleFaq(Number(i))"
            class="w-full flex items-center justify-between p-5 text-left hover:bg-dark-secondary/50 transition-colors"
          >
            <span class="font-medium text-white pr-4">{{ l(faq.question) }}</span>
            <Icon
              name="ph:caret-down"
              class="w-5 h-5 text-accent shrink-0 transition-transform"
              :class="openIndex === i ? 'rotate-180' : ''"
            />
          </button>
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 max-h-0"
            enter-to-class="opacity-100 max-h-96"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 max-h-96"
            leave-to-class="opacity-0 max-h-0"
          >
            <div v-if="openIndex === i" class="px-5 pb-5 overflow-hidden">
              <p class="text-text-secondary leading-relaxed whitespace-pre-line">{{ l(faq.answer) }}</p>
            </div>
          </Transition>
        </div>
      </div>

      <div v-else class="text-center py-16">
        <Icon name="ph:question" class="w-16 h-16 text-dark-tertiary mx-auto mb-4" />
        <p class="text-text-secondary">{{ $t('faq.no_results') }}</p>
      </div>

      <!-- Contact CTA -->
      <div class="text-center mt-12 card p-8">
        <h2 class="font-display text-xl font-semibold text-white mb-3">{{ $t('faq.still_questions') }}</h2>
        <p class="text-text-secondary mb-6">{{ $t('faq.contact_us') }}</p>
        <NuxtLink :to="localePath('/contact')" class="btn-primary inline-block">
          {{ $t('nav.contact') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()

useHead({
  title: `${t('faq.title')} — Vitesse Eco`,
  meta: [
    { name: 'description', content: t('faq.subtitle') },
  ],
})

const { data: faqs } = useSanityFetch(
  'faq-list',
  groq`*[_type == "faq" && isPublished == true] | order(sortOrder asc) { _id, question, answer, category }`
)

const selectedCategory = ref('all')
const openIndex = ref<number | null>(null)

const categories = computed(() => {
  const cats = [
    { value: 'all', label: t('faq.cat_all') },
    { value: 'general', label: t('faq.cat_general') },
    { value: 'technical', label: t('faq.cat_technical') },
    { value: 'shipping', label: t('faq.cat_shipping') },
    { value: 'payment', label: t('faq.cat_payment') },
    { value: 'maintenance', label: t('faq.cat_maintenance') },
  ]
  return cats
})

const filteredFaqs = computed(() => {
  if (!faqs.value) return []
  if (selectedCategory.value === 'all') return faqs.value
  return faqs.value.filter((f: any) => f.category === selectedCategory.value)
})

function toggleFaq(index: number) {
  openIndex.value = openIndex.value === index ? null : index
}

// FAQPage JSON-LD
useHead({
  script: computed(() => {
    if (!faqs.value?.length) return []
    return [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.value.map((faq: any) => ({
          '@type': 'Question',
          name: l(faq.question),
          acceptedAnswer: {
            '@type': 'Answer',
            text: l(faq.answer),
          },
        })),
      }),
    }]
  }),
})
</script>
