<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <div class="mb-6">
        <Breadcrumbs :items="[
          { label: $t('nav.home'), to: localePath('/') },
          { label: $t('compare.title') },
        ]" />
      </div>

      <div class="text-center mb-10">
        <h1 class="section-title mb-4">{{ $t('compare.title') }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ $t('compare.subtitle') }}</p>
      </div>

      <!-- Filters bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <Icon name="ph:magnifying-glass" class="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input v-model="search" type="search" :placeholder="$t('compare.search')" class="input-field ps-10 py-2 text-sm w-full" :aria-label="$t('compare.search')" />
        </div>

        <!-- Brand filter (replaces the dead category filter — brands are in the data) -->
        <select v-model="brandFilter" class="input-field w-auto text-sm py-2" :aria-label="$t('products.brand')">
          <option value="">{{ $t('products.all_brands') }}</option>
          <option v-for="b in brands" :key="b" :value="b">{{ b }}</option>
        </select>

        <select v-model="sortBy" class="input-field w-auto text-sm py-2" :aria-label="$t('products.sort')">
          <option value="price-asc">{{ $t('guide.sort_price_asc') }}</option>
          <option value="price-desc">{{ $t('guide.sort_price_desc') }}</option>
          <option value="range">{{ $t('guide.sort_range') }}</option>
          <option value="name">{{ $t('guide.sort_name') }}</option>
        </select>

        <span class="text-text-secondary text-sm">{{ filtered.length }} {{ $t('guide.model') }}</span>
      </div>

      <!-- Table: one row per MODEL (System B colors grouped by modelFamily) -->
      <div v-if="paginated.length" class="overflow-x-auto">
        <table class="w-full text-sm min-w-[900px]">
          <thead>
            <tr class="border-b-2 border-accent/30">
              <th class="text-start text-white p-3 font-display font-semibold sticky start-0 bg-primary z-10 min-w-[180px]">{{ $t('guide.model') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">
                <button type="button" class="hover:text-white inline-flex items-center gap-1" @click="sortBy = sortBy === 'price-asc' ? 'price-desc' : 'price-asc'">
                  {{ $t('guide.price') }} <Icon name="ph:caret-up-down" class="w-3 h-3" />
                </button>
              </th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.tire_size') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.battery') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">
                <button type="button" class="hover:text-white inline-flex items-center gap-1" @click="sortBy = 'range'">
                  {{ $t('product.range') }} <Icon name="ph:caret-up-down" class="w-3 h-3" />
                </button>
              </th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.motor') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.brake_type') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('compare.colors') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('compare.stock') }}</th>
              <th class="p-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in paginated" :key="m.key" class="border-b border-dark-tertiary/50 hover:bg-dark-secondary/30 transition-colors">
              <td class="p-3 sticky start-0 bg-primary z-10">
                <NuxtLink :to="localePath(`/produits/${m.slug}`)" class="text-accent hover:underline font-display font-semibold text-sm">
                  {{ m.displayName }}
                </NuxtLink>
                <span v-if="m.brand" class="block text-text-secondary text-xs">{{ m.brand }}</span>
              </td>
              <td class="text-center p-3 whitespace-nowrap">
                <span class="text-white font-bold">{{ m.priceLabel }}</span>
                <span v-if="m.compareAtPrice" class="block text-text-secondary line-through text-xs">{{ m.compareAtPrice }}€</span>
              </td>
              <td class="text-center text-text-secondary p-3">{{ sv(m.specs?.tireSize) || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ sv(m.specs?.battery) || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ sv(m.specs?.range) || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ sv(m.specs?.motor) || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ sv(m.specs?.brakeType) || '—' }}</td>
              <td class="text-center p-3">
                <div class="flex justify-center gap-1 flex-wrap max-w-[90px] mx-auto">
                  <NuxtLink
                    v-for="c in m.colors"
                    :key="c.slug"
                    :to="localePath(`/produits/${c.slug}`)"
                    class="w-4 h-4 rounded-full border border-dark-tertiary hover:scale-125 transition-transform"
                    :style="{ backgroundColor: c.hex }"
                    :title="c.name"
                    :aria-label="c.name"
                  />
                </div>
              </td>
              <td class="text-center p-3">
                <span
                  class="inline-flex items-center gap-1.5 text-xs"
                  :class="m.totalStock > 5 ? 'text-accent' : m.totalStock > 0 ? 'text-gold' : 'text-red-400'"
                >
                  <span class="w-2 h-2 rounded-full bg-current" aria-hidden="true" />
                  {{ m.totalStock > 0 ? (m.totalStock > 5 ? $t('product.in_stock') : m.totalStock) : $t('product.out_of_stock') }}
                </span>
              </td>
              <td class="p-3">
                <NuxtLink :to="localePath(`/produits/${m.slug}`)" class="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
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
        <p class="text-text-secondary mb-4">{{ $t('guide.no_results') }}</p>
        <button type="button" class="btn-outline px-6" @click="search = ''; brandFilter = ''">
          {{ $t('products.clear_filters') }}
        </button>
      </div>

      <!-- Pagination -->
      <div v-if="filtered.length > pageSize" class="flex items-center justify-center gap-2 mt-8">
        <button @click="page = Math.max(1, page - 1)" :disabled="page === 1" class="btn-outline text-sm px-3 py-1.5 disabled:opacity-30 min-h-touch" :aria-label="$t('admin.prev')">←</button>
        <span class="text-text-secondary text-sm">{{ page }} / {{ totalPages }}</span>
        <button @click="page = Math.min(totalPages, page + 1)" :disabled="page === totalPages" class="btn-outline text-sm px-3 py-1.5 disabled:opacity-30 min-h-touch" :aria-label="$t('admin.next')">→</button>
      </div>

      <!-- Legend + Browse CTA -->
      <div class="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4">
        <p class="text-text-secondary text-xs">{{ $t('compare.all_models') }}</p>
        <NuxtLink :to="localePath('/produits')" class="btn-outline text-sm inline-flex items-center gap-2">
          <Icon name="ph:storefront" class="w-4 h-4" /> {{ $t('nav.products') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Comparison table (U-P8b rebuild after full review).
 *
 * System B fix: each color is its own product document, so a naive table
 * compares "V20 Pro Noir" against "V20 Pro Blanc" with identical specs.
 * Rows here are grouped by modelFamily — one row per MODEL, all its colors
 * as clickable dots, price as min–max when colors differ, stock summed.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const sv = (v: any) => (typeof v === 'object' && v !== null ? l(v) : v)

useHead({
  title: computed(() => `${t('compare.title')} — Vitesse Eco`),
  meta: [{ name: 'description', content: t('compare.subtitle') }],
})

const { data: products } = useSanityFetch(
  'all-products-compare-v2',
  groq`*[_type == "product" && isAvailable == true && productType == "bike"] | order(sortOrder asc) {
    _id, name, slug, price, compareAtPrice, specifications, color, colorHex, stock,
    modelFamily, brand->{ name }
  }`
)

const search = ref('')
const brandFilter = ref('')
const sortBy = ref('price-asc')
const page = ref(1)
const pageSize = 20

interface ModelRow {
  key: string
  displayName: string
  slug: string
  brand: string
  priceLabel: string
  minPrice: number
  compareAtPrice: number | null
  specs: any
  colors: Array<{ hex: string; name: string; slug: string }>
  totalStock: number
  searchText: string
}

function getRangeNum(specs: any): number {
  const val = sv(specs?.range)
  if (!val) return 0
  const nums = String(val).match(/\d+/g)?.map(Number) || []
  return nums.length ? Math.max(...nums) : 0
}

/** "V20 Pro — Noir" → "V20 Pro" when the suffix is exactly this product's color. */
function stripColorSuffix(name: string, colorName: string): string {
  if (!name || !colorName) return name
  const esc = colorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return name.replace(new RegExp(`\\s*[—–-]\\s*${esc}\\s*$`, 'i'), '') || name
}

// Group color-variants into model rows.
const models = computed<ModelRow[]>(() => {
  const list = (products.value as any[]) || []
  const groups = new Map<string, any[]>()
  for (const p of list) {
    const key = p.modelFamily || p._id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  return [...groups.entries()].map(([key, group]) => {
    // Representative: first in-stock color, else first.
    const rep = group.find((p) => (p.stock || 0) > 0) || group[0]
    const prices = group.map((p) => p.price).filter((n) => typeof n === 'number')
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    return {
      key,
      displayName: stripColorSuffix(l(rep.name) || '', l(rep.color) || ''),
      slug: rep.slug?.current || '',
      brand: rep.brand?.name || '',
      priceLabel: minPrice === maxPrice ? `${minPrice}€` : `${minPrice}–${maxPrice}€`,
      minPrice,
      compareAtPrice: group.length === 1 ? rep.compareAtPrice || null : null,
      specs: rep.specifications,
      colors: group
        .filter((p) => p.colorHex && p.slug?.current)
        .map((p) => ({ hex: p.colorHex, name: l(p.color) || '', slug: p.slug.current })),
      totalStock: group.reduce((sum, p) => sum + (p.stock || 0), 0),
      searchText: group
        .map((p) => `${l(p.name)} ${p.brand?.name || ''} ${JSON.stringify(p.specifications || {})}`)
        .join(' ')
        .toLowerCase(),
    }
  })
})

const brands = computed(() =>
  [...new Set(models.value.map((m) => m.brand).filter(Boolean))].sort()
)

const filtered = computed(() => {
  let list = [...models.value]

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter((m) => m.searchText.includes(q))
  }
  if (brandFilter.value) {
    list = list.filter((m) => m.brand === brandFilter.value)
  }

  if (sortBy.value === 'price-asc') list.sort((a, b) => a.minPrice - b.minPrice)
  else if (sortBy.value === 'price-desc') list.sort((a, b) => b.minPrice - a.minPrice)
  else if (sortBy.value === 'range') list.sort((a, b) => getRangeNum(b.specs) - getRangeNum(a.specs))
  else if (sortBy.value === 'name') list.sort((a, b) => a.displayName.localeCompare(b.displayName))

  return list
})

const totalPages = computed(() => Math.ceil(filtered.value.length / pageSize))
const paginated = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch([search, brandFilter, sortBy], () => { page.value = 1 })
</script>
