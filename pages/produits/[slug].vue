<template>
  <div class="py-8 md:py-12">
    <div class="container-custom" v-if="product">
      <!-- Breadcrumb (DS v2) -->
      <div class="mb-6">
        <Breadcrumbs :items="[
          { label: $t('nav.home'), to: localePath('/') },
          { label: $t('nav.products'), to: localePath('/produits') },
          { label: l(product.name) },
        ]" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <!-- ═══ Gallery ═══ -->
        <div class="space-y-4">
          <div ref="galleryContainer" class="card aspect-square bg-dark-tertiary overflow-hidden relative touch-pan-y">
            <template v-if="product.images?.length">
              <img
                v-for="(img, i) in product.images"
                :key="i"
                :src="useSanityImageUrl(img, 800, 800)"
                :alt="img.altText || l(product.name)"
                width="800" height="800"
                class="absolute inset-0 w-full h-full object-contain bg-dark-tertiary transition-opacity duration-300"
                :class="i === selectedImage ? 'opacity-100' : 'opacity-0'"
              />
              <button v-if="product.images?.length > 1" @click="selectedImage = (selectedImage - 1 + product.images?.length) % product.images?.length"
                :aria-label="$t('product.previous_image')"
                class="absolute ltr:left-2 rtl:right-2 top-1/2 -translate-y-1/2 w-touch h-touch bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 z-10">
                <Icon name="ph:caret-left" class="w-5 h-5" />
              </button>
              <button v-if="product.images?.length > 1" @click="selectedImage = (selectedImage + 1) % product.images?.length"
                :aria-label="$t('product.next_image')"
                class="absolute ltr:right-2 rtl:left-2 top-1/2 -translate-y-1/2 w-touch h-touch bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 z-10">
                <Icon name="ph:caret-right" class="w-5 h-5" />
              </button>
              <div class="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                <button v-for="(_, i) in product.images" :key="i" @click="selectedImage = Number(i)"
                  :aria-label="$t('product.image_number', { n: Number(i) + 1 })" :aria-current="i === selectedImage ? 'true' : undefined"
                  class="w-2 h-2 rounded-full transition-all" :class="i === selectedImage ? 'bg-accent w-5' : 'bg-white/50'" />
              </div>
            </template>
            <div v-else class="absolute inset-0 flex items-center justify-center">
              <Icon name="ph:package" class="w-32 h-32 text-dark-tertiary/50" />
            </div>
          </div>
          <!-- Thumbnails -->
          <div v-if="product.images?.length > 1" class="grid grid-cols-5 gap-2">
            <button v-for="(img, i) in product.images?.slice(0, 10)" :key="i" @click="selectedImage = Number(i)"
              :aria-label="$t('product.image_number', { n: Number(i) + 1 })"
              class="card aspect-square bg-dark-tertiary cursor-pointer overflow-hidden border-2 transition-colors"
              :class="selectedImage === i ? 'border-accent' : 'border-transparent hover:border-accent/30'">
              <img :src="useSanityImageUrl(img, 150, 150)" :alt="img.altText || l(product.name)" width="150" height="150" loading="lazy" class="w-full h-full object-cover" />
            </button>
          </div>
        </div>

        <!-- ═══ Buy box column ═══ -->
        <div>
          <p v-if="product.brand?.name" class="text-text-secondary text-sm mb-1">{{ product.brand.name }}</p>
          <div class="flex items-center gap-2 mb-2">
            <span v-if="product.isFeatured" class="badge-bestseller">⭐ {{ $t('product.bestseller') }}</span>
            <span v-if="product.isOnSale" class="badge-promo">{{ $t('product.on_sale') }}</span>
            <span v-if="product.isNew" class="badge-new">{{ $t('product.new') }}</span>
          </div>

          <h1 class="font-display text-2xl md:text-3xl font-bold text-white mb-4">{{ l(product.name) }}</h1>

          <!-- THE BUY BOX: everything needed to decide, in one bordered card -->
          <div class="card p-5 border-accent/20 space-y-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <PriceTag :price="product.price" :compare-at="product.compareAtPrice" size="lg" />
              <StockBadge :stock="product.stock" />
            </div>

            <!-- Colors of the same model (System B) -->
            <div v-if="otherColors.length">
              <p class="text-sm font-medium text-text-secondary mb-2">
                {{ $t('product.other_colors') }}<template v-if="l(product.color)"> — <span class="text-white">{{ l(product.color) }}</span></template>
              </p>
              <div class="flex gap-3 flex-wrap">
                <span class="w-11 h-11 rounded-full border-2 border-accent scale-110"
                  :style="{ backgroundColor: product.colorHex }" :title="l(product.color)" role="img" :aria-label="$t('product.current_color', { color: l(product.color) })" />
                <NuxtLink v-for="c in otherColors" :key="c._id" :to="localePath(`/produits/${c.slug?.current}`)"
                  :aria-label="$t('product.switch_color', { color: l(c.color) })"
                  class="w-11 h-11 rounded-full border-2 border-dark-tertiary hover:border-accent transition-all hover:scale-110"
                  :style="{ backgroundColor: c.colorHex }" :title="l(c.color)" />
              </div>
            </div>

            <!-- Quantity + CTA -->
            <template v-if="product.stock > 0">
              <div class="flex items-center gap-3">
                <label for="product-qty" class="text-sm font-medium text-text-secondary">{{ $t('cart.quantity') }}</label>
                <div class="flex items-center gap-1">
                  <button @click="qty = Math.max(1, qty - 1)" :aria-label="$t('cart.decrease_quantity')" class="w-touch h-touch min-w-10 min-h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent">
                    <Icon name="ph:minus" class="w-4 h-4" />
                  </button>
                  <input id="product-qty" type="number" v-model.number="qty" :max="Math.min(10, product.stock)" min="1" :aria-label="$t('cart.quantity')" class="w-12 text-center font-semibold text-lg bg-transparent border-none outline-none text-white" />
                  <button @click="qty = Math.min(Math.min(10, product.stock), qty + 1)" :aria-label="$t('cart.increase_quantity')" class="w-touch h-touch min-w-10 min-h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent">
                    <Icon name="ph:plus" class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div class="flex gap-2.5">
                <button @click="addToCart" class="btn-primary flex-1 text-lg py-4 flex items-center justify-center gap-3">
                  <Icon name="ph:shopping-cart" class="w-5 h-5" /> {{ $t('product.add_to_cart') }}
                </button>
                <ClientOnly>
                  <button
                    type="button"
                    class="w-14 shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors min-h-touch"
                    :class="inWishlist ? 'border-accent text-accent bg-accent/10' : 'border-dark-tertiary text-text-secondary hover:border-accent hover:text-accent'"
                    :aria-label="inWishlist ? $t('wishlist.removed') : $t('wishlist.added')"
                    :aria-pressed="inWishlist"
                    @click="toggleWishlist"
                  >
                    <Icon :name="inWishlist ? 'ph:heart-fill' : 'ph:heart'" class="w-6 h-6" />
                  </button>
                </ClientOnly>
              </div>
            </template>
            <template v-else>
              <button disabled class="w-full text-lg py-4 flex items-center justify-center gap-3 bg-red-900/30 text-red-400 rounded-lg cursor-not-allowed border border-red-800/50">
                <Icon name="ph:x-circle" class="w-5 h-5" /> {{ $t('product.out_of_stock') }}
              </button>
              <NuxtLink :to="localePath('/contact')" class="btn-outline w-full text-center block">{{ $t('product.contact_us') }}</NuxtLink>
            </template>

            <!-- Trust row: the four answers every buyer wants before clicking -->
            <div class="grid grid-cols-2 gap-2.5 pt-3 border-t border-dark-tertiary text-xs text-text-secondary">
              <span class="flex items-center gap-2"><Icon name="ph:truck" class="w-4 h-4 text-accent shrink-0" /> {{ $t('product.delivery_estimate') }}</span>
              <span class="flex items-center gap-2"><Icon name="ph:shield-check" class="w-4 h-4 text-accent shrink-0" /> {{ l(product.warranty) || $t('trust.warranty') }}</span>
              <span class="flex items-center gap-2"><Icon name="ph:arrow-u-up-left" class="w-4 h-4 text-accent shrink-0" /> {{ $t('trust.returns_14') }}</span>
              <span class="flex items-center gap-2"><Icon name="ph:storefront" class="w-4 h-4 text-accent shrink-0" /> {{ $t('trust.pickup_poitiers') }}</span>
            </div>
          </div>

          <!-- Highlights -->
          <div v-if="product.highlights?.length" class="mt-6">
            <h2 class="font-display text-lg font-semibold text-white mb-3">{{ $t('product.highlights') }}</h2>
            <ul class="space-y-2">
              <li v-for="(h, i) in product.highlights" :key="i" class="flex items-start gap-2 text-text-secondary text-sm">
                <Icon name="ph:check-circle" class="w-4 h-4 text-accent shrink-0 mt-0.5" /> <span>{{ l(h) }}</span>
              </li>
            </ul>
          </div>

          <!-- Video -->
          <div v-if="product.videoUrl" class="mt-4">
            <a :href="product.videoUrl" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-accent hover:underline text-sm">
              <Icon name="ph:play-circle" class="w-5 h-5" /> {{ $t('product.watch_video') }}
            </a>
          </div>
        </div>
      </div>

      <!-- ═══ Below the fold: description + specs, full width, scannable ═══ -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mt-12">
        <div v-if="l(product.description)">
          <h2 class="font-display text-xl font-semibold text-white mb-3">{{ $t('product.description') }}</h2>
          <p class="text-text-secondary leading-relaxed whitespace-pre-line">{{ l(product.description) }}</p>
        </div>
        <div v-if="specRows.length">
          <h2 class="font-display text-xl font-semibold text-white mb-4">{{ $t('product.specifications') }}</h2>
          <div class="card divide-y divide-dark-tertiary/50">
            <div v-for="spec in specRows" :key="spec.label" class="flex justify-between px-4 py-3 gap-4">
              <span class="text-text-secondary text-sm">{{ $t(spec.label) }}</span>
              <span class="text-white text-sm font-medium text-end">{{ spec.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Other Colors Section -->
      <section class="mt-16" v-if="otherColors.length">
        <h2 class="section-title mb-8">{{ $t('product.other_colors') }}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <NuxtLink v-for="c in otherColors" :key="c._id" :to="localePath(`/produits/${c.slug?.current}`)">
            <ProductCard :product="c" />
          </NuxtLink>
        </div>
      </section>

      <!-- Recently viewed (U-M1) -->
      <ClientOnly><RecentlyViewed :exclude-slug="slug" /></ClientOnly>

      <!-- Testimonials -->
      <section class="mt-16" v-if="testimonials?.length">
        <h2 class="section-title mb-8">{{ $t('product.reviews') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div v-for="review in testimonials" :key="review._id" class="card p-6">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Icon name="ph:user" class="w-5 h-5 text-accent" />
              </div>
              <div>
                <p class="text-white font-medium text-sm">{{ review.customerName }}</p>
                <div class="flex gap-0.5">
                  <Icon v-for="s in 5" :key="s" name="ph:star-fill" class="w-3.5 h-3.5" :class="s <= (review.rating || 5) ? 'text-gold' : 'text-dark-tertiary'" />
                </div>
              </div>
            </div>
            <p class="text-text-secondary text-sm leading-relaxed">{{ l(review.text) }}</p>
          </div>
        </div>
      </section>
    </div>

    <!-- Loading Skeleton -->
    <div v-else class="container-custom py-8 animate-pulse">
      <div class="h-4 bg-dark-tertiary rounded w-48 mb-8" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <div class="space-y-4">
          <div class="aspect-square bg-dark-tertiary rounded-xl" />
          <div class="grid grid-cols-5 gap-2">
            <div v-for="i in 5" :key="i" class="aspect-square bg-dark-tertiary rounded-lg" />
          </div>
        </div>
        <div class="space-y-4">
          <div class="h-3 bg-dark-tertiary rounded w-24" />
          <div class="h-8 bg-dark-tertiary rounded w-3/4" />
          <div class="h-48 bg-dark-tertiary rounded-xl w-full" />
          <div class="space-y-3 mt-8">
            <div class="h-4 bg-dark-tertiary rounded w-full" />
            <div class="h-4 bg-dark-tertiary rounded w-5/6" />
          </div>
        </div>
      </div>
    </div>

    <!-- P3-02: sticky mobile CTA — price + add-to-cart always reachable.
         Padding-safe-area for iPhones; clearance for the chat launcher. -->
    <div
      v-if="product && product.stock > 0"
      class="lg:hidden fixed bottom-0 left-0 right-0 z-banner bg-primary/95 backdrop-blur-md border-t border-dark-tertiary px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pe-20 flex items-center gap-3 shadow-2xl"
    >
      <div class="flex-1 min-w-0">
        <p class="text-text-secondary text-xs truncate">{{ l(product.name) }}</p>
        <PriceTag :price="product.price" :compare-at="product.compareAtPrice" size="sm" />
      </div>
      <button
        @click="addToCart"
        class="btn-primary btn-sm shrink-0 flex items-center gap-2 min-h-touch"
        :aria-label="$t('product.add_to_cart')"
      >
        <Icon name="ph:shopping-cart" class="w-4 h-4" />
        {{ $t('product.add_to_cart') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const route = useRoute()
const cart = useCartStore()
const cartOpen = useState('cartOpen', () => false)
const toast = useToast()

const selectedImage = ref(0)
const qty = ref(1)
const galleryContainer = ref<HTMLElement>()
const slug = computed(() => route.params.slug as string)

// Declared before the first await: useState needs the Nuxt app context, and
// after an await in setup that context is gone — the call then yields a
// detached ref, so app.vue never sees what this page writes to it.
const canonicalOverride = useState<string | null>('canonical-override', () => null)

useSwipe(galleryContainer, {
  onLeft: () => { if (product.value?.images?.length && product.value.images.length > 1) selectedImage.value = (selectedImage.value + 1) % product.value.images.length },
  onRight: () => { if (product.value?.images?.length && product.value.images.length > 1) selectedImage.value = (selectedImage.value - 1 + product.value.images.length) % product.value.images.length },
})

const specVal = (v: any) => typeof v === 'object' && v !== null ? l(v) : v

// Single query: product + other colors + testimonials.
// isAvailable mirrors the listing filter — a retired product must 404, not keep a live buy box.
// defined(modelFamily) is required: in GROQ null == null, so family-less
// products would otherwise list each other as colors of the same model.
const productQuery = groq`{
  "product": *[_type == "product" && slug.current == $slug && isAvailable == true][0] {
    _id, name, slug, shortDescription, description, price,
    "compareAtPrice": select(compareAtPrice > price => compareAtPrice, null),
    isOnSale, isNew, isFeatured, isAvailable, warranty, highlights, videoUrl,
    productType, color, colorHex, stock, modelFamily, seo,
    specifications, brand->{ name },
    "images": images[]{asset, altText}
  },
  "otherColors": *[_type == "product" && defined(modelFamily) && modelFamily == *[_type == "product" && slug.current == $slug][0].modelFamily && slug.current != $slug && isAvailable == true] | order(sortOrder asc) {
    _id, name, slug, price, color, colorHex, stock, sortOrder, brand->{ name },
    "images": images[0..0]{asset}
  },
  "testimonials": *[_type == "testimonial"] | order(rating desc)[0..4] {
    _id, customerName, rating, text
  }
}`
const { data: pageData, status } = await useSanityFetch(() => `product-page-${slug.value}`, productQuery, { slug })

const product = computed(() => pageData.value?.product || null)
const otherColors = computed(() => pageData.value?.otherColors || [])
const testimonials = computed(() => pageData.value?.testimonials || [])

// 404 — the fetch is awaited, so status is already settled here. On the client
// the watcher must run immediately too: in SPA mode nothing changes afterwards.
if (import.meta.server && status.value === 'success' && !product.value) throw createError({ statusCode: 404 })
if (import.meta.client) { watch([status, product], () => { if (status.value === 'success' && !product.value) showError({ statusCode: 404 }) }, { immediate: true }) }

watch(() => product.value?._id, () => { selectedImage.value = 0; qty.value = 1 })

// U-M2: wishlist toggle from the buy box.
const wishlist = useWishlist()
onMounted(wishlist.load)
const inWishlist = computed(() => (product.value ? wishlist.has(product.value._id) : false))
function toggleWishlist() {
  const p = product.value
  if (!p) return
  const added = wishlist.toggle({
    id: p._id,
    name: l(p.name) || '',
    slug: p.slug?.current || '',
    price: p.price,
    image: p.images?.[0]?.asset ? useSanityImageUrl(p.images[0], 320, 320) : '',
    stock: p.stock ?? 0,
  })
  toast.info(added ? t('wishlist.added') : t('wishlist.removed'))
}

// U-M1: record every viewed product for the recently-viewed strip.
const { record } = useRecentlyViewed()
watch(product, (p) => {
  if (!p || import.meta.server) return
  record({
    id: p._id,
    name: l(p.name) || '',
    slug: p.slug?.current || '',
    price: p.price,
    image: p.images?.[0]?.asset ? useSanityImageUrl(p.images[0], 320, 320) : '',
    stock: p.stock ?? 0,
  })
}, { immediate: true })

// Specs
const specRows = computed(() => {
  const s = product.value?.specifications
  if (!s) return []
  const all = [
    { key: 'motor', label: 'product.motor' },
    { key: 'battery', label: 'product.battery' },
    { key: 'tireSize', label: 'product.tire_size' },
    { key: 'range', label: 'product.range' },
    { key: 'brakeType', label: 'product.brake_type' },
    { key: 'maxSpeed', label: 'product.max_speed', suffix: ' km/h' },
    { key: 'weight', label: 'product.weight', suffix: ' kg' },
    { key: 'maxLoad', label: 'product.max_load', suffix: ' kg' },
    { key: 'suspension', label: 'product.suspension' },
    { key: 'frame', label: 'product.frame' },
    { key: 'gears', label: 'product.gears' },
    { key: 'chargeTime', label: 'product.charge_time' },
    { key: 'dimensions', label: 'product.dimensions' },
    { key: 'grossWeight', label: 'product.gross_weight', suffix: ' kg' },
    { key: 'packingSize', label: 'product.packing_size' },
  ]
  return all.filter(spec => {
    const val = s[spec.key]
    if (val === null || val === undefined || val === '' || val === 0) return false
    if (typeof val === 'object') return !!specVal(val)
    return true
  }).map(spec => {
    const val = specVal(s[spec.key])
    return { label: spec.label, value: spec.suffix ? `${val}${spec.suffix}` : val }
  })
})

function addToCart() {
  if (!product.value) return
  const imgUrl = product.value.images?.[0]?.asset ? useSanityImageUrl(product.value.images[0], 150, 150) : ''
  cart.addItem({
    productId: product.value._id,
    name: product.value.name,
    slug: product.value.slug?.current || '',
    price: product.value.price,
    colorHex: product.value.colorHex || '#000',
    colorName: product.value.color || { fr: '' },
    sku: product.value.slug?.current || product.value._id,
    image: imgUrl,
  }, qty.value)
  cartOpen.value = true
  qty.value = 1
  // P2-10: unified toast system replaces the old page-local toast.
  toast.success(`${t('product.add_to_cart')} ✓`)
}

// SEO
/**
 * The canonical URL for this model.
 *
 * Colour variants are separate documents under System B, so one bike can be six
 * near-identical pages. Google collapses those to a single canonical of its own
 * choosing and ignores the rest — which splits the ranking signal for the model
 * name and then throws most of it away. Pointing every colour at one primary
 * concentrates that signal on a single strong URL.
 *
 * The primary is deterministic — lowest sortOrder, then lowest slug — so every
 * variant of a family computes the same answer and the cluster never disagrees.
 */
const canonicalSlug = computed(() => {
  const p = product.value
  if (!p?.modelFamily) return p?.slug?.current ?? ''

  const family = [
    { slug: p.slug?.current ?? '', sortOrder: p.sortOrder ?? 0 },
    ...otherColors.value.map((c: any) => ({ slug: c.slug?.current ?? '', sortOrder: c.sortOrder ?? 0 })),
  ].filter((entry) => entry.slug)

  family.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
  return family[0]?.slug ?? p.slug?.current ?? ''
})

/**
 * A description that actually distinguishes this page.
 *
 * The stored seo.description is used only when it is not the shared family
 * boilerplate: every product in the catalogue currently carries the same
 * truncated string ("… et batterie ", value missing), which is precisely what
 * makes six colour pages look like one to a search engine. Anything generic is
 * rebuilt from the product's own data.
 */
const seoDescription = computed(() => {
  if (!product.value) return ''
  const p = product.value
  const stored = (p.seo?.description || '').trim()

  const name = l(p.name) || ''
  const colour = l(p.color) || ''
  const brand = p.brand?.name || ''
  const specs = [
    p.specifications?.motor,
    p.specifications?.battery,
    l(p.specifications?.range),
  ].filter(Boolean).join(' · ')

  // Product names usually already open with the brand ("OUXI V8 Ultra Mini"),
  // so prefixing it again reads as a stutter and wastes the first words of a
  // snippet, which are the ones that get read.
  const brandPrefix = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ` : ''
  // The colour is already in the name too, for the same reason.
  const colourSuffix = colour && !name.toLowerCase().includes(colour.toLowerCase()) ? `Coloris ${colour}.` : ''

  const generated = [
    `${brandPrefix}${name}.`,
    colourSuffix,
    specs ? `${specs}.` : '',
    `${p.price}€ — livraison par nos soins, garantie constructeur.`,
  ].filter(Boolean).join(' ')

  // A stored value is trusted only if it is substantial and not the truncated
  // template, which is recognisable by ending mid-sentence.
  const looksGeneric = stored.length < 60 || /\s$/.test(p.seo?.description || '') || !/[.!?]$/.test(stored)
  return (looksGeneric ? generated : stored).slice(0, 300)
})

// Nominate the model's primary URL as this page's canonical. Read by app.vue,
// which owns the head links, so the canonical and the hreflang cluster are
// always built from the same value.
watchEffect(() => {
  const target = canonicalSlug.value
  canonicalOverride.value = target ? `/produits/${target}` : null
})

useSeoMeta({
  title: () => product.value?.seo?.title || (product.value ? `${l(product.value.name)} | Vitesse Eco` : 'Vitesse Eco'),
  description: () => product.value ? seoDescription.value : '',
  ogTitle: () => product.value ? `${l(product.value.name)} — Vitesse Eco` : '',
  ogDescription: () => product.value ? seoDescription.value : '',
  ogImage: () => product.value?.images?.[0]?.asset ? useSanityImageUrl(product.value.images[0], 1200, 630) : 'https://vitesse-eco.fr/poster.webp',
  ogUrl: () => product.value ? `https://vitesse-eco.fr/produits/${product.value.slug?.current}` : '',
  ogType: 'product' as any,
})

useHead(() => {
  if (!product.value) return {}
  const p = product.value
  return {
    script: [
      { type: 'application/ld+json', innerHTML: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Product',
        name: l(p.name), description: l(p.shortDescription) || l(p.description)?.slice(0, 300),
        image: p.images?.slice(0, 5).map((img: any) => useSanityImageUrl(img, 800, 800)),
        brand: p.brand?.name ? { '@type': 'Brand', name: p.brand.name } : undefined,
        sku: p.slug?.current, color: l(p.color),
        offers: { '@type': 'Offer', price: p.price, priceCurrency: 'EUR',
          availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `https://vitesse-eco.fr/produits/${p.slug?.current}`,
          seller: { '@type': 'Organization', name: 'Vitesse Eco' },
          // U-S0c: Google merchant-listing structured data (2025/26 recs) —
          // shipping + returns inside the offer is what rich results and AI
          // shopping surfaces (Gemini / ChatGPT shopping) read directly.
          // Business reality (owner, 2026-07-05): FREE own-fleet delivery to
          // BE, NL and the Poitiers region (FR dept 86). Everything else:
          // free store pickup; more delivery zones coming (NRW next).
          shippingDetails: [
            {
              '@type': 'OfferShippingDetails',
              shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'EUR' },
              shippingDestination: [
                { '@type': 'DefinedRegion', addressCountry: 'FR', postalCodePrefix: '86' },
                { '@type': 'DefinedRegion', addressCountry: 'BE' },
                { '@type': 'DefinedRegion', addressCountry: 'NL' },
              ],
              deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
                transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 3, unitCode: 'DAY' },
              },
            },
            {
              '@type': 'OfferShippingDetails',
              shippingDestination: ['LU', 'DE', 'ES'].map((c) => ({
                '@type': 'DefinedRegion', addressCountry: c,
              })),
              deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
                transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' },
              },
            },
          ],
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: ['FR', 'BE', 'LU', 'NL', 'DE', 'ES'],
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 14,
            returnMethod: 'https://schema.org/ReturnByMail',
            returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
          },
        },
      }) },
      { type: 'application/ld+json', innerHTML: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://vitesse-eco.fr' },
          { '@type': 'ListItem', position: 2, name: 'Produits', item: 'https://vitesse-eco.fr/produits' },
          { '@type': 'ListItem', position: 3, name: l(p.name) },
        ],
      }) },
    ],
  }
})
</script>
