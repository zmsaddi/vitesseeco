<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="section-title mb-4">{{ $t('guide.title') }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ $t('guide.subtitle') }}</p>
      </div>

      <!-- Quiz / Filter -->
      <div class="space-y-6 mb-12">
        <!-- Step 1: Usage -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold">1</span>
            {{ $t('guide.usage_question') }}
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button v-for="opt in usageOptions" :key="opt.value" @click="usage = opt.value"
              class="p-4 rounded-lg border text-left transition-colors flex items-start gap-3"
              :class="usage === opt.value ? 'border-accent bg-accent/5' : 'border-dark-tertiary hover:border-dark-tertiary/80'">
              <Icon :name="opt.icon" class="w-6 h-6 text-accent shrink-0 mt-0.5" />
              <div>
                <p class="text-white font-medium text-sm">{{ opt.label }}</p>
                <p class="text-text-secondary text-xs mt-0.5">{{ opt.desc }}</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Step 2: Height -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold">2</span>
            {{ $t('guide.height_question') }}
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button v-for="opt in heightOptions" :key="opt.value" @click="height = opt.value"
              class="p-4 rounded-lg border text-center transition-colors"
              :class="height === opt.value ? 'border-accent bg-accent/5' : 'border-dark-tertiary hover:border-dark-tertiary/80'">
              <Icon name="ph:person" class="w-6 h-6 text-accent mx-auto mb-2" />
              <p class="text-white font-medium text-sm">{{ opt.label }}</p>
            </button>
          </div>
        </div>

        <!-- Step 3: Range -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold">3</span>
            {{ $t('guide.range_question') }}
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button v-for="opt in rangeOptions" :key="opt.value" @click="range = opt.value"
              class="p-4 rounded-lg border text-center transition-colors"
              :class="range === opt.value ? 'border-accent bg-accent/5' : 'border-dark-tertiary hover:border-dark-tertiary/80'">
              <Icon name="ph:battery-charging" class="w-6 h-6 text-accent mx-auto mb-2" />
              <p class="text-white font-medium text-sm">{{ opt.label }}</p>
            </button>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div v-if="recommendations.length" class="space-y-6">
        <h2 class="section-title text-center">{{ $t('guide.results_title') }}</h2>
        <p class="text-text-secondary text-center mb-8">{{ $t('guide.results_subtitle', { count: recommendations.length }) }}</p>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink v-for="p in recommendations" :key="p._id" :to="localePath(`/produits/${p.slug?.current}`)">
            <ProductCard :product="p" />
          </NuxtLink>
        </div>
      </div>

      <!-- No results yet -->
      <div v-else-if="!usage && !height && !range" class="text-center py-8">
        <Icon name="ph:arrow-up" class="w-8 h-8 text-accent mx-auto mb-3 animate-bounce" />
        <p class="text-text-secondary">{{ $t('guide.start_hint') }}</p>
      </div>

      <!-- Comparison Table -->
      <div class="mt-16">
        <h2 class="section-title text-center mb-8">{{ $t('guide.comparison_title') }}</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm" v-if="allProducts?.length">
            <thead>
              <tr class="border-b border-dark-tertiary">
                <th class="text-left text-text-secondary p-3 font-medium">{{ $t('guide.model') }}</th>
                <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.tire_size') }}</th>
                <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.battery') }}</th>
                <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.range') }}</th>
                <th class="text-center text-text-secondary p-3 font-medium">{{ $t('guide.price') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in allProducts" :key="p._id" class="border-b border-dark-tertiary/50 hover:bg-dark-secondary/50">
                <td class="p-3">
                  <NuxtLink :to="localePath(`/produits/${p.slug?.current}`)" class="text-accent hover:underline font-medium">
                    {{ l(p.name) }}
                  </NuxtLink>
                </td>
                <td class="text-center text-text-secondary p-3">{{ p.specifications?.tireSize || '—' }}</td>
                <td class="text-center text-text-secondary p-3">{{ p.specifications?.battery || '—' }}</td>
                <td class="text-center text-text-secondary p-3">{{ sv(p.specifications?.range) || '—' }}</td>
                <td class="text-center text-white font-medium p-3">{{ p.price }}€</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- CTA -->
      <div class="text-center mt-12 card p-8">
        <h2 class="font-display text-xl font-semibold text-white mb-3">{{ $t('guide.need_help') }}</h2>
        <p class="text-text-secondary mb-6">{{ $t('guide.need_help_desc') }}</p>
        <NuxtLink :to="localePath('/contact')" class="btn-primary inline-block">{{ $t('nav.contact') }}</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const sv = (v: any) => typeof v === 'object' && v !== null ? l(v) : v

useHead({
  title: `${t('guide.title')} — Vitesse Eco`,
  meta: [{ name: 'description', content: t('guide.subtitle') }],
})

const { data: allProducts } = useSanityFetch(
  'all-products-guide',
  groq`*[_type == "product" && isAvailable == true] | order(sortOrder asc) {
    _id, name, slug, price, specifications, category->{ name },
    variants[]{ _key, colorHex, colorName, stock, "images": images[]{asset} }
  }`
)

const usage = ref('')
const height = ref('')
const range = ref('')

const usageOptions = computed(() => [
  { value: 'urban', icon: 'ph:buildings', label: t('guide.urban'), desc: t('guide.urban_desc') },
  { value: 'offroad', icon: 'ph:mountains', label: t('guide.offroad'), desc: t('guide.offroad_desc') },
  { value: 'foldable', icon: 'ph:suitcase-rolling', label: t('guide.foldable'), desc: t('guide.foldable_desc') },
  { value: 'lady', icon: 'ph:flower-lotus', label: t('guide.lady'), desc: t('guide.lady_desc') },
])

const heightOptions = computed(() => [
  { value: 'short', label: t('guide.height_short') },
  { value: 'medium', label: t('guide.height_medium') },
  { value: 'tall', label: t('guide.height_tall') },
])

const rangeOptions = computed(() => [
  { value: 'short', label: t('guide.range_short') },
  { value: 'medium', label: t('guide.range_medium') },
  { value: 'long', label: t('guide.range_long') },
])

const recommendations = computed(() => {
  if (!allProducts.value?.length) return []
  let filtered = [...allProducts.value]

  if (usage.value) {
    // Filter by category keyword matching
    const categoryMap: Record<string, string[]> = {
      urban: ['urbain', 'urban', 'city'],
      offroad: ['terrain', 'offroad', 'cross'],
      foldable: ['pliable', 'foldable', 'folding'],
      lady: ['femme', 'lady', 'dame', 'women'],
    }
    const keywords = categoryMap[usage.value] || []
    if (keywords.length) {
      const matched = filtered.filter(p => {
        const catName = (p.category?.name?.fr || '').toLowerCase()
        return keywords.some(k => catName.includes(k))
      })
      if (matched.length) filtered = matched
    }
  }

  if (height.value === 'short') {
    // 16" tires
    const matched = filtered.filter(p => p.specifications?.tireSize?.includes('16'))
    if (matched.length) filtered = matched
  } else if (height.value === 'tall') {
    // 24" tires
    const matched = filtered.filter(p => p.specifications?.tireSize?.includes('24'))
    if (matched.length) filtered = matched
  }

  if (range.value === 'long') {
    // 60km+
    const matched = filtered.filter(p => {
      const r = p.specifications?.range || ''
      const num = parseInt(r.match(/\d+/)?.[0] || '0')
      return num >= 60
    })
    if (matched.length) filtered = matched
  } else if (range.value === 'short') {
    // Under 50km
    const matched = filtered.filter(p => {
      const r = p.specifications?.range || ''
      const num = parseInt(r.match(/(\d+)-?(\d+)?/)?.[2] || r.match(/\d+/)?.[0] || '100')
      return num <= 50
    })
    if (matched.length) filtered = matched
  }

  return filtered.slice(0, 6)
})
</script>
