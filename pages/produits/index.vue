<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Dynamic Header -->
      <div class="text-center mb-8">
        <h1 class="section-title mb-3">{{ pageTitle }}</h1>
        <p class="text-text-secondary text-lg">{{ pageSubtitle }}</p>
      </div>

      <!-- Product type tabs -->
      <div class="flex flex-wrap gap-2 justify-center mb-6">
        <button @click="setType('')" class="px-4 py-2 rounded-full text-sm font-medium transition-colors" :class="!selectedType ? 'bg-accent text-primary' : 'bg-dark-secondary text-text-secondary hover:text-white'">
          {{ $t('nav.all_products') }} <span class="opacity-60 ml-1">({{ products?.length || 0 }})</span>
        </button>
        <button v-for="type in typeFilters" :key="type.value" @click="setType(type.value)" class="px-4 py-2 rounded-full text-sm font-medium transition-colors" :class="selectedType === type.value ? 'bg-accent text-primary' : 'bg-dark-secondary text-text-secondary hover:text-white'">
          {{ type.icon }} {{ type.label }} <span class="opacity-60 ml-1">({{ typeCounts[type.value] || 0 }})</span>
        </button>
      </div>

      <!-- Search bar -->
      <div class="max-w-md mx-auto mb-8">
        <div class="relative">
          <Icon name="ph:magnifying-glass" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input v-model="searchQuery" type="text" :placeholder="$t('products.search')" class="input-field pl-12 py-3 text-sm w-full rounded-full" />
          <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white">
            <Icon name="ph:x" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Mobile filter toggle -->
        <button @click="showFilters = !showFilters" class="lg:hidden btn-secondary flex items-center justify-center gap-2">
          <Icon name="ph:funnel" class="w-5 h-5" />
          {{ $t('products.filter') }} {{ activeFilterCount > 0 ? `(${activeFilterCount})` : '' }}
        </button>

        <!-- Sidebar Filters -->
        <aside :class="showFilters ? 'block' : 'hidden lg:block'" class="lg:w-56 shrink-0">
          <div class="card p-5 space-y-5 sticky top-24">
            <div class="flex items-center justify-between">
              <h3 class="font-display font-semibold text-white text-sm flex items-center gap-2">
                <Icon name="ph:funnel" class="w-4 h-4" /> {{ $t('products.filter') }}
              </h3>
              <button v-if="activeFilterCount > 0" @click="clearFilters" class="text-accent text-xs hover:underline">{{ $t('products.clear_filters') }}</button>
            </div>

            <!-- Brand -->
            <div>
              <label class="text-text-secondary text-xs font-medium block mb-2">{{ $t('products.brand') }}</label>
              <select v-model="selectedBrand" class="input-field text-sm py-2">
                <option value="">{{ $t('products.all_brands') }}</option>
                <option v-for="b in availableBrands" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <!-- Price range -->
            <div>
              <label class="text-text-secondary text-xs font-medium block mb-2">{{ $t('products.price_range') }}</label>
              <select v-model="selectedPrice" class="input-field text-sm py-2">
                <option value="">{{ $t('products.all_prices') }}</option>
                <option value="0-50">< 50€</option>
                <option value="50-200">50€ — 200€</option>
                <option value="200-800">200€ — 800€</option>
                <option value="800-1500">800€ — 1 500€</option>
                <option value="1500+">> 1 500€</option>
              </select>
            </div>

            <!-- Bike-specific: tire + range -->
            <template v-if="!selectedType || selectedType === 'bike'">
              <div>
                <label class="text-text-secondary text-xs font-medium block mb-2">{{ $t('products.tire_size') }}</label>
                <select v-model="selectedTire" class="input-field text-sm py-2">
                  <option value="">{{ $t('products.all_sizes') }}</option>
                  <option v-for="size in tireSizes" :key="size" :value="size">{{ size }}</option>
                </select>
              </div>
              <div>
                <label class="text-text-secondary text-xs font-medium block mb-2">{{ $t('products.range_km') }}</label>
                <select v-model="selectedRange" class="input-field text-sm py-2">
                  <option value="">{{ $t('products.all_sizes') }}</option>
                  <option value="30-50">30-50 km</option>
                  <option value="50-70">50-70 km</option>
                  <option value="70+">70+ km</option>
                </select>
              </div>
            </template>
          </div>
        </aside>

        <!-- Products -->
        <div class="flex-1">
          <!-- Toolbar -->
          <div class="flex items-center justify-between mb-5">
            <p class="text-text-secondary text-sm">
              <span class="text-white font-medium">{{ paginatedProducts.length }}</span> / {{ filteredProducts.length }} {{ $t('products.results') }}
            </p>
            <div class="flex items-center gap-3">
              <select v-model="sortBy" class="input-field text-xs py-1.5 w-auto">
                <option value="sortOrder">{{ $t('products.sort_newest') }}</option>
                <option value="name">{{ $t('products.sort_name') }}</option>
                <option value="price_asc">{{ $t('products.sort_price_asc') }}</option>
                <option value="price_desc">{{ $t('products.sort_price_desc') }}</option>
              </select>
              <div class="hidden md:flex gap-1">
                <button @click="viewMode = 'grid'" class="p-1.5 rounded" :class="viewMode === 'grid' ? 'text-accent bg-dark-secondary' : 'text-text-secondary'">
                  <Icon name="ph:squares-four" class="w-4 h-4" />
                </button>
                <button @click="viewMode = 'list'" class="p-1.5 rounded" :class="viewMode === 'list' ? 'text-accent bg-dark-secondary' : 'text-text-secondary'">
                  <Icon name="ph:list" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="!products" class="text-center py-16">
            <Icon name="ph:spinner" class="w-8 h-8 text-accent animate-spin mx-auto" />
          </div>

          <!-- Grid -->
          <div v-else-if="filteredProducts.length" :class="viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-3'">
            <NuxtLink v-for="product in paginatedProducts" :key="product._id" :to="localePath(`/produits/${product.slug?.current}`)">
              <ProductCard :product="product" :list-mode="viewMode === 'list'" />
            </NuxtLink>
          </div>

          <!-- No results -->
          <div v-else class="text-center py-16 card">
            <Icon name="ph:magnifying-glass" class="w-12 h-12 text-dark-tertiary mx-auto mb-4" />
            <p class="text-text-secondary mb-4">{{ $t('products.no_results') }}</p>
            <button @click="clearAll" class="btn-outline text-sm">{{ $t('products.clear_filters') }}</button>
          </div>

          <!-- Load more -->
          <div v-if="filteredProducts.length > showCount" class="text-center mt-8">
            <button @click="showCount += pageSize" class="btn-outline px-8">
              {{ $t('products.load_more') }} ({{ filteredProducts.length - showCount }} {{ $t('products.remaining') }})
            </button>
          </div>

          <!-- Back to top -->
          <div v-if="paginatedProducts.length > 12" class="text-center mt-6">
            <button @click="window.scrollTo({ top: 0, behavior: 'smooth' })" class="text-text-secondary text-xs hover:text-accent flex items-center justify-center gap-1 mx-auto">
              <Icon name="ph:arrow-up" class="w-3 h-3" /> {{ $t('products.back_to_top') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const route = useRoute()

useHead({
  title: `${t('products.title')} — Vitesse Eco`,
  meta: [
    { name: 'description', content: `${t('products.subtitle')} — Vitesse Eco. ${t('trust.fast_delivery')}.` },
    { property: 'og:title', content: `${t('products.title')} — Vitesse Eco` },
    { property: 'og:description', content: t('products.subtitle') },
    { property: 'og:image', content: 'https://vitesse-eco.fr/poster.webp' },
  ],
})

// State
const selectedType = ref((route.query.type as string) || '')
const selectedBrand = ref('')
const selectedPrice = ref('')
const selectedTire = ref('')
const selectedRange = ref('')
const searchQuery = ref('')
const sortBy = ref('sortOrder')
const viewMode = ref<'grid' | 'list'>('grid')
const showFilters = ref(false)
const pageSize = 24
const showCount = ref(pageSize)

watch(() => route.query.type, (val) => { selectedType.value = (val as string) || '' })

// Reset pagination on any filter change
watch([selectedType, selectedBrand, selectedPrice, selectedTire, selectedRange, searchQuery, sortBy], () => {
  showCount.value = pageSize
})

function setType(type: string) {
  selectedType.value = type
  selectedBrand.value = ''
  selectedTire.value = ''
  selectedRange.value = ''
}

function clearFilters() {
  selectedBrand.value = ''
  selectedPrice.value = ''
  selectedTire.value = ''
  selectedRange.value = ''
}

function clearAll() {
  clearFilters()
  selectedType.value = ''
  searchQuery.value = ''
}

const activeFilterCount = computed(() => {
  let count = 0
  if (selectedBrand.value) count++
  if (selectedPrice.value) count++
  if (selectedTire.value) count++
  if (selectedRange.value) count++
  return count
})

// Dynamic titles
const pageTitle = computed(() => {
  const titles: Record<string, string> = { bike: t('nav.type_bikes'), accessory: t('nav.type_accessories'), spare_part: t('nav.type_parts'), kids_car: t('nav.type_kids') }
  return titles[selectedType.value] || t('products.title')
})
const pageSubtitle = computed(() => {
  const subs: Record<string, string> = { bike: t('nav.type_bikes_desc'), accessory: t('nav.type_accessories_desc'), spare_part: t('nav.type_parts_desc'), kids_car: t('nav.type_kids_desc') }
  return subs[selectedType.value] || t('products.subtitle')
})

const typeFilters = computed(() => [
  { value: 'bike', icon: '🚲', label: t('nav.type_bikes') },
  { value: 'spare_part', icon: '🔧', label: t('nav.type_parts') },
  { value: 'accessory', icon: '🎒', label: t('nav.type_accessories') },
  { value: 'kids_car', icon: '🧸', label: t('nav.type_kids') },
])

const tireSizes = ['16"', '20"', '24"', '70/100-17"']

// Data
const prodQuery = groq`*[_type == "product" && isAvailable == true] | order(sortOrder asc) {
  _id, name, slug, shortDescription, price, compareAtPrice, isOnSale, isNew, isFeatured, sortOrder,
  productType, specifications, category->{ _id }, brand->{ name },
  variants[]{ _key, colorHex, colorName, stock, "images": images[]{asset} }
}`
const { data: products } = useSanityFetch('all-products', prodQuery)

// Type counts
const typeCounts = computed(() => {
  if (!products.value) return {}
  const counts: Record<string, number> = {}
  products.value.forEach((p: any) => { counts[p.productType] = (counts[p.productType] || 0) + 1 })
  return counts
})

// Available brands (dynamic based on selected type)
const availableBrands = computed(() => {
  if (!products.value) return []
  let list = products.value as any[]
  if (selectedType.value) list = list.filter(p => p.productType === selectedType.value)
  const brands = [...new Set(list.map(p => p.brand?.name).filter(Boolean))].sort()
  return brands
})

// Helper for range parsing
function getRangeNum(specs: any): number {
  if (!specs?.range) return 0
  const val = typeof specs.range === 'object' ? (specs.range.fr || specs.range.en || '') : specs.range
  const match = String(val).match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
}

// Filter + sort
const filteredProducts = computed(() => {
  if (!products.value) return []
  let result = [...products.value] as any[]

  // Type
  if (selectedType.value) result = result.filter(p => p.productType === selectedType.value)

  // Search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p => {
      const name = (l(p.name) || '').toLowerCase()
      const short = (l(p.shortDescription) || '').toLowerCase()
      const brand = (p.brand?.name || '').toLowerCase()
      const sku = (p.variants || []).map((v: any) => v.sku || '').join(' ').toLowerCase()
      return name.includes(q) || short.includes(q) || brand.includes(q) || sku.includes(q)
    })
  }

  // Brand
  if (selectedBrand.value) result = result.filter(p => p.brand?.name === selectedBrand.value)

  // Price
  if (selectedPrice.value) {
    const [min, max] = selectedPrice.value.split('-').map(s => s.replace('+', ''))
    const minP = parseInt(min) || 0
    const maxP = max ? parseInt(max) : Infinity
    result = result.filter(p => p.price >= minP && p.price <= maxP)
  }

  // Tire
  if (selectedTire.value) result = result.filter(p => p.specifications?.tireSize === selectedTire.value)

  // Range
  if (selectedRange.value) {
    result = result.filter(p => {
      const r = getRangeNum(p.specifications)
      if (!r) return false
      if (selectedRange.value === '30-50') return r >= 30 && r < 50
      if (selectedRange.value === '50-70') return r >= 50 && r < 70
      if (selectedRange.value === '70+') return r >= 70
      return true
    })
  }

  // Sort
  if (sortBy.value === 'name') result.sort((a, b) => (l(a.name) || '').localeCompare(l(b.name) || ''))
  else if (sortBy.value === 'price_asc') result.sort((a, b) => (a.price || 0) - (b.price || 0))
  else if (sortBy.value === 'price_desc') result.sort((a, b) => (b.price || 0) - (a.price || 0))

  return result
})

const paginatedProducts = computed(() => filteredProducts.value.slice(0, showCount.value))
</script>
