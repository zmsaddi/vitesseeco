<script setup lang="ts">
import type { ProductDetail } from '~~/server/catalog/types'
import { localizedUrl, type LocaleCode } from '~~/shared/locales'
import { ORGANISATION, RETURN_POLICY, SITE_URL } from '~~/shared/organisation'
import { marketForLocale } from '~~/shared/markets'
import { groupId } from '~~/shared/product-group'

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
const { formatCents } = useFormatPrice()
const cart = useCart()
const wishlist = useWishlist()

onMounted(wishlist.restore)

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
const cartFull = ref(false)

/**
 * The specification rows worth showing.
 *
 * Only fields the product actually carries: an empty row reads as a gap in the
 * data rather than as an absent feature. The three numeric fields carry their
 * unit here, because a bare "25" tells a customer nothing.
 */
const visibleSpecs = computed(() => {
  const s = product.value?.specifications
  if (!s) return []
  const withUnit = (value: number | null, unit: string) =>
    value === null || value === undefined ? null : `${value} ${unit}`
  const rows: Array<{ key: string; value: string | null }> = [
    { key: 'motor', value: s.motor },
    { key: 'battery', value: s.battery },
    { key: 'range', value: s.range },
    { key: 'maxSpeed', value: withUnit(s.maxSpeed, 'km/h') },
    { key: 'brakeType', value: s.brakeType },
    { key: 'suspension', value: s.suspension },
    { key: 'gears', value: s.gears },
    { key: 'tireSize', value: s.tireSize },
    { key: 'frame', value: s.frame },
    { key: 'weight', value: withUnit(s.weight, 'kg') },
    { key: 'maxLoad', value: withUnit(s.maxLoad, 'kg') },
    { key: 'chargeTime', value: s.chargeTime },
    { key: 'dimensions', value: s.dimensions },
  ]
  return rows.filter((row): row is { key: string; value: string } => Boolean(row.value))
})

/** Resolved once so the template never indexes an array that may be empty. */
/**
 * Every colour of the model, the CURRENT one included and marked. The list
 * used to show only the siblings — on a three-colour model the customer saw
 * two chips and never the one they were on, which read as "there are two
 * other products" rather than "you are here". Sorted by name so the order is
 * identical from every colour's page instead of jumping on each switch.
 */
const colourways = computed(() => {
  if (!product.value) return []
  const entries = [
    {
      id: product.value.id,
      slug: product.value.slug,
      name: product.value.name,
      color: product.value.color,
      colorHex: product.value.colorHex,
      current: true,
    },
    ...product.value.siblings.map((sibling) => ({ ...sibling, current: false })),
  ]
  return entries.sort((a, b) => (a.color ?? a.name).localeCompare(b.color ?? b.name, 'fr'))
})

const activeImage = computed(() => product.value?.images[selectedImage.value] ?? product.value?.image ?? null)

watch(product, () => {
  selectedImage.value = 0
  quantity.value = 1
})

function addToCart(): void {
  if (!product.value) return
  // The basket silently refuses a 21st line. Announcing success anyway told the
  // customer their bike was in a cart it had never entered.
  const accepted = cart.add(product.value.id, quantity.value)
  if (!accepted) {
    cartFull.value = true
    setTimeout(() => { cartFull.value = false }, 4000)
    return
  }
  added.value = true
  setTimeout(() => {
    added.value = false
  }, 2500)
}

/**
 * Every colour is its own canonical page.
 *
 * This used to point all colours of a model at whichever slug sorted first
 * alphabetically — a well-meant answer to Search Console reporting "duplicate,
 * submitted URL not selected as canonical" on the live site. But the fix was
 * applied in exactly one of the six places that state a product's identity, and
 * the result was worse than either strategy on its own: the black bike's page
 * declared the blue one canonical, while the sitemap submitted the black URL,
 * hreflang self-referenced it, and the Merchant feed sold it under its own
 * g:id. The shop was handing Google a URL that disowned itself.
 *
 * Self-canonical is the only reading consistent with everything else this
 * system does: one product is one colour, each colour carries its own price,
 * its own stock and its own feed entry, and Merchant requires a landing page
 * that is the product's own. Duplicate-content clustering is answered where it
 * should be — by pages that genuinely differ, which is why the specifications
 * and the colour now render — and by the sibling links below.
 *
 * If Search Console later shows these clustering again, the alternative is a
 * family canonical applied to ALL SIX places at once, never to one of them.
 */
watchEffect(() => {
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

  /**
   * Delivery, taken from the same shipping documents the checkout quotes and the
   * Merchant feed advertises.
   *
   * It used to be built from a hardcoded list of three countries while the feed
   * advertised six — so Google was handed two different delivery footprints for
   * one product, and Spain, added at 149 EUR, appeared in neither the page nor
   * the reader's understanding of it. A price stated here that the till would
   * refuse is exactly what Merchant suspends an account for.
   */
  const coverage = item.deliveryCoverage ?? []
  const shippingDetails = coverage.map(({ country, priceCents }) => ({
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: (priceCents / 100).toFixed(2), // invariant-ok: schema.org money is machine format, dot-decimal by spec
      currency: 'EUR',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: country,
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
        // Ties the colours of one model together, and it must be the SAME
        // string the Merchant feed emits as item_group_id — Search and Merchant
        // reading two different group ids for one model is two groups. Shortening
        // the feed value to Google's 50-character limit without shortening this
        // one is exactly how they drifted apart.
        inProductGroupWithID: item.modelFamily ? groupId(item.modelFamily) : undefined,
        // Google's documented shape for a variant on its own URL: the variant
        // names its group and what varies. Six colours become six colours of one
        // model rather than six pages competing as duplicates — which is the
        // problem the old family-canonical was reaching for, solved the way the
        // documentation says to solve it.
        isVariantOf: item.modelFamily
          ? {
              '@type': 'ProductGroup',
              productGroupID: groupId(item.modelFamily),
              name: item.name,
              variesBy: 'https://schema.org/color',
            }
          : undefined,
        brand: item.brand ? { '@type': 'Brand', name: item.brand.name } : undefined,
        offers: {
          '@type': 'Offer',
          url,
          // invariant-ok: schema.org offers.price is machine format, dot-decimal by spec
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
  <article v-if="product" class="container-page py-10 pb-28 lg:pb-10">
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
          <span class="text-3xl font-bold text-accent">{{ formatCents(product.price) }}</span>
          <span v-if="product.compareAtPrice" class="text-lg text-content-muted line-through">
            {{ formatCents(product.compareAtPrice) }}
          </span>
        </p>

        <p v-if="product.shortDescription" class="mt-4 text-content">{{ product.shortDescription }}</p>

        <p class="mt-4 text-sm" :class="product.available > 0 ? 'text-success' : 'text-danger'">
          {{ product.available > 0 ? $t('product.in_stock', { count: product.available }) : $t('products.out_of_stock') }}
        </p>

        <div v-if="colourways.length > 1" class="mt-6">
          <h2 class="text-sm font-semibold text-content-strong">{{ $t('product.other_colours') }}</h2>
          <ul class="mt-2 flex flex-wrap gap-2">
            <li v-for="way in colourways" :key="way.id">
              <span
                v-if="way.current"
                class="btn-secondary h-11 cursor-default border-accent px-3 text-xs ring-1 ring-accent"
                aria-current="true"
              >
                <span
                  v-if="way.colorHex"
                  class="h-4 w-4 rounded-full border border-surface-border"
                  :style="{ backgroundColor: way.colorHex }"
                  aria-hidden="true"
                />
                {{ way.color ?? way.name }}
                <Icon name="ph:check-bold" class="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              </span>
              <NuxtLink v-else :to="localePath(`/produits/${way.slug}`)" class="btn-secondary h-11 px-3 text-xs">
                <span
                  v-if="way.colorHex"
                  class="h-4 w-4 rounded-full border border-surface-border"
                  :style="{ backgroundColor: way.colorHex }"
                  aria-hidden="true"
                />
                {{ way.color ?? way.name }}
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

          <!--
            The wishlist had storage, a page and a composable, and not one
            control anywhere in the shop could put anything into it. This is
            that control.
          -->
          <button
            type="button"
            class="btn-secondary shrink-0 px-4"
            :aria-pressed="wishlist.has(product.id)"
            :aria-label="$t('wishlist.save_item', { name: product.name })"
            @click="wishlist.toggle(product.id)"
          >
            <Icon
              :name="wishlist.has(product.id) ? 'ph:heart-fill' : 'ph:heart'"
              class="h-5 w-5"
              :class="wishlist.has(product.id) ? 'text-accent' : ''"
            />
            <span class="ms-2 hidden sm:inline">
              {{ wishlist.has(product.id) ? $t('wishlist.saved') : $t('wishlist.save') }}
            </span>
          </button>
        </div>

        <p v-if="cartFull" role="alert" class="mt-3 text-sm text-danger">
          {{ $t('cart.full') }}
        </p>

        <ul v-if="product.highlights.length" class="mt-8 space-y-2">
          <li v-for="highlight in product.highlights" :key="highlight" class="flex gap-2 text-sm text-content">
            <Icon name="ph:check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {{ highlight }}
          </li>
        </ul>
      </div>
    </div>

    <!-- On a phone the gallery fills the first screen and the buy button lands
         below the fold — the eye-walk screenshots showed exactly that. This bar
         keeps the decision (price) and the action (add) under the thumb at all
         times. Desktop keeps the in-page button. -->
    <div
      class="fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface-raised/95 px-4 py-3 backdrop-blur lg:hidden"
      :style="{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }"
    >
      <div class="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-xs text-content-muted">{{ product.name }}</p>
          <p class="text-lg font-bold text-accent">{{ formatCents(product.price) }}</p>
        </div>
        <button
          type="button"
          class="btn-primary shrink-0 px-6"
          :disabled="product.available <= 0"
          @click="addToCart"
        >
          {{ added ? $t('product.added') : product.available > 0 ? $t('product.add_to_cart') : $t('products.out_of_stock') }}
        </button>
      </div>
    </div>

    <section v-if="product.description" class="mt-14 max-w-3xl">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('product.description') }}</h2>
      <p class="mt-3 whitespace-pre-line text-content">{{ product.description }}</p>
    </section>

    <!--
      The specifications were already being collected — and spent entirely on
      the meta description Google reads. A customer deciding on a 1 349 € bike
      could not see its motor, its battery or its range anywhere on the page
      that sells it.
    -->
    <section v-if="visibleSpecs.length" class="mt-14 max-w-3xl">
      <h2 class="font-display text-xl font-bold text-content-strong">
        {{ $t('product.specifications') }}
      </h2>
      <dl class="mt-4 divide-y divide-surface-border border-y border-surface-border">
        <div v-for="spec in visibleSpecs" :key="spec.key" class="flex justify-between gap-6 py-3">
          <dt class="text-content-muted">{{ $t(`product.spec.${spec.key}`) }}</dt>
          <dd class="text-end font-medium text-content-strong">{{ spec.value }}</dd>
        </div>
      </dl>
    </section>
  </article>
</template>
