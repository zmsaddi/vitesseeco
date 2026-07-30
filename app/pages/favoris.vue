<script setup lang="ts">
import type { Paginated, ProductSummary } from '~~/server/catalog/types'

/**
 * Saved products.
 *
 * The browser remembers ids; every price and every stock figure shown here is
 * read from the catalogue when the page opens. That is the whole reason the
 * list stores nothing else — see useWishlist.
 */
const wishlist = useWishlist()
const cart = useCart()
const localePath = useLocalePath()
const { locale, t } = useI18n()

const PER_PAGE = 48

/**
 * The listing endpoint filters by category, brand and search term, but not by a
 * set of ids, so the saved products are picked out of the catalogue pages. The
 * bound is what keeps that honest: whatever the catalogue grows to, opening
 * this page costs a fixed, small number of requests rather than one per page of
 * stock. Beyond it the scan is incomplete, and `complete` says so.
 */
const MAX_PAGES = 12

const products = ref<ProductSummary[]>([])
const pending = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  wishlist.restore()
  // The basket also lives in localStorage, and without this the "already in
  // your basket" line reads zero for everything until the visitor clicks
  // something — telling them the opposite of the truth.
  cart.restore()
  await load()
})

function fetchPage(page: number) {
  return $fetch<Paginated<ProductSummary>>('/api/catalog/products', {
    query: { locale: locale.value, page, perPage: PER_PAGE },
  })
}

async function fetchSaved(): Promise<{ found: Map<string, ProductSummary>; complete: boolean }> {
  const wanted = new Set(wishlist.ids.value)

  // The first page reports how many there are; the rest go out together rather
  // than one after another, so the page is not gated on a chain of round trips.
  const first = await fetchPage(1)
  const pages = Math.min(first.totalPages, MAX_PAGES)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) => fetchPage(index + 2))
  )

  const found = new Map<string, ProductSummary>()
  for (const batch of [first, ...rest]) {
    for (const product of batch.items) {
      if (wanted.has(product.id)) found.set(product.id, product)
    }
  }
  return { found, complete: first.totalPages <= MAX_PAGES }
}

async function load(): Promise<void> {
  const saved = wishlist.ids.value
  if (saved.length === 0) {
    products.value = []
    return
  }

  pending.value = true
  error.value = null
  try {
    const { found, complete } = await fetchSaved()

    // The customer's own order — most recently saved first — not the
    // catalogue's.
    products.value = saved
      .map((id) => found.get(id))
      .filter((product): product is ProductSummary => product !== undefined)

    // A product that has left the catalogue is dropped from storage too, so a
    // retired bike does not sit in the list forever holding one of the fifty
    // slots. Only after a complete scan: when the scan was cut short, an absent
    // id means "not looked at", not "gone".
    if (complete) {
      for (const id of saved) {
        if (!found.has(id)) wishlist.remove(id)
      }
    }
  } catch {
    error.value = t('errors.internal')
    products.value = []
  } finally {
    pending.value = false
  }
}

function removeSaved(productId: string): void {
  wishlist.remove(productId)
  // Removing one card says nothing about the other forty-nine, so the list is
  // trimmed in place rather than re-fetched.
  products.value = products.value.filter((product) => product.id !== productId)
}

function addToCart(productId: string): void {
  cart.add(productId, 1)
}

/**
 * How many of this product are already in the basket.
 *
 * Read from the basket itself rather than remembered after a click, so the
 * answer stays right when the customer changes the basket in another tab or
 * comes back to this page later.
 */
function inCart(productId: string): number {
  return cart.lines.value.find((line) => line.productId === productId)?.quantity ?? 0
}

// One visitor's list. There is nothing here for a crawler to index, and an
// indexed one would be somebody else's empty page.
useSeoMeta({ title: () => t('wishlist.title'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-10">
    <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('wishlist.title') }}</h1>
    <p class="mt-2 max-w-2xl text-content-muted">{{ $t('wishlist.intro') }}</p>

    <!-- The list lives in localStorage, so the server cannot render it and any
         server-rendered guess would flash and then be replaced. -->
    <ClientOnly>
      <p v-if="pending" class="mt-10 text-content-muted">{{ $t('common.loading') }}</p>

      <p v-else-if="error" class="mt-10 text-danger">{{ error }}</p>

      <div v-else-if="!products.length" class="mt-10">
        <p class="text-content-muted">{{ $t('wishlist.empty') }}</p>
        <NuxtLink :to="localePath('/produits')" class="btn-primary mt-6">
          {{ $t('cart.browse') }}
        </NuxtLink>
      </div>

      <ul v-else class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="product in products" :key="product.id" class="card flex flex-col overflow-hidden">
          <NuxtLink :to="localePath(`/produits/${product.slug}`)" class="group block">
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
          </NuxtLink>

          <div class="flex flex-1 flex-col p-4">
            <NuxtLink :to="localePath(`/produits/${product.slug}`)" class="font-medium text-content-strong">
              {{ product.name }}
            </NuxtLink>
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
            <!-- Worth saying on this page in particular: the customer saved it
                 rather than buying it, and there may not be one left next time. -->
            <p v-else-if="product.available <= 3" class="mt-1 text-sm text-warning">
              {{ $t('cart.only_left', { count: product.available }) }}
            </p>

            <p v-if="inCart(product.id)" class="mt-1 text-sm text-success">
              {{ $t('wishlist.in_cart', { count: inCart(product.id) }) }}
            </p>

            <div class="mt-auto flex items-center gap-3 pt-4">
              <button
                type="button"
                class="btn-primary flex-1"
                :disabled="product.available <= 0"
                :aria-label="$t('wishlist.add_item', { name: product.name })"
                @click="addToCart(product.id)"
              >
                {{ $t('product.add_to_cart') }}
              </button>
              <button
                type="button"
                class="text-sm text-content-muted hover:text-danger"
                :aria-label="$t('wishlist.remove_item', { name: product.name })"
                @click="removeSaved(product.id)"
              >
                {{ $t('cart.remove') }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </ClientOnly>
  </div>
</template>
