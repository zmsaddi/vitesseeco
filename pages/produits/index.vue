<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Header -->
      <div class="text-center mb-10">
        <h1 class="section-title mb-3">{{ $t('products.title') }}</h1>
        <p class="text-text-secondary text-lg">{{ $t('products.subtitle') }}</p>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Sidebar Filters -->
        <aside class="lg:w-64 shrink-0">
          <div class="card p-5 space-y-6 sticky top-24">
            <h3 class="font-display font-semibold text-white flex items-center gap-2">
              <Icon name="ph:funnel" class="w-5 h-5" />
              {{ $t('products.filter') }}
            </h3>

            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('products.all_categories') }}</label>
              <select v-model="selectedCategory" class="input-field text-sm py-2">
                <option value="">{{ $t('products.all_categories') }}</option>
                <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ l(cat.name) }}</option>
              </select>
            </div>

            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('products.tire_size') }}</label>
              <select v-model="selectedTire" class="input-field text-sm py-2">
                <option value="">Toutes</option>
                <option v-for="size in tireSizes" :key="size" :value="size">{{ size }}</option>
              </select>
            </div>

            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('products.range_km') }}</label>
              <select v-model="selectedRange" class="input-field text-sm py-2">
                <option value="">Toutes</option>
                <option value="30-50">30-50 km</option>
                <option value="50-70">50-70 km</option>
                <option value="70+">70+ km</option>
              </select>
            </div>

            <button @click="clearFilters" class="text-accent text-sm hover:underline">
              {{ $t('products.clear_filters') }}
            </button>
          </div>
        </aside>

        <!-- Products Grid -->
        <div class="flex-1">
          <div class="flex items-center justify-between mb-6">
            <p class="text-text-secondary text-sm">{{ filteredProducts.length }} vélos</p>
            <div class="flex items-center gap-4">
              <select v-model="sortBy" class="input-field text-sm py-2 w-auto">
                <option value="sortOrder">{{ $t('products.sort_newest') }}</option>
                <option value="name">{{ $t('products.sort_name') }}</option>
                <option value="price_asc">{{ $t('products.sort_price_asc') }}</option>
                <option value="price_desc">{{ $t('products.sort_price_desc') }}</option>
              </select>
              <div class="hidden md:flex gap-1">
                <button @click="viewMode = 'grid'" class="p-2 rounded" :class="viewMode === 'grid' ? 'text-accent bg-dark-secondary' : 'text-text-secondary'">
                  <Icon name="ph:squares-four" class="w-5 h-5" />
                </button>
                <button @click="viewMode = 'list'" class="p-2 rounded" :class="viewMode === 'list' ? 'text-accent bg-dark-secondary' : 'text-text-secondary'">
                  <Icon name="ph:list" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="!products" class="text-center py-16">
            <Icon name="ph:spinner" class="w-8 h-8 text-accent animate-spin mx-auto" />
            <p class="text-text-secondary mt-4">{{ $t('common.loading') }}</p>
          </div>

          <!-- Products -->
          <div v-else :class="viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'">
            <NuxtLink
              v-for="product in filteredProducts"
              :key="product._id"
              :to="localePath(`/produits/${product.slug?.current}`)"
              class="card group"
              :class="viewMode === 'list' ? 'flex' : ''"
            >
              <div
                :class="viewMode === 'list' ? 'w-48 shrink-0' : 'aspect-[4/3]'"
                class="bg-dark-tertiary flex items-center justify-center relative overflow-hidden"
              >
                <NuxtImg
                  v-if="product.mainImage?.asset"
                  :src="$sanity.visual.urlFor(product.mainImage).width(400).height(300).url()"
                  :alt="l(product.name)"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <Icon v-else name="ph:bicycle" class="w-16 h-16 text-dark-tertiary/50" />
                <span v-if="product.isOnSale" class="absolute top-3 left-3 badge-promo">PROMO</span>
                <span v-else-if="product.isNew" class="absolute top-3 left-3 badge-new">NEW</span>
              </div>
              <div class="p-4 flex-1">
                <h3 class="font-display font-semibold text-white group-hover:text-accent transition-colors mb-1">
                  {{ l(product.name) }}
                </h3>
                <p class="text-text-secondary text-sm mb-2">{{ l(product.shortDescription) }}</p>
                <p class="text-text-secondary text-xs mb-3">{{ product.specifications?.battery }} — {{ product.specifications?.range }}</p>
                <div class="flex items-center justify-between">
                  <div>
                    <span v-if="product.compareAtPrice" class="text-text-secondary line-through text-xs mr-2">{{ product.compareAtPrice }}{{ $t('common.currency') }}</span>
                    <span class="text-accent font-bold">{{ $t('common.from') }} {{ product.price }}{{ $t('common.currency') }}</span>
                  </div>
                  <div class="flex gap-1">
                    <span
                      v-for="variant in (product.variants || []).slice(0, 4)"
                      :key="variant._key"
                      class="w-3 h-3 rounded-full border border-white/20"
                      :style="{ backgroundColor: variant.colorHex }"
                    />
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>

          <div v-if="products && filteredProducts.length === 0" class="text-center py-16">
            <Icon name="ph:magnifying-glass" class="w-12 h-12 text-dark-tertiary mx-auto mb-4" />
            <p class="text-text-secondary">{{ $t('products.no_results') }}</p>
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

useHead({ title: `${t('products.title')} — Vitesse Eco` })

const selectedCategory = ref('')
const selectedTire = ref('')
const selectedRange = ref('')
const sortBy = ref('sortOrder')
const viewMode = ref<'grid' | 'list'>('grid')

const tireSizes = ['16"', '20"', '24"', '70/100-17"']

// Fetch categories
const catQuery = groq`*[_type == "category"] | order(sortOrder asc) { _id, name, slug }`
const { data: categories } = useSanityQuery(catQuery)

// Fetch all products
const prodQuery = groq`*[_type == "product" && isAvailable == true] | order(sortOrder asc) {
  _id, name, slug, shortDescription, price, compareAtPrice, isOnSale, isNew, isFeatured, sortOrder,
  mainImage, specifications, category->{ _id },
  variants[]{ _key, colorHex, colorName }
}`
const { data: products } = useSanityQuery(prodQuery)

const filteredProducts = computed(() => {
  if (!products.value) return []
  let result = [...products.value]

  if (selectedCategory.value) {
    result = result.filter((p: any) => p.category?._id === selectedCategory.value)
  }
  if (selectedTire.value) {
    result = result.filter((p: any) => p.specifications?.tireSize === selectedTire.value)
  }
  if (selectedRange.value) {
    result = result.filter((p: any) => {
      const range = p.specifications?.range || ''
      const match = range.match(/(\d+)/)
      if (!match) return false
      const min = parseInt(match[1])
      if (selectedRange.value === '30-50') return min >= 30 && min < 50
      if (selectedRange.value === '50-70') return min >= 50 && min < 70
      if (selectedRange.value === '70+') return min >= 70
      return true
    })
  }

  if (sortBy.value === 'name') result.sort((a: any, b: any) => (l(a.name)).localeCompare(l(b.name)))
  else if (sortBy.value === 'price_asc') result.sort((a: any, b: any) => (a.price || 0) - (b.price || 0))
  else if (sortBy.value === 'price_desc') result.sort((a: any, b: any) => (b.price || 0) - (a.price || 0))

  return result
})

function clearFilters() {
  selectedCategory.value = ''
  selectedTire.value = ''
  selectedRange.value = ''
}
</script>
