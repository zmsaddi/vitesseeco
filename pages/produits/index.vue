<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Header -->
      <div class="text-center mb-10">
        <h1 class="section-title mb-3">{{ $t('products.title') }}</h1>
        <p class="text-text-secondary text-lg">{{ $t('products.subtitle') }}</p>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Sidebar Filters (Desktop) -->
        <aside class="lg:w-64 shrink-0">
          <div class="card p-5 space-y-6 sticky top-24">
            <h3 class="font-display font-semibold text-white flex items-center gap-2">
              <Icon name="ph:funnel" class="w-5 h-5" />
              {{ $t('products.filter') }}
            </h3>

            <!-- Category -->
            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('products.all_categories') }}</label>
              <select v-model="selectedCategory" class="input-field text-sm py-2">
                <option value="">{{ $t('products.all_categories') }}</option>
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>

            <!-- Tire Size -->
            <div>
              <label class="text-text-secondary text-sm font-medium block mb-2">{{ $t('products.tire_size') }}</label>
              <select v-model="selectedTire" class="input-field text-sm py-2">
                <option value="">Toutes</option>
                <option v-for="size in tireSizes" :key="size" :value="size">{{ size }}"</option>
              </select>
            </div>

            <!-- Range -->
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
          <!-- Sort & View -->
          <div class="flex items-center justify-between mb-6">
            <p class="text-text-secondary text-sm">{{ filteredProducts.length }} vélos</p>
            <div class="flex items-center gap-4">
              <select v-model="sortBy" class="input-field text-sm py-2 w-auto">
                <option value="name">{{ $t('products.sort_name') }}</option>
                <option value="price_asc">{{ $t('products.sort_price_asc') }}</option>
                <option value="price_desc">{{ $t('products.sort_price_desc') }}</option>
              </select>
              <div class="hidden md:flex gap-1">
                <button
                  @click="viewMode = 'grid'"
                  class="p-2 rounded"
                  :class="viewMode === 'grid' ? 'text-accent bg-dark-secondary' : 'text-text-secondary'"
                >
                  <Icon name="ph:squares-four" class="w-5 h-5" />
                </button>
                <button
                  @click="viewMode = 'list'"
                  class="p-2 rounded"
                  :class="viewMode === 'list' ? 'text-accent bg-dark-secondary' : 'text-text-secondary'"
                >
                  <Icon name="ph:list" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Products -->
          <div :class="viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'">
            <NuxtLink
              v-for="product in filteredProducts"
              :key="product.slug"
              :to="localePath(`/produits/${product.slug}`)"
              class="card group"
              :class="viewMode === 'list' ? 'flex' : ''"
            >
              <div
                :class="viewMode === 'list' ? 'w-48 shrink-0' : 'aspect-[4/3]'"
                class="bg-dark-tertiary flex items-center justify-center relative overflow-hidden"
              >
                <Icon name="ph:bicycle" class="w-16 h-16 text-dark-tertiary/50" />
                <span v-if="product.badge" class="absolute top-3 left-3" :class="product.badge === 'PROMO' ? 'badge-promo' : 'badge-new'">
                  {{ product.badge }}
                </span>
              </div>
              <div class="p-4 flex-1">
                <h3 class="font-display font-semibold text-white group-hover:text-accent transition-colors mb-1">
                  {{ product.name }}
                </h3>
                <p class="text-text-secondary text-sm mb-2">{{ product.feature }}</p>
                <p class="text-text-secondary text-xs mb-3">{{ product.battery }} — {{ product.range }}</p>
                <div class="flex items-center justify-between">
                  <span class="text-accent font-bold">{{ $t('common.from') }} {{ product.price }}{{ $t('common.currency') }}</span>
                  <div class="flex gap-1">
                    <span
                      v-for="color in product.colors.slice(0, 4)"
                      :key="color"
                      class="w-3 h-3 rounded-full border border-white/20"
                      :style="{ backgroundColor: color }"
                    />
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>

          <!-- No results -->
          <div v-if="filteredProducts.length === 0" class="text-center py-16">
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

useHead({ title: `${t('products.title')} — Vitesse Eco` })

const selectedCategory = ref('')
const selectedTire = ref('')
const selectedRange = ref('')
const sortBy = ref('name')
const viewMode = ref<'grid' | 'list'>('grid')

const categories = ['Urban', 'Off-Road', 'Pliable', 'Lady', 'Long Range']
const tireSizes = ['16', '20', '24']

const products = [
  { slug: 'v20-mini', name: 'V20 Mini', feature: 'Teenagers', battery: '36V 13AH', tire: '16', range: '30-40km', rangeMin: 30, price: '999', category: 'Urban', badge: '', colors: ['#B76E79', '#6A0DAD', '#000000', '#4ADE80', '#8E8E8E'] },
  { slug: 'v20-pro', name: 'V20 Pro', feature: 'Bestseller, sièges extensibles', battery: '48V 15.6AH', tire: '20', range: '40-50km', rangeMin: 40, price: '1 299', category: 'Urban', badge: 'BEST', colors: ['#000000', '#8E8E8E', '#4A4A4A'] },
  { slug: 'v20-limited', name: 'V20 Limited', feature: 'Long seat', battery: '48V 18.2AH', tire: '20', range: '50-60km', rangeMin: 50, price: '1 399', category: 'Urban', badge: '', colors: ['#000000', '#8E8E8E', '#4A4A4A', '#8B4513'] },
  { slug: 's20-pro', name: 'S20 Pro', feature: 'Design unique', battery: '48V 18.2AH', tire: '20', range: '50-60km', rangeMin: 50, price: '1 499', category: 'Urban', badge: 'NEW', colors: ['#000000', '#8E8E8E', '#4A4A4A'] },
  { slug: 'v20-cross', name: 'V20 Cross', feature: 'Offroad + Bluetooth speaker', battery: '48V 22AH', tire: '17', range: '60-70km', rangeMin: 60, price: '1 599', category: 'Off-Road', badge: 'PROMO', colors: ['#000000'] },
  { slug: 'q30', name: 'Q30 Pliable', feature: 'Pliable', battery: '48V 15.6AH', tire: '20', range: '40-50km', rangeMin: 40, price: '1 399', category: 'Pliable', badge: 'NEW', colors: ['#000000', '#8E8E8E', '#FFFFFF'] },
  { slug: 'd50', name: 'D50', feature: 'Lady friendly, selle amovible', battery: '48V 18.2AH', tire: '20', range: '50-60km', rangeMin: 50, price: '1 349', category: 'Lady', badge: '', colors: ['#000000', '#4ADE80', '#F5F5DC', '#4A4A4A', '#6A0DAD'] },
  { slug: 'c28', name: 'C28', feature: 'Lady friendly', battery: '48V 15.6AH', tire: '20', range: '40-50km', rangeMin: 40, price: '1 199', category: 'Lady', badge: '', colors: ['#000000', '#B76E79', '#4ADE80', '#6A0DAD'] },
  { slug: 'eb30', name: 'EB30', feature: 'Double batterie + panier', battery: '15.6AH x2', tire: '20', range: '90-100km', rangeMin: 90, price: '1 799', category: 'Long Range', badge: '', colors: ['#000000'] },
  { slug: 'v20-max', name: 'V20 Max', feature: 'Grands gabarits (175cm+)', battery: '48V 18.2AH', tire: '24', range: '50-60km', rangeMin: 50, price: '1 499', category: 'Urban', badge: '', colors: ['#000000'] },
  { slug: 'v20-limited-pro', name: 'V20 Limited Pro', feature: 'Double batterie, autonomie max', battery: '48V 15.6AH x2', tire: '20', range: '~100km', rangeMin: 100, price: '1 899', category: 'Long Range', badge: 'NEW', colors: ['#000000'] },
]

const filteredProducts = computed(() => {
  let result = [...products]

  if (selectedCategory.value) {
    result = result.filter(p => p.category === selectedCategory.value)
  }
  if (selectedTire.value) {
    result = result.filter(p => p.tire === selectedTire.value)
  }
  if (selectedRange.value) {
    if (selectedRange.value === '30-50') result = result.filter(p => p.rangeMin >= 30 && p.rangeMin < 50)
    else if (selectedRange.value === '50-70') result = result.filter(p => p.rangeMin >= 50 && p.rangeMin < 70)
    else if (selectedRange.value === '70+') result = result.filter(p => p.rangeMin >= 70)
  }

  if (sortBy.value === 'name') result.sort((a, b) => a.name.localeCompare(b.name))
  else if (sortBy.value === 'price_asc') result.sort((a, b) => parseInt(a.price.replace(/\s/g, '')) - parseInt(b.price.replace(/\s/g, '')))
  else if (sortBy.value === 'price_desc') result.sort((a, b) => parseInt(b.price.replace(/\s/g, '')) - parseInt(a.price.replace(/\s/g, '')))

  return result
})

function clearFilters() {
  selectedCategory.value = ''
  selectedTire.value = ''
  selectedRange.value = ''
}
</script>
