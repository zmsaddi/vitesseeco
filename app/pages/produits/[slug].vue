<script setup lang="ts">
import type { ProductDetail } from '~~/server/catalog/types'

/**
 * Product page.
 *
 * The fetch is awaited so an unknown slug produces a real 404 during server
 * rendering. The old page checked a status that was still pending, so the throw
 * was unreachable and every wrong URL answered 200 with an empty page — a soft
 * 404, which tells a search engine the page exists.
 */
const route = useRoute()
const localePath = useLocalePath()
const { locale, t } = useI18n()
const cart = useCart()

const slug = computed(() => String(route.params.slug))

const { data: product } = await useFetch<ProductDetail>(
  () => `/api/catalog/products/${slug.value}`,
  { query: computed(() => ({ locale: locale.value })) }
)

if (!product.value) {
  throw createError({ statusCode: 404, statusMessage: 'Product not found', fatal: true })
}

const selectedImage = ref(0)
const quantity = ref(1)
const added = ref(false)

/** Resolved once so the template never indexes an array that may be empty. */
const activeImage = computed(() => product.value?.images[selectedImage.value] ?? product.value?.image ?? null)

watch(product, () => {
  selectedImage.value = 0
  quantity.value = 1
})

function addToCart(): void {
  if (!product.value) return
  cart.add(product.value.id, quantity.value)
  added.value = true
  setTimeout(() => {
    added.value = false
  }, 2500)
}

useSeoMeta({
  title: () => product.value?.seo.title || product.value?.name || '',
  description: () => product.value?.seo.description || product.value?.shortDescription || '',
  ogImage: () => product.value?.image?.url ?? '',
})

// Structured data is built from what the page actually shows, so a price or an
// availability shown to a customer and one shown to Google cannot diverge.
useHead(() => {
  if (!product.value) return {}
  const item = product.value
  return {
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: item.name,
          image: item.images.map((image) => image.url),
          description: item.shortDescription ?? item.description ?? undefined,
          sku: item.sku ?? undefined,
          gtin13: item.gtin ?? undefined,
          brand: item.brand ? { '@type': 'Brand', name: item.brand.name } : undefined,
          offers: {
            '@type': 'Offer',
            price: (item.price / 100).toFixed(2),
            priceCurrency: 'EUR',
            availability:
              item.available > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
          },
        }),
      },
    ],
  }
})
</script>

<template>
  <article v-if="product" class="container-page py-10">
    <div class="grid gap-10 lg:grid-cols-2">
      <div>
        <div class="aspect-square overflow-hidden rounded-2xl bg-surface-sunken">
          <NuxtImg
            v-if="activeImage"
            :src="activeImage.url"
            :alt="activeImage.alt"
            width="900"
            height="900"
            class="h-full w-full object-cover"
          />
        </div>
        <div v-if="product.images.length > 1" class="mt-3 flex gap-2 overflow-x-auto">
          <button
            v-for="(image, index) in product.images"
            :key="image.url"
            type="button"
            class="h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2"
            :class="index === selectedImage ? 'border-accent' : 'border-surface-border'"
            :aria-label="`${$t('product.view_image')} ${index + 1}`"
            @click="selectedImage = index"
          >
            <NuxtImg :src="image.url" :alt="image.alt" width="80" height="80" class="h-full w-full object-cover" />
          </button>
        </div>
      </div>

      <div>
        <p v-if="product.brand" class="text-sm font-medium text-content-muted">{{ product.brand.name }}</p>
        <h1 class="mt-1 font-display text-3xl font-extrabold text-content-strong">{{ product.name }}</h1>

        <p class="mt-4 flex items-baseline gap-3">
          <span class="text-3xl font-bold text-accent">{{ (product.price / 100).toFixed(2) }} €</span>
          <span v-if="product.compareAtPrice" class="text-lg text-content-muted line-through">
            {{ (product.compareAtPrice / 100).toFixed(2) }} €
          </span>
        </p>

        <p v-if="product.shortDescription" class="mt-4 text-content">{{ product.shortDescription }}</p>

        <p class="mt-4 text-sm" :class="product.available > 0 ? 'text-success' : 'text-danger'">
          {{ product.available > 0 ? $t('product.in_stock', { count: product.available }) : $t('products.out_of_stock') }}
        </p>

        <div v-if="product.siblings.length" class="mt-6">
          <h2 class="text-sm font-semibold text-content-strong">{{ $t('product.other_colours') }}</h2>
          <ul class="mt-2 flex flex-wrap gap-2">
            <li v-for="sibling in product.siblings" :key="sibling.id">
              <NuxtLink
                :to="localePath(`/produits/${sibling.slug}`)"
                class="btn-secondary h-11 px-3 text-xs"
              >
                <span
                  v-if="sibling.colorHex"
                  class="h-4 w-4 rounded-full border border-surface-border"
                  :style="{ backgroundColor: sibling.colorHex }"
                  aria-hidden="true"
                />
                {{ sibling.color ?? sibling.name }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-2">
            <span class="text-sm text-content-muted">{{ $t('product.quantity') }}</span>
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              :max="Math.max(1, Math.min(10, product.available))"
              class="field w-20"
            />
          </label>
          <button
            type="button"
            class="btn-primary flex-1 sm:flex-none sm:px-8"
            :disabled="product.available <= 0"
            @click="addToCart"
          >
            {{ added ? $t('product.added') : $t('product.add_to_cart') }}
          </button>
        </div>

        <ul v-if="product.highlights.length" class="mt-8 space-y-2">
          <li v-for="highlight in product.highlights" :key="highlight" class="flex gap-2 text-sm text-content">
            <Icon name="ph:check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {{ highlight }}
          </li>
        </ul>
      </div>
    </div>

    <section v-if="product.description" class="mt-14 max-w-3xl">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('product.description') }}</h2>
      <p class="mt-3 whitespace-pre-line text-content">{{ product.description }}</p>
    </section>
  </article>
</template>
