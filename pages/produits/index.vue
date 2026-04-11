<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <div class="text-center mb-8">
        <h1 class="section-title mb-3">{{ pageTitle }}</h1>
        <p class="text-text-secondary text-lg">{{ pageSubtitle }}</p>
      </div>

      <!-- Type tabs -->
      <div class="flex flex-wrap gap-2 justify-center mb-6">
        <button @click="setType('')" class="px-4 py-2 rounded-full text-sm font-medium transition-colors" :class="!selectedType ? 'bg-accent text-primary' : 'bg-dark-secondary text-text-secondary hover:text-white'">
          {{ $t('nav.all_products') }} ({{ products?.length || 0 }})
        </button>
        <button v-for="t in typeFilters" :key="t.value" @click="setType(t.value)" class="px-4 py-2 rounded-full text-sm font-medium transition-colors" :class="selectedType === t.value ? 'bg-accent text-primary' : 'bg-dark-secondary text-text-secondary hover:text-white'">
          {{ t.icon }} {{ t.label }} ({{ typeCounts[t.value] || 0 }})
        </button>
      </div>

      <!-- Search -->
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

        <!-- Sidebar -->
        <aside :class="showFilters ? 'block' : 'hidden lg:block'" class="lg:w-56 shrink-0">
          <div class="card p-5 space-y-5 sticky top-24">
            <div class="flex items-center justify-between">
              <h3 class="font-display font-semibold text-white text-sm">{{ $t('products.filter') }}</h3>
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

            <!-- Color -->
            <div>
              <label class="text-text-secondary text-xs font-medium block mb-2">{{ $t('compare.colors') }}</label>
              <div class="flex flex-wrap gap-2">
                <button v-for="c in availableColors" :key="c.hex" @click="selectedColor = selectedColor === c.hex ? '' : c.hex"
                  class="w-7 h-7 rounded-full border-2 transition-all" :class="selectedColor === c.hex ? 'border-accent scale-110' : 'border-dark-tertiary'"
                  :style="{ backgroundColor: c.hex }" :title="c.name" />
              </div>
            </div>

            <!-- Price -->
            <div>
              <label class="text-text-secondary text-xs font-medium block mb-2">{{ $t('products.price_range') }}</label>
              <select v-model="selectedPrice" class="input-field text-sm py-2">
                <option value="">{{ $t('products.all_prices') }}</option>
                <option value="0-50">&lt; 50€</option>
                <option value="50-200">50 — 200€</option>
                <option value="200-800">200 — 800€</option>
                <option value="800-1500">800 — 1 500€</option>
                <option value="1500+">1 500€ +</option>
              </select>
            </div>

            <!-- Bike-specific -->
            <template v-if="!selectedType || selectedType === 'bike'">
              <div>
                <label class="text-text-secondary text-xs font-medium block mb-2">{{ $t('products.tire_size') }}</label>
                <select v-model="selectedTire" class="input-field text-sm py-2">
                  <option value="">{{ $t('products.all_sizes') }}</option>
                  <option v-for="s in tireSizes" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
            </template>
          </div>
        </aside>

        <!-- Products -->
        <div class="flex-1">
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

          <!-- Loading Skeleton -->
          <div v-if="!products" class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div v-for="i in 8" :key="i" class="card animate-pulse">
              <div class="aspect-[4/3] bg-dark-tertiary" />
              <div class="p-4 space-y-3">
                <div class="h-3 bg-dark-tertiary rounded w-1/3" />
                <div class="h-4 bg-dark-tertiary rounded w-3/4" />
                <div class="h-5 bg-dark-tertiary rounded w-1/4" />
              </div>
            </div>
          </div>

          <div v-else-if="filteredProducts.length" :class="viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-3'">
            <NuxtLink v-for="product in paginatedProducts" :key="product._id" :to="localePath(`/produits/${product.slug?.current}`)">
              <ProductCard :product="product" :list-mode="viewMode === 'list'" />
            </NuxtLink>
          </div>

          <div v-else class="text-center py-16 card">
            <Icon name="ph:magnifying-glass" class="w-12 h-12 text-dark-tertiary mx-auto mb-4" />
            <p class="text-text-secondary mb-4">{{ $t('products.no_results') }}</p>
            <button @click="clearAll" class="btn-outline text-sm">{{ $t('products.clear_filters') }}</button>
          </div>

          <div v-if="filteredProducts.length > showCount" class="text-center mt-8">
            <button @click="showCount += pageSize" class="btn-outline px-8">
              {{ $t('products.load_more') }} ({{ filteredProducts.length - showCount }} {{ $t('products.remaining') }})
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
  title: computed(() => `${pageTitle.value} — Vitesse Eco`),
  meta: [
    { name: 'description', content: computed(() => `${pageSubtitle.value} — Vitesse Eco`) },
  ],
})

const router = useRouter()

// URL-synced filter state
const selectedType = ref((route.query.type as string) || '')
const selectedBrand = ref((route.query.brand as string) || '')
const selectedColor = ref((route.query.color as string) || '')
const selectedPrice = ref((route.query.price as string) || '')
const selectedTire = ref((route.query.tire as string) || '')
const searchQuery = ref((route.query.q as string) || '')
const sortBy = ref((route.query.sort as string) || 'sortOrder')
const viewMode = ref<'grid' | 'list'>('grid')
const showFilters = ref(false)
const pageSize = 24
const showCount = ref(pageSize)

// Debounced search
let searchTimer: ReturnType<typeof setTimeout>
const debouncedSearch = ref(searchQuery.value)
watch(searchQuery, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = val }, 300)
})

// Sync filters → URL
function updateUrl() {
  const query: Record<string, string> = {}
  if (selectedType.value) query.type = selectedType.value
  if (selectedBrand.value) query.brand = selectedBrand.value
  if (selectedColor.value) query.color = selectedColor.value
  if (selectedPrice.value) query.price = selectedPrice.value
  if (selectedTire.value) query.tire = selectedTire.value
  if (searchQuery.value) query.q = searchQuery.value
  if (sortBy.value && sortBy.value !== 'sortOrder') query.sort = sortBy.value
  router.replace({ query })
}

watch([selectedType, selectedBrand, selectedColor, selectedPrice, selectedTire, sortBy], () => { showCount.value = pageSize; updateUrl() })
watch(searchQuery, () => { showCount.value = pageSize; updateUrl() })

// Restore from URL on navigation
watch(() => route.query, (q) => {
  selectedType.value = (q.type as string) || ''
  selectedBrand.value = (q.brand as string) || ''
  selectedColor.value = (q.color as string) || ''
  selectedPrice.value = (q.price as string) || ''
  selectedTire.value = (q.tire as string) || ''
  searchQuery.value = (q.q as string) || ''
  debouncedSearch.value = (q.q as string) || ''
  sortBy.value = (q.sort as string) || 'sortOrder'
})

function setType(type: string) { selectedType.value = type; selectedBrand.value = ''; selectedColor.value = ''; selectedTire.value = '' }
function clearFilters() { selectedBrand.value = ''; selectedColor.value = ''; selectedPrice.value = ''; selectedTire.value = '' }
function clearAll() { clearFilters(); selectedType.value = ''; searchQuery.value = '' }

const activeFilterCount = computed(() => [selectedBrand.value, selectedColor.value, selectedPrice.value, selectedTire.value].filter(Boolean).length)

const pageTitle = computed(() => {
  const m: Record<string, string> = { bike: t('nav.type_bikes'), accessory: t('nav.type_accessories'), spare_part: t('nav.type_parts'), kids_car: t('nav.type_kids') }
  return m[selectedType.value] || t('products.title')
})
const pageSubtitle = computed(() => {
  const m: Record<string, string> = { bike: t('nav.type_bikes_desc'), accessory: t('nav.type_accessories_desc'), spare_part: t('nav.type_parts_desc'), kids_car: t('nav.type_kids_desc') }
  return m[selectedType.value] || t('products.subtitle')
})

const typeFilters = computed(() => [
  { value: 'bike', icon: '🚲', label: t('nav.type_bikes') },
  { value: 'spare_part', icon: '🔧', label: t('nav.type_parts') },
  { value: 'accessory', icon: '🎒', label: t('nav.type_accessories') },
  { value: 'kids_car', icon: '🧸', label: t('nav.type_kids') },
])

const tireSizes = ['16"', '20"', '24"', '70/100-17"']

const prodQuery = groq`*[_type == "product" && isAvailable == true] | order(sortOrder asc) {
  _id, name, slug, shortDescription, price, compareAtPrice, isOnSale, isNew, isFeatured, sortOrder,
  productType, color, colorHex, stock, modelFamily, specifications,
  brand->{ name }, "images": images[]{asset}
}`
const { data: products } = useSanityFetch('all-products-v2', prodQuery)

const typeCounts = computed(() => {
  if (!products.value) return {}
  const c: Record<string, number> = {}
  products.value.forEach((p: any) => { c[p.productType] = (c[p.productType] || 0) + 1 })
  return c
})

const availableBrands = computed(() => {
  if (!products.value) return []
  let list = products.value as any[]
  if (selectedType.value) list = list.filter(p => p.productType === selectedType.value)
  return [...new Set(list.map(p => p.brand?.name).filter(Boolean))].sort()
})

const availableColors = computed(() => {
  if (!products.value) return []
  let list = products.value as any[]
  if (selectedType.value) list = list.filter(p => p.productType === selectedType.value)
  const colorMap = new Map<string, string>()
  list.forEach(p => { if (p.colorHex) colorMap.set(p.colorHex, l(p.color) || p.colorHex) })
  return [...colorMap.entries()].map(([hex, name]) => ({ hex, name })).slice(0, 12)
})

const filteredProducts = computed(() => {
  if (!products.value) return []
  let result = [...products.value] as any[]

  if (selectedType.value) result = result.filter(p => p.productType === selectedType.value)

  if (debouncedSearch.value.trim()) {
    const q = debouncedSearch.value.toLowerCase()
    result = result.filter(p => {
      const name = (l(p.name) || '').toLowerCase()
      const brand = (p.brand?.name || '').toLowerCase()
      const color = (l(p.color) || '').toLowerCase()
      return name.includes(q) || brand.includes(q) || color.includes(q)
    })
  }

  if (selectedBrand.value) result = result.filter(p => p.brand?.name === selectedBrand.value)
  if (selectedColor.value) result = result.filter(p => p.colorHex === selectedColor.value)

  if (selectedPrice.value) {
    const [min, max] = selectedPrice.value.split('-').map(s => s.replace('+', ''))
    const minP = parseInt(min) || 0
    const maxP = max ? parseInt(max) : Infinity
    result = result.filter(p => p.price >= minP && p.price <= maxP)
  }

  if (selectedTire.value) result = result.filter(p => p.specifications?.tireSize === selectedTire.value)

  if (sortBy.value === 'name') result.sort((a, b) => (l(a.name) || '').localeCompare(l(b.name) || ''))
  else if (sortBy.value === 'price_asc') result.sort((a, b) => (a.price || 0) - (b.price || 0))
  else if (sortBy.value === 'price_desc') result.sort((a, b) => (b.price || 0) - (a.price || 0))

  return result
})

const paginatedProducts = computed(() => filteredProducts.value.slice(0, showCount.value))
</script>
