<script setup lang="ts">
import type { ProductDetail } from '~~/server/catalog/types'
import { localizedUrl, type LocaleCode } from '~~/shared/locales'
import { ORGANISATION, RETURN_POLICY, SITE_URL } from '~~/shared/organisation'
import { marketForLocale } from '~~/shared/markets'

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

/**
 * Set before the first await on purpose. `useState` after an await has lost the
 * Nuxt instance and hands back a detached ref that never reaches the head —
 * the canonical would silently stop being written.
 */
const canonicalOverride = useState<string | null>('canonical-override', () => null)

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

/**
 * One canonical for a model, not one per colour.
 *
 * Six colours of the same bike are near-identical pages, and Search Console was
 * reporting exactly that on the live site: "duplicate, submitted URL not
 * selected as canonical". Pointing the family at one URL stops them competing
 * with each other for the same query. The choice is alphabetical among the
 * family so that every colour agrees on the same winner — a rule that depended
 * on which page you were standing on would produce a canonical loop.
 */
const canonicalSlug = computed(() => {
  const item = product.value
  if (!item) return ''
  if (!item.modelFamily) return item.slug
  const family = [item.slug, ...item.siblings.map((sibling) => sibling.slug)].filter(Boolean)
  return family.sort((a, b) => a.localeCompare(b))[0] ?? item.slug
})

watchEffect(() => {
  canonicalOverride.value = canonicalSlug.value
    ? localizedUrl(`/produits/${canonicalSlug.value}`, locale.value as LocaleCode)
    : null
})

// Left behind, the override would follow the visitor onto the next page and
// canonicalise it to a product.
onUnmounted(() => {
  canonicalOverride.value = null
})

/**
 * A description built from this product's own attributes.
 *
 * The previous build ran a generator that wrote one identical truncated line to
 * all 145 products, which is what made every colour of a model look like a
 * duplicate to Google in the first place.
 */
const metaDescription = computed(() => {
  const item = product.value
  if (!item) return ''
  if (item.seo.description) return item.seo.description
  const specs = [
    item.specifications.motor,
    item.specifications.battery,
    item.specifications.range,
  ].filter(Boolean).join(' · ')
  return [item.shortDescription, specs, item.color ? `${item.color}.` : '']
    .filter(Boolean)
    .join(' ')
    .slice(0, 300)
})

useSeoMeta({
  title: () => product.value?.seo.title || product.value?.name || '',
  description: () => metaDescription.value,
  ogImage: () => product.value?.image?.url ?? '',
  ogType: 'website',
})

/**
 * Structured data, built from what the page actually shows.
 *
 * A price or an availability that differs between the markup and the visible
 * page is a Shopping disapproval, so both come from the same object. The
 * shipping and return blocks are here because Google renders them directly in
 * the Shopping result — an offer without them looks less trustworthy beside one
 * that has them, and free delivery is the strongest thing this shop can say.
 */
useHead(() => {
  const item = product.value
  if (!item) return {}

  const url = localizedUrl(`/produits/${item.slug}`, locale.value as LocaleCode)
  const market = marketForLocale(locale.value as LocaleCode)

  const shippingDetails = ORGANISATION.deliversTo.map((country) => ({
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      // Free where the own fleet goes. Claiming free delivery anywhere else
      // would be a promise the checkout refuses.
      value: '0.00',
      currency: 'EUR',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: country,
      // France is department 86 only; the rest of the country collects in store.
      ...(country === 'FR' ? { postalCodePrefix: ['86'] } : {}),
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' },
    },
  }))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: item.name,
        image: item.images.map((image) => image.url),
        description: metaDescription.value || undefined,
        sku: item.sku ?? undefined,
        gtin13: item.gtin ?? undefined,
        mpn: item.manufacturerMpn ?? undefined,
        color: item.color ?? undefined,
        // Ties the colours of one model together, the same grouping the
        // Merchant feed uses as item_group_id.
        inProductGroupWithID: item.modelFamily ?? undefined,
        brand: item.brand ? { '@type': 'Brand', name: item.brand.name } : undefined,
        offers: {
          '@type': 'Offer',
          url,
          price: (item.price / 100).toFixed(2),
          priceCurrency: 'EUR',
          itemCondition: 'https://schema.org/NewCondition',
          availability:
            item.available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: { '@id': `${SITE_URL}/#organization` },
          eligibleRegion: { '@type': 'Country', name: market.country },
          shippingDetails,
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: RETURN_POLICY.applicableCountries,
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: RETURN_POLICY.returnDays,
            returnMethod: 'https://schema.org/ReturnByMail',
            returnFees: RETURN_POLICY.returnFeesCustomerResponsibility
              ? 'https://schema.org/ReturnShippingFees'
              : 'https://schema.org/FreeReturn',
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: localizedUrl('/', locale.value as LocaleCode) },
          { '@type': 'ListItem', position: 2, name: t('nav.products'), item: localizedUrl('/produits', locale.value as LocaleCode) },
          { '@type': 'ListItem', position: 3, name: item.name, item: url },
        ],
      },
    ],
  }

  return {
    script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd) }],
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
