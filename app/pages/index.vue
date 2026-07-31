<script setup lang="ts">
import type { ProductSummary, Category, Article } from '~~/server/catalog/types'
import { ORGANISATION } from '~~/shared/organisation'

/**
 * The home page.
 *
 * The most linked, most crawled and highest-converting URL the business owns.
 * It was a placeholder with no products and no links at all — not even to the
 * catalogue — so every visitor arriving from Google or a business card landed
 * on a dead end, and none of the internal link equity that should flow to the
 * product pages was flowing anywhere.
 *
 * It does the two things a shop's front page has to do: show what is for sale,
 * and answer why buy here rather than from a marketplace. The answer here is
 * specific and checkable — this shop drives its own van — so it is said plainly
 * rather than dressed up as a claim about passion.
 *
 * Everything comes through the catalogue API, so the prices and the stock are
 * the live ones. A home page that caches a price is a home page that lies.
 */
const { locale, t } = useI18n()
const { formatCents } = useFormatPrice()
const localePath = useLocalePath()

const query = computed(() => ({ locale: locale.value }))

// Fetched together: three sequential round trips would delay the first paint of
// the page everything else links from.
const [{ data: products }, { data: categories }, { data: articles }] = await Promise.all([
  useFetch<{ items: ProductSummary[] }>('/api/catalog/products', {
    query: computed(() => ({ ...query.value, perPage: 8, inStock: true })),
    default: () => ({ items: [] }),
  }),
  useFetch<{ categories: Category[] }>('/api/catalog/categories', {
    query,
    default: () => ({ categories: [] }),
  }),
  useFetch<{ articles: Article[] }>('/api/content/articles', {
    query,
    default: () => ({ articles: [] }),
  }),
])

const featured = computed(() => products.value?.items?.slice(0, 8) ?? [])
const tiles = computed(() => categories.value?.categories?.slice(0, 4) ?? [])
const latest = computed(() => articles.value?.articles?.slice(0, 3) ?? [])

/** Only the countries the fleet actually reaches. Nothing aspirational. */
const deliversTo = ORGANISATION.deliversTo.join(' · ')

useSeoMeta({
  title: () => t('home.title'),
  description: () => t('home.description'),
})
</script>

<template>
  <div>
    <section class="container-page py-16 sm:py-24">
      <p class="text-sm font-semibold uppercase tracking-widest text-accent">
        {{ $t('home.eyebrow') }}
      </p>
      <h1 class="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight text-content-strong sm:text-5xl">
        {{ $t('home.title') }}
      </h1>
      <p class="mt-4 max-w-2xl text-lg text-content-muted">{{ $t('home.description') }}</p>

      <div class="mt-8 flex flex-wrap gap-3">
        <NuxtLink :to="localePath('/produits')" class="btn-primary">{{ $t('home.cta_products') }}</NuxtLink>
        <!-- Someone who does not yet know which bike they want needs this more
             than they need the catalogue. -->
        <NuxtLink :to="localePath('/guide')" class="btn-secondary">{{ $t('home.cta_guide') }}</NuxtLink>
      </div>
    </section>

    <!-- Why here rather than a marketplace. Specific, and checkable. -->
    <section class="border-y border-surface-border bg-surface-sunken">
      <div class="container-page grid gap-6 py-10 sm:grid-cols-3">
        <div>
          <h2 class="font-display font-bold text-content-strong">{{ $t('home.trust_delivery') }}</h2>
          <p class="mt-1 text-sm text-content-muted">
            {{ $t('home.trust_delivery_body', { countries: deliversTo }) }}
          </p>
        </div>
        <div>
          <h2 class="font-display font-bold text-content-strong">{{ $t('home.trust_shop') }}</h2>
          <p class="mt-1 text-sm text-content-muted">{{ $t('home.trust_shop_body') }}</p>
        </div>
        <div>
          <h2 class="font-display font-bold text-content-strong">{{ $t('home.trust_warranty') }}</h2>
          <p class="mt-1 text-sm text-content-muted">{{ $t('home.trust_warranty_body') }}</p>
        </div>
      </div>
    </section>

    <section v-if="tiles.length" class="container-page py-14">
      <h2 class="font-display text-2xl font-bold text-content-strong">{{ $t('home.categories') }}</h2>
      <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="category in tiles" :key="category.id">
          <NuxtLink
            :to="localePath(`/produits?categorie=${category.slug}`)"
            class="card block overflow-hidden transition hover:border-accent"
          >
            <NuxtImg
              v-if="category.image"
              :src="category.image.url"
              :alt="category.image.alt"
              width="400"
              height="300"
              loading="lazy"
              class="aspect-[4/3] w-full object-cover"
            />
            <span class="block p-4 font-medium text-content-strong">{{ category.name }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="featured.length" class="container-page pb-14">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-display text-2xl font-bold text-content-strong">{{ $t('home.featured') }}</h2>
        <NuxtLink :to="localePath('/produits')" class="text-sm text-accent hover:underline">
          {{ $t('home.see_all') }}
        </NuxtLink>
      </div>

      <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="product in featured" :key="product.id" class="card overflow-hidden">
          <NuxtLink :to="localePath(`/produits/${product.slug}`)" class="block">
            <NuxtImg
              v-if="product.image"
              :src="product.image.url"
              :alt="product.image.alt"
              width="400"
              height="400"
              loading="lazy"
              class="aspect-square w-full object-cover"
            />
            <div class="p-4">
              <p class="truncate font-medium text-content-strong">{{ product.name }}</p>
              <p v-if="product.color" class="text-xs text-content-muted">{{ product.color }}</p>
              <p class="mt-2 font-bold text-content-strong">
                {{ formatCents(product.price) }}
                <span
                  v-if="product.compareAtPrice"
                  class="ms-2 text-sm font-normal text-content-muted line-through"
                >{{ formatCents(product.compareAtPrice) }}</span>
              </p>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="latest.length" class="border-t border-surface-border bg-surface-sunken">
      <div class="container-page py-14">
        <h2 class="font-display text-2xl font-bold text-content-strong">{{ $t('blog.title') }}</h2>
        <ul class="mt-6 grid gap-4 sm:grid-cols-3">
          <li v-for="article in latest" :key="article.id" class="card overflow-hidden">
            <NuxtLink :to="localePath(`/blog/${article.slug}`)" class="block p-5">
              <h3 class="font-display font-bold text-content-strong">{{ article.title }}</h3>
              <p v-if="article.excerpt" class="mt-2 line-clamp-3 text-sm text-content-muted">
                {{ article.excerpt }}
              </p>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
