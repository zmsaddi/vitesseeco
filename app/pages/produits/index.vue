<script setup lang="ts">
import type { Paginated, ProductSummary } from '~~/server/catalog/types'

/**
 * Product listing.
 *
 * Filters live in the URL so a filtered view can be shared, bookmarked and
 * navigated back to. Every query value is read through a helper that takes the
 * first entry of an array: a duplicated parameter (?q=a&q=b) makes route.query
 * an array, and calling a string method on it crashed the old listing page with
 * a 500 during server rendering.
 */
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const { locale, t } = useI18n()

/** One value, whatever shape the URL arrived in. */
function one(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

const filters = reactive({
  q: one(route.query.q),
  type: one(route.query.type),
  category: one(route.query.categorie),
  sort: one(route.query.tri) || 'relevance',
  page: Number.parseInt(one(route.query.page), 10) || 1,
})

// Back and forward must restore the view, not leave the controls behind.
watch(
  () => route.query,
  (query) => {
    filters.q = one(query.q)
    filters.type = one(query.type)
    filters.category = one(query.categorie)
    filters.sort = one(query.tri) || 'relevance'
    filters.page = Number.parseInt(one(query.page), 10) || 1
  }
)

const requestQuery = computed(() => ({
  locale: locale.value,
  ...(filters.q ? { q: filters.q } : {}),
  ...(filters.type ? { productType: filters.type } : {}),
  ...(filters.category ? { category: filters.category } : {}),
  sort: filters.sort,
  page: filters.page,
}))

// Stated explicitly: the route is wrapped by defineRoute, so its shape cannot
// be inferred through the wrapper, and an un-inferred response silently becomes
// `{}` — which type-checks against nothing and fails only at runtime.
const { data, status } = await useFetch<Paginated<ProductSummary>>('/api/catalog/products', {
  query: requestQuery,
  // The URL is the state; refetching on change is the point.
  watch: [requestQuery],
})

function updateUrl(): void {
  router.push({
    query: {
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.category ? { categorie: filters.category } : {}),
      ...(filters.sort !== 'relevance' ? { tri: filters.sort } : {}),
      ...(filters.page > 1 ? { page: String(filters.page) } : {}),
    },
  })
}

let searchTimer: ReturnType<typeof setTimeout>
function onSearch(): void {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.page = 1
    updateUrl()
  }, 300)
}

useSeoMeta({
  title: () => t('products.title'),
  description: () => t('products.description'),
})
</script>

<template>
  <div class="container-page py-10">
    <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('products.title') }}</h1>

    <div class="mt-6 flex flex-wrap gap-3">
      <label class="flex-1 min-w-56">
        <span class="sr-only">{{ $t('products.search') }}</span>
        <input
          v-model="filters.q"
          type="search"
          class="field"
          :placeholder="$t('products.search')"
          @input="onSearch"
        />
      </label>

      <label>
        <span class="sr-only">{{ $t('products.sort') }}</span>
        <select v-model="filters.sort" class="field w-auto" @change="filters.page = 1; updateUrl()">
          <option value="relevance">{{ $t('products.sort_relevance') }}</option>
          <option value="price_asc">{{ $t('products.sort_price_asc') }}</option>
          <option value="price_desc">{{ $t('products.sort_price_desc') }}</option>
          <option value="newest">{{ $t('products.sort_newest') }}</option>
        </select>
      </label>
    </div>

    <p v-if="status === 'pending'" class="mt-10 text-content-muted">{{ $t('common.loading') }}</p>

    <p v-else-if="!data?.items?.length" class="mt-10 text-content-muted">
      {{ $t('products.no_results') }}
    </p>

    <ul v-else class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="product in data.items" :key="product.id">
        <NuxtLink :to="localePath(`/produits/${product.slug}`)" class="card group block overflow-hidden">
          <div class="aspect-square overflow-hidden bg-surface-sunken">
            <NuxtImg
              v-if="product.image"
              :src="product.image.url"
              :alt="product.image.alt"
              width="600"
              height="600"
              loading="lazy"
              class="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <div class="p-4">
            <h2 class="font-medium text-content-strong">{{ product.name }}</h2>
            <p v-if="product.color" class="mt-0.5 text-sm text-content-muted">{{ product.color }}</p>
            <p class="mt-2 flex items-baseline gap-2">
              <span class="text-lg font-bold text-accent">{{ (product.price / 100).toFixed(2) }} €</span>
              <span
                v-if="product.compareAtPrice"
                class="text-sm text-content-muted line-through"
              >{{ (product.compareAtPrice / 100).toFixed(2) }} €</span>
            </p>
            <p v-if="product.available <= 0" class="mt-1 text-sm text-danger">
              {{ $t('products.out_of_stock') }}
            </p>
          </div>
        </NuxtLink>
      </li>
    </ul>

    <nav v-if="data && data.totalPages > 1" class="mt-10 flex justify-center gap-2" :aria-label="$t('products.pagination')">
      <button
        type="button"
        class="btn-secondary"
        :disabled="filters.page <= 1"
        @click="filters.page--; updateUrl()"
      >
        {{ $t('common.previous') }}
      </button>
      <span class="flex items-center px-3 text-sm text-content-muted">
        {{ filters.page }} / {{ data.totalPages }}
      </span>
      <button
        type="button"
        class="btn-secondary"
        :disabled="filters.page >= data.totalPages"
        @click="filters.page++; updateUrl()"
      >
        {{ $t('common.next') }}
      </button>
    </nav>
  </div>
</template>
