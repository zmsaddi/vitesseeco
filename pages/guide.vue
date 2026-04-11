<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="section-title mb-4">{{ $t('guide.title') }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ $t('guide.subtitle') }}</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <!-- Filters sidebar -->
        <div class="lg:col-span-1">
          <div class="card p-5 sticky top-24 space-y-6">
            <h2 class="font-display font-semibold text-white text-lg">{{ $t('guide.filters') }}</h2>

            <!-- Usage -->
            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('guide.usage_question') }}</label>
              <div class="space-y-2">
                <button v-for="opt in usageOptions" :key="opt.value"
                  @click="usage = usage === opt.value ? '' : opt.value"
                  class="w-full p-3 rounded-lg border text-left transition-colors flex items-center gap-2 text-sm"
                  :class="usage === opt.value ? 'border-accent bg-accent/5 text-accent' : 'border-dark-tertiary text-text-secondary hover:border-dark-tertiary/80'">
                  <Icon :name="opt.icon" class="w-5 h-5 shrink-0" />
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Price -->
            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('guide.budget') }}</label>
              <div class="space-y-2">
                <button v-for="opt in budgetOptions" :key="opt.value"
                  @click="budget = budget === opt.value ? '' : opt.value"
                  class="w-full p-2.5 rounded-lg border text-left transition-colors text-sm"
                  :class="budget === opt.value ? 'border-accent bg-accent/5 text-accent' : 'border-dark-tertiary text-text-secondary'">
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Height -->
            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('guide.height_question') }}</label>
              <div class="space-y-2">
                <button v-for="opt in heightOptions" :key="opt.value"
                  @click="height = height === opt.value ? '' : opt.value"
                  class="w-full p-2.5 rounded-lg border text-left transition-colors text-sm"
                  :class="height === opt.value ? 'border-accent bg-accent/5 text-accent' : 'border-dark-tertiary text-text-secondary'">
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Range -->
            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('guide.range_question') }}</label>
              <div class="space-y-2">
                <button v-for="opt in rangeOptions" :key="opt.value"
                  @click="range = range === opt.value ? '' : opt.value"
                  class="w-full p-2.5 rounded-lg border text-left transition-colors text-sm"
                  :class="range === opt.value ? 'border-accent bg-accent/5 text-accent' : 'border-dark-tertiary text-text-secondary'">
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Clear -->
            <button v-if="hasFilters" @click="clearFilters" class="w-full text-center text-accent text-sm hover:underline">
              {{ $t('guide.clear_filters') }}
            </button>
          </div>
        </div>

        <!-- Results -->
        <div class="lg:col-span-3">
          <!-- Results count + sort -->
          <div class="flex items-center justify-between mb-6">
            <p class="text-text-secondary text-sm">
              {{ $t('guide.results_subtitle', { count: recommendations.length }) }}
            </p>
            <select v-model="sortBy" class="input-field w-auto text-sm py-2">
              <option value="price-asc">{{ $t('guide.sort_price_asc') }}</option>
              <option value="price-desc">{{ $t('guide.sort_price_desc') }}</option>
              <option value="range">{{ $t('guide.sort_range') }}</option>
              <option value="name">{{ $t('guide.sort_name') }}</option>
            </select>
          </div>

          <!-- Products grid -->
          <div v-if="recommendations.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <NuxtLink v-for="p in paginatedResults" :key="p._id" :to="localePath(`/produits/${p.slug?.current}`)">
              <ProductCard :product="p" />
            </NuxtLink>
          </div>

          <!-- No results -->
          <div v-else class="text-center py-16 card">
            <Icon name="ph:magnifying-glass" class="w-12 h-12 text-dark-tertiary mx-auto mb-4" />
            <p class="text-text-secondary mb-4">{{ $t('guide.no_results') }}</p>
            <button @click="clearFilters" class="btn-outline text-sm">{{ $t('guide.clear_filters') }}</button>
          </div>

          <!-- Load more -->
          <div v-if="recommendations.length > showCount" class="text-center mt-8">
            <button @click="showCount += 12" class="btn-outline">
              {{ $t('guide.load_more') }} ({{ recommendations.length - showCount }} {{ $t('guide.remaining') }})
            </button>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="text-center mt-16 card p-8">
        <h2 class="font-display text-xl font-semibold text-white mb-3">{{ $t('guide.need_help') }}</h2>
        <p class="text-text-secondary mb-6">{{ $t('guide.need_help_desc') }}</p>
        <div class="flex flex-wrap gap-3 justify-center">
          <NuxtLink :to="localePath('/comparatif')" class="btn-outline inline-flex items-center gap-2">
            <Icon name="ph:table" class="w-5 h-5" /> {{ $t('compare.title') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/contact')" class="btn-primary inline-flex items-center gap-2">
            <Icon name="ph:chat-circle" class="w-5 h-5" /> {{ $t('nav.contact') }}
          </NuxtLink>
        </div>
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
    _id, name, slug, price, shortDescription, specifications, category->{ _id, name, slug },
    color, colorHex, stock, "images": images[]{asset}
  }`
)

const usage = ref('')
const budget = ref('')
const height = ref('')
const range = ref('')
const sortBy = ref('price-asc')
const showCount = ref(12)

const hasFilters = computed(() => !!(usage.value || budget.value || height.value || range.value))

function clearFilters() {
  usage.value = ''
  budget.value = ''
  height.value = ''
  range.value = ''
}

const usageOptions = computed(() => [
  { value: 'urban', icon: 'ph:buildings', label: t('guide.urban') },
  { value: 'offroad', icon: 'ph:mountains', label: t('guide.offroad') },
  { value: 'foldable', icon: 'ph:suitcase-rolling', label: t('guide.foldable') },
  { value: 'lady', icon: 'ph:flower-lotus', label: t('guide.lady') },
])

const budgetOptions = computed(() => [
  { value: 'low', label: '< 1100€' },
  { value: 'mid', label: '1100€ — 1500€' },
  { value: 'high', label: '> 1500€' },
])

const heightOptions = computed(() => [
  { value: 'short', label: t('guide.height_short') },
  { value: 'medium', label: t('guide.height_medium') },
  { value: 'tall', label: t('guide.height_tall') },
])

const rangeOptions = computed(() => [
  { value: 'short', label: '30-50 km' },
  { value: 'medium', label: '50-70 km' },
  { value: 'long', label: '70+ km' },
])

// Extract numeric range from localizedString or string
function getRangeNum(specs: any): number {
  if (!specs?.range) return 0
  const val = typeof specs.range === 'object' ? (specs.range.fr || specs.range.en || '') : specs.range
  const match = String(val).match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
}

const recommendations = computed(() => {
  if (!allProducts.value?.length) return []
  let filtered = [...allProducts.value]

  // Usage filter — by category slug (language-independent)
  if (usage.value) {
    const slugMap: Record<string, string[]> = {
      urban: ['urbain', 'urban', 'city', 'ville'],
      offroad: ['terrain', 'offroad', 'cross', 'adventure'],
      foldable: ['pliable', 'foldable', 'folding', 'compact'],
      lady: ['femme', 'lady', 'dame', 'women', 'feminin'],
    }
    const slugs = slugMap[usage.value] || []
    const matched = filtered.filter(p => {
      const catSlug = (p.category?.slug?.current || '').toLowerCase()
      const catNameFr = (p.category?.name?.fr || '').toLowerCase()
      const catNameEn = (p.category?.name?.en || '').toLowerCase()
      return slugs.some(s => catSlug.includes(s) || catNameFr.includes(s) || catNameEn.includes(s))
    })
    if (matched.length) filtered = matched
  }

  // Budget filter
  if (budget.value === 'low') filtered = filtered.filter(p => p.price < 1100)
  else if (budget.value === 'mid') filtered = filtered.filter(p => p.price >= 1100 && p.price <= 1500)
  else if (budget.value === 'high') filtered = filtered.filter(p => p.price > 1500)

  // Height filter — by tire size
  if (height.value === 'short') {
    const m = filtered.filter(p => p.specifications?.tireSize?.includes('16'))
    if (m.length) filtered = m
  } else if (height.value === 'tall') {
    const m = filtered.filter(p => {
      const ts = p.specifications?.tireSize || ''
      return ts.includes('24') || ts.includes('26') || ts.includes('27')
    })
    if (m.length) filtered = m
  }

  // Range filter
  if (range.value === 'short') filtered = filtered.filter(p => getRangeNum(p.specifications) <= 50 || getRangeNum(p.specifications) === 0)
  else if (range.value === 'medium') filtered = filtered.filter(p => { const r = getRangeNum(p.specifications); return r >= 40 && r <= 70 })
  else if (range.value === 'long') filtered = filtered.filter(p => getRangeNum(p.specifications) >= 60)

  // Sort
  if (sortBy.value === 'price-asc') filtered.sort((a, b) => a.price - b.price)
  else if (sortBy.value === 'price-desc') filtered.sort((a, b) => b.price - a.price)
  else if (sortBy.value === 'range') filtered.sort((a, b) => getRangeNum(b.specifications) - getRangeNum(a.specifications))
  else if (sortBy.value === 'name') filtered.sort((a, b) => (l(a.name) || '').localeCompare(l(b.name) || ''))

  return filtered
})

const paginatedResults = computed(() => recommendations.value.slice(0, showCount.value))

// Reset pagination when filters change
watch([usage, budget, height, range, sortBy], () => { showCount.value = 12 })
</script>
