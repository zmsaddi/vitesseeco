<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <div class="text-center mb-10">
        <h1 class="section-title mb-4">{{ $t('compare.title') }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ $t('compare.subtitle') }}</p>
      </div>

      <!-- Filters bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <!-- Search -->
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input v-model="search" type="text" :placeholder="$t('compare.search')" class="input-field pl-10 py-2 text-sm w-full" />
        </div>

        <!-- Category filter -->
        <select v-model="categoryFilter" class="input-field w-auto text-sm py-2">
          <option value="">{{ $t('compare.all_categories') }}</option>
          <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ l(cat.name) }}</option>
        </select>

        <!-- Sort -->
        <select v-model="sortBy" class="input-field w-auto text-sm py-2">
          <option value="price-asc">{{ $t('guide.sort_price_asc') }}</option>
          <option value="price-desc">{{ $t('guide.sort_price_desc') }}</option>
          <option value="range">{{ $t('guide.sort_range') }}</option>
          <option value="name">{{ $t('guide.sort_name') }}</option>
        </select>

        <span class="text-text-secondary text-sm">{{ filtered.length }} {{ $t('guide.model') }}</span>
      </div>

      <!-- Table -->
      <div v-if="paginatedProducts.length" class="overflow-x-auto">
        <table class="w-full text-sm min-w-[900px]">
          <thead>
            <tr class="border-b-2 border-accent/30">
              <th class="text-left text-white p-3 font-display font-semibold sticky left-0 bg-primary z-10 min-w-[180px]">{{ $t('guide.model') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium cursor-pointer hover:text-white" @click="sortBy = sortBy === 'price-asc' ? 'price-desc' : 'price-asc'">
                {{ $t('guide.price') }} <Icon name="ph:caret-up-down" class="w-3 h-3 inline" />
              </th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.tire_size') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.battery') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium cursor-pointer hover:text-white" @click="sortBy = 'range'">
                {{ $t('product.range') }} <Icon name="ph:caret-up-down" class="w-3 h-3 inline" />
              </th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.motor') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.brake_type') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('compare.colors') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('compare.stock') }}</th>
              <th class="p-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in paginatedProducts" :key="p._id" class="border-b border-dark-tertiary/50 hover:bg-dark-secondary/30 transition-colors">
              <td class="p-3 sticky left-0 bg-primary z-10">
                <NuxtLink :to="localePath(`/produits/${p.slug?.current}`)" class="text-accent hover:underline font-display font-semibold text-sm">
                  {{ l(p.name) }}
                </NuxtLink>
              </td>
              <td class="text-center p-3">
                <span class="text-white font-bold">{{ p.price }}€</span>
                <span v-if="p.compareAtPrice" class="block text-text-secondary line-through text-xs">{{ p.compareAtPrice }}€</span>
              </td>
              <td class="text-center text-text-secondary p-3">{{ p.specifications?.tireSize || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ p.specifications?.battery || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ sv(p.specifications?.range) || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ p.specifications?.motor || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ sv(p.specifications?.brakeType) || '—' }}</td>
              <td class="text-center p-3">
                <div class="flex justify-center gap-1">
                  <span v-if="p.colorHex" class="w-4 h-4 rounded-full border border-dark-tertiary" :style="{ backgroundColor: p.colorHex }" :title="l(p.color)" />
                </div>
              </td>
              <td class="text-center p-3">
                <span v-if="(p.stock || 0) > 5" class="text-accent text-xs">✅</span>
                <span v-else-if="(p.stock || 0) > 0" class="text-gold text-xs">{{ p.stock }}</span>
                <span v-else class="text-red-400 text-xs">❌</span>
              </td>
              <td class="p-3">
                <NuxtLink :to="localePath(`/produits/${p.slug?.current}`)" class="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                  {{ $t('common.see_more') }}
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- No results -->
      <div v-else class="text-center py-16 card">
        <Icon name="ph:magnifying-glass" class="w-12 h-12 text-dark-tertiary mx-auto mb-4" />
        <p class="text-text-secondary">{{ $t('guide.no_results') }}</p>
      </div>

      <!-- Pagination -->
      <div v-if="filtered.length > pageSize" class="flex items-center justify-center gap-2 mt-8">
        <button @click="page = Math.max(1, page - 1)" :disabled="page === 1" class="btn-outline text-sm px-3 py-1.5 disabled:opacity-30">←</button>
        <span class="text-text-secondary text-sm">{{ page }} / {{ totalPages }}</span>
        <button @click="page = Math.min(totalPages, page + 1)" :disabled="page === totalPages" class="btn-outline text-sm px-3 py-1.5 disabled:opacity-30">→</button>
      </div>

      <!-- Legend + Guide CTA -->
      <div class="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4">
        <p class="text-text-secondary text-xs">{{ $t('compare.all_models') }}</p>
        <NuxtLink :to="localePath('/guide')" class="btn-outline text-sm inline-flex items-center gap-2">
          <Icon name="ph:compass" class="w-4 h-4" /> {{ $t('guide.title') }}
        </NuxtLink>
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
  title: `${t('compare.title')} — Vitesse Eco`,
  meta: [{ name: 'description', content: t('compare.subtitle') }],
})

const { data: products } = useSanityFetch(
  'all-products-compare',
  groq`*[_type == "product" && isAvailable == true && productType == "bike"] | order(sortOrder asc) {
    _id, name, slug, price, compareAtPrice, specifications, color, colorHex, stock,
    brand->{ name }
  }`
)

const search = ref('')
const categoryFilter = ref('')
const sortBy = ref('price-asc')
const page = ref(1)
const pageSize = 20

// Extract unique categories
const categories = computed(() => {
  if (!products.value) return []
  const map = new Map<string, any>()
  for (const p of products.value) {
    if (p.category?._id) map.set(p.category._id, p.category)
  }
  return Array.from(map.values())
})

function getRangeNum(specs: any): number {
  if (!specs?.range) return 0
  const val = typeof specs.range === 'object' ? (specs.range.fr || specs.range.en || '') : specs.range
  const match = String(val).match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
}

// System B: stock is directly on product


const filtered = computed(() => {
  if (!products.value?.length) return []
  let list = [...products.value]

  // Search
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(p => {
      const name = (l(p.name) || '').toLowerCase()
      const specs = JSON.stringify(p.specifications || {}).toLowerCase()
      return name.includes(q) || specs.includes(q)
    })
  }

  // Category
  if (categoryFilter.value) {
    list = list.filter(p => p.category?._id === categoryFilter.value)
  }

  // Sort
  if (sortBy.value === 'price-asc') list.sort((a, b) => a.price - b.price)
  else if (sortBy.value === 'price-desc') list.sort((a, b) => b.price - a.price)
  else if (sortBy.value === 'range') list.sort((a, b) => getRangeNum(b.specifications) - getRangeNum(a.specifications))
  else if (sortBy.value === 'name') list.sort((a, b) => (l(a.name) || '').localeCompare(l(b.name) || ''))

  return list
})

const totalPages = computed(() => Math.ceil(filtered.value.length / pageSize))
const paginatedProducts = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

// Reset page when filters change
watch([search, categoryFilter, sortBy], () => { page.value = 1 })
</script>
