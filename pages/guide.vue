<template>
  <div class="relative">
    <!-- Hero band — premium framing consistent with home -->
    <section class="relative pt-12 md:pt-20 pb-10 md:pb-14 overflow-hidden">
      <div class="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div class="container-custom relative">
        <div class="text-center max-w-3xl mx-auto">
          <span class="inline-flex items-center gap-2 px-3 py-1.5 mb-5 bg-accent/10 border border-accent/20 rounded-full backdrop-blur-sm">
            <Icon name="ph:compass" class="w-3.5 h-3.5 text-accent" />
            <span class="text-accent text-xs font-medium tracking-wider uppercase">
              {{ $t('guide.filters') }}
            </span>
          </span>
          <h1 class="font-display text-4xl md:text-6xl font-black text-white leading-[1.1] mb-4 tracking-tight">
            {{ $t('guide.title') }}
          </h1>
          <p class="text-text-secondary text-base md:text-xl leading-relaxed">
            {{ $t('guide.subtitle') }}
          </p>
        </div>
      </div>
      <div class="absolute inset-x-0 bottom-0 divider-accent" />
    </section>

    <!-- Body -->
    <section class="py-10 md:py-14">
      <div class="container-custom">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <!-- Filters sidebar (premium card) -->
          <aside class="lg:col-span-1">
            <div class="card card-premium p-6 sticky top-24 space-y-7 shadow-soft-lg">
              <div class="flex items-center justify-between">
                <h2 class="font-display font-bold text-white text-lg flex items-center gap-2">
                  <Icon name="ph:funnel" class="w-5 h-5 text-accent" />
                  {{ $t('guide.filters') }}
                </h2>
                <button v-if="hasFilters" @click="clearFilters" class="text-accent text-xs hover:underline focus-ring">
                  {{ $t('guide.clear_filters') }}
                </button>
              </div>

              <!-- Usage -->
              <div>
                <label class="text-text-secondary text-xs font-bold uppercase tracking-wider block mb-3">{{ $t('guide.usage_question') }}</label>
                <div class="space-y-2">
                  <button v-for="opt in usageOptions" :key="opt.value"
                    @click="usage = usage === opt.value ? '' : opt.value"
                    :aria-pressed="usage === opt.value"
                    class="w-full p-3 rounded-lg border-2 text-start transition-all duration-fast ease-soft flex items-center gap-3 text-sm focus-ring"
                    :class="usage === opt.value ? 'border-accent bg-accent/10 text-accent shadow-[0_2px_12px_-4px_rgba(74,222,128,0.4)]' : 'border-dark-tertiary text-text-secondary hover:border-accent/40 hover:bg-dark-tertiary/30'">
                    <Icon :name="opt.icon" class="w-5 h-5 shrink-0" />
                    <span class="font-medium flex-1">{{ opt.label }}</span>
                    <Icon v-if="usage === opt.value" name="ph:check-circle-fill" class="w-4 h-4 text-accent" />
                  </button>
                </div>
              </div>

              <!-- Budget -->
              <div>
                <label class="text-text-secondary text-xs font-bold uppercase tracking-wider block mb-3">{{ $t('guide.budget') }}</label>
                <div class="space-y-2">
                  <button v-for="opt in budgetOptions" :key="opt.value"
                    @click="budget = budget === opt.value ? '' : opt.value"
                    :aria-pressed="budget === opt.value"
                    class="w-full p-2.5 rounded-lg border-2 text-start transition-all duration-fast ease-soft text-sm font-medium focus-ring"
                    :class="budget === opt.value ? 'border-accent bg-accent/10 text-accent' : 'border-dark-tertiary text-text-secondary hover:border-accent/40'">
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <!-- Height -->
              <div>
                <label class="text-text-secondary text-xs font-bold uppercase tracking-wider block mb-3">{{ $t('guide.height_question') }}</label>
                <div class="space-y-2">
                  <button v-for="opt in heightOptions" :key="opt.value"
                    @click="height = height === opt.value ? '' : opt.value"
                    :aria-pressed="height === opt.value"
                    class="w-full p-2.5 rounded-lg border-2 text-start transition-all duration-fast ease-soft text-sm font-medium focus-ring"
                    :class="height === opt.value ? 'border-accent bg-accent/10 text-accent' : 'border-dark-tertiary text-text-secondary hover:border-accent/40'">
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <!-- Range -->
              <div>
                <label class="text-text-secondary text-xs font-bold uppercase tracking-wider block mb-3">{{ $t('guide.range_question') }}</label>
                <div class="space-y-2">
                  <button v-for="opt in rangeOptions" :key="opt.value"
                    @click="range = range === opt.value ? '' : opt.value"
                    :aria-pressed="range === opt.value"
                    class="w-full p-2.5 rounded-lg border-2 text-start transition-all duration-fast ease-soft text-sm font-medium focus-ring"
                    :class="range === opt.value ? 'border-accent bg-accent/10 text-accent' : 'border-dark-tertiary text-text-secondary hover:border-accent/40'">
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <!-- Results -->
          <div class="lg:col-span-3">
            <!-- Results header -->
            <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-dark-tertiary/50">
              <p class="text-text-secondary text-sm">
                <span class="text-white font-bold">{{ recommendations.length }}</span>
                {{ ' ' + $t('guide.results_subtitle', { count: recommendations.length }).replace(String(recommendations.length), '').trim() }}
              </p>
              <div class="flex items-center gap-2">
                <Icon name="ph:sort-ascending" class="w-4 h-4 text-text-secondary" />
                <select v-model="sortBy" class="input-field w-auto text-sm py-2 focus-ring">
                  <option value="price-asc">{{ $t('guide.sort_price_asc') }}</option>
                  <option value="price-desc">{{ $t('guide.sort_price_desc') }}</option>
                  <option value="range">{{ $t('guide.sort_range') }}</option>
                  <option value="name">{{ $t('guide.sort_name') }}</option>
                </select>
              </div>
            </div>

            <!-- Products grid -->
            <div v-if="recommendations.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <NuxtLink v-for="p in paginatedResults" :key="p._id" :to="localePath(`/produits/${p.slug?.current}`)" class="block focus-ring rounded-xl">
                <ProductCard :product="p" />
              </NuxtLink>
            </div>

            <!-- No results -->
            <EmptyState
              v-else
              icon="ph:magnifying-glass"
              :message="$t('guide.no_results')"
              :cta-label="$t('guide.clear_filters')"
              cta-icon="ph:x"
              :cta-action="clearFilters"
            />

            <!-- Load more -->
            <div v-if="recommendations.length > showCount" class="text-center mt-10">
              <button @click="showCount += 12" class="btn-outline focus-ring">
                {{ $t('guide.load_more') }} ({{ recommendations.length - showCount }} {{ $t('guide.remaining') }})
              </button>
            </div>
          </div>
        </div>

        <!-- CTA — premium framed -->
        <div class="mt-20 relative">
          <div class="absolute inset-0 bg-accent/5 blur-3xl rounded-full pointer-events-none" />
          <div class="card-premium card p-10 md:p-14 text-center max-w-3xl mx-auto relative">
            <Icon name="ph:headset" class="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 class="font-display text-2xl md:text-3xl font-bold text-white mb-3">{{ $t('guide.need_help') }}</h2>
            <p class="text-text-secondary mb-8 max-w-xl mx-auto">{{ $t('guide.need_help_desc') }}</p>
            <div class="flex flex-wrap gap-3 justify-center">
              <NuxtLink :to="localePath('/comparatif')" class="btn-outline inline-flex items-center gap-2 focus-ring">
                <Icon name="ph:table" class="w-5 h-5" /> {{ $t('compare.title') }}
              </NuxtLink>
              <NuxtLink :to="localePath('/contact')" class="btn-primary inline-flex items-center gap-2 glow-accent focus-ring">
                <Icon name="ph:chat-circle" class="w-5 h-5" /> {{ $t('nav.contact') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>
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

// Guide is a bike-buying recommender — restrict to bikes IN STOCK so we never
// recommend out-of-stock items or accessories/parts.
const { data: allProducts } = useSanityFetch(
  'all-products-guide-v2',
  groq`*[_type == "product" && isAvailable == true && productType == "bike" && stock > 0] | order(sortOrder asc) {
    _id, name, slug, price, shortDescription, specifications, productType,
    category->{ _id, name, slug },
    color, colorHex, stock, isFeatured,
    brand->{ name },
    "images": images[]{asset}
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

// Extract numeric range from localizedString or string. Use the upper bound
// when the spec is a range like "40-60 km", since that's the headline value.
function getRangeNum(specs: any): number {
  if (!specs?.range) return 0
  const val = typeof specs.range === 'object' ? (specs.range.fr || specs.range.en || '') : specs.range
  const matches = String(val).match(/\d+/g)
  if (!matches?.length) return 0
  // Take the highest number if it's a range — better signal of capability
  return Math.max(...matches.map((s) => parseInt(s, 10)))
}

// Smart filters — derive thresholds from the actual catalog so they always
// produce useful buckets even after price/range data shifts.
const budgetOptions = computed(() => {
  const prices = (allProducts.value || []).map((p: any) => p.price).filter((n: any) => typeof n === 'number' && n > 0)
  if (prices.length < 2) return []
  const sorted = [...prices].sort((a, b) => a - b)
  // tertile boundaries — round to nearest 50€ for clean labels
  const round50 = (n: number) => Math.round(n / 50) * 50
  const t1 = round50(sorted[Math.floor(sorted.length / 3)])
  const t2 = round50(sorted[Math.floor((2 * sorted.length) / 3)])
  // ensure t1 < t2 by at least one bucket-width
  const lower = Math.min(t1, t2 - 50)
  const upper = Math.max(t2, lower + 50)
  return [
    { value: 'low',  label: `< ${lower}€` },
    { value: 'mid',  label: `${lower}€ — ${upper}€` },
    { value: 'high', label: `> ${upper}€` },
  ]
})

const heightOptions = computed(() => [
  { value: 'short', label: t('guide.height_short') },
  { value: 'medium', label: t('guide.height_medium') },
  { value: 'tall', label: t('guide.height_tall') },
])

const rangeOptions = computed(() => {
  const ranges = (allProducts.value || [])
    .map((p: any) => getRangeNum(p.specifications))
    .filter((n: number) => n > 0)
  if (ranges.length < 2) return []
  const sorted = [...ranges].sort((a, b) => a - b)
  const round10 = (n: number) => Math.round(n / 10) * 10
  const t1 = round10(sorted[Math.floor(sorted.length / 3)])
  const t2 = round10(sorted[Math.floor((2 * sorted.length) / 3)])
  const lower = Math.min(t1, t2 - 10)
  const upper = Math.max(t2, lower + 10)
  return [
    { value: 'short',  label: `< ${lower} km` },
    { value: 'medium', label: `${lower}-${upper} km` },
    { value: 'long',   label: `${upper}+ km` },
  ]
})

// Map the chosen budget label back to numeric bounds (so the filter logic
// doesn't depend on hardcoded strings any more).
const budgetBounds = computed(() => {
  const buckets = budgetOptions.value
  if (!buckets.length) return null
  const [, mid] = buckets
  const nums = mid.label.match(/\d+/g)?.map(Number) ?? []
  if (nums.length < 2) return null
  return { lower: nums[0], upper: nums[1] }
})

const rangeBounds = computed(() => {
  const buckets = rangeOptions.value
  if (!buckets.length) return null
  const [, mid] = buckets
  const nums = mid.label.match(/\d+/g)?.map(Number) ?? []
  if (nums.length < 2) return null
  return { lower: nums[0], upper: nums[1] }
})

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

  // Budget filter — uses dynamic thresholds derived from the catalog so we
  // never compare against stale hardcoded numbers.
  if (budget.value && budgetBounds.value) {
    const { lower, upper } = budgetBounds.value
    if (budget.value === 'low') filtered = filtered.filter(p => p.price < lower)
    else if (budget.value === 'mid') filtered = filtered.filter(p => p.price >= lower && p.price <= upper)
    else if (budget.value === 'high') filtered = filtered.filter(p => p.price > upper)
  }

  // Height filter — by leading numeric tire size (handles any size: 12", 14", 16", 17", 20", 24"...)
  if (height.value) {
    const tireNum = (p: any) => parseFloat(p.specifications?.tireSize || '0') || 0
    let m: any[] = []
    if (height.value === 'short') m = filtered.filter(p => { const n = tireNum(p); return n > 0 && n < 18 })
    else if (height.value === 'medium') m = filtered.filter(p => { const n = tireNum(p); return n >= 18 && n <= 22 })
    else if (height.value === 'tall') m = filtered.filter(p => tireNum(p) > 22)
    if (m.length) filtered = m
  }

  // Range filter — uses dynamic thresholds.
  if (range.value && rangeBounds.value) {
    const { lower, upper } = rangeBounds.value
    if (range.value === 'short') filtered = filtered.filter(p => {
      const r = getRangeNum(p.specifications); return r > 0 && r < lower
    })
    else if (range.value === 'medium') filtered = filtered.filter(p => {
      const r = getRangeNum(p.specifications); return r >= lower && r <= upper
    })
    else if (range.value === 'long') filtered = filtered.filter(p => getRangeNum(p.specifications) > upper)
  }

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
