<template>
  <div class="py-8 md:py-12">
    <div class="container-custom" v-if="product">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-text-secondary mb-8">
        <NuxtLink :to="localePath('/')" class="hover:text-accent transition-colors">{{ $t('nav.home') }}</NuxtLink>
        <Icon name="ph:caret-right" class="w-3 h-3 rtl:rotate-180" />
        <NuxtLink :to="localePath('/produits')" class="hover:text-accent transition-colors">{{ $t('nav.products') }}</NuxtLink>
        <Icon name="ph:caret-right" class="w-3 h-3 rtl:rotate-180" />
        <span class="text-white">{{ l(product.name) }}</span>
      </nav>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <!-- Image Gallery -->
        <div class="space-y-4">
          <div ref="galleryContainer" class="card aspect-square bg-dark-tertiary overflow-hidden relative touch-pan-y">
            <template v-if="allImages.length > 0">
              <img
                v-for="(img, i) in allImages"
                :key="i"
                :src="useSanityImageUrl(img, 800, 800)"
                :alt="l(product.name)"
                width="800"
                height="800"
                class="absolute inset-0 w-full h-full object-contain bg-dark-tertiary transition-opacity duration-300"
                :class="i === selectedImageIndex ? 'opacity-100' : 'opacity-0'"
              />
              <!-- Navigation arrows -->
              <button
                v-if="allImages.length > 1"
                @click="selectedImageIndex = (selectedImageIndex - 1 + allImages.length) % allImages.length"
                class="absolute ltr:left-2 rtl:right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
              >
                <Icon name="ph:caret-left" class="w-5 h-5" />
              </button>
              <button
                v-if="allImages.length > 1"
                @click="selectedImageIndex = (selectedImageIndex + 1) % allImages.length"
                class="absolute ltr:right-2 rtl:left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
              >
                <Icon name="ph:caret-right" class="w-5 h-5" />
              </button>
              <!-- Image counter -->
              <div class="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                <button
                  v-for="(_, i) in allImages"
                  :key="i"
                  @click="selectedImageIndex = i"
                  class="w-2 h-2 rounded-full transition-all"
                  :class="i === selectedImageIndex ? 'bg-accent w-5' : 'bg-white/50'"
                />
              </div>
            </template>
            <div v-else class="absolute inset-0 flex items-center justify-center">
              <Icon name="ph:bicycle" class="w-32 h-32 text-dark-tertiary/50" />
            </div>
          </div>
          <!-- Thumbnails -->
          <div v-if="allImages.length > 1" class="grid grid-cols-5 gap-2">
            <button
              v-for="(img, i) in allImages.slice(0, 10)"
              :key="i"
              @click="selectedImageIndex = i"
              class="card aspect-square bg-dark-tertiary cursor-pointer overflow-hidden border-2 transition-colors"
              :class="selectedImageIndex === i ? 'border-accent' : 'border-transparent hover:border-accent/30'"
            >
              <img
                :src="useSanityImageUrl(img, 150, 150)"
                :alt="l(product.name)"
                width="150"
                height="150"
                loading="lazy"
                class="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>

        <!-- Product Info -->
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span v-if="product.isOnSale" class="badge-promo">{{ $t('product.on_sale') }}</span>
            <span v-if="product.isNew" class="badge-new">{{ $t('product.new') }}</span>
          </div>

          <h1 class="font-display text-3xl md:text-4xl font-bold text-white mb-2">{{ l(product.name) }}</h1>
          <p class="text-text-secondary text-lg mb-4">{{ l(product.shortDescription) }}</p>

          <div class="text-3xl font-bold mb-6">
            <span v-if="product.compareAtPrice" class="text-text-secondary line-through text-xl mr-3">{{ product.compareAtPrice }}{{ $t('common.currency') }}</span>
            <span class="text-accent">{{ currentPrice }}{{ $t('common.currency') }}</span>
          </div>

          <!-- Color Picker -->
          <div class="mb-6" v-if="product.variants?.length">
            <p id="color-label" class="text-sm font-medium text-text-secondary block mb-3">
              {{ $t('product.select_color') }}
              <span class="text-white ml-2">{{ l(product.variants[selectedColor]?.colorName) }}</span>
            </p>
            <div class="flex gap-3" role="radiogroup" aria-labelledby="color-label">
              <button
                v-for="(variant, i) in product.variants"
                :key="variant._key"
                @click="selectedColor = Number(i)"
                role="radio"
                :aria-checked="selectedColor === i"
                :aria-label="l(variant.colorName)"
                class="w-11 h-11 rounded-full border-2 transition-all relative"
                :class="[
                  selectedColor === i ? 'border-accent scale-110' : 'border-dark-tertiary',
                  (variant.stock ?? 0) <= 0 ? 'opacity-40' : ''
                ]"
                :style="{ backgroundColor: variant.colorHex }"
                :title="l(variant.colorName)"
              />
            </div>
          </div>

          <!-- Quantity (hidden when out of stock) -->
          <div class="mb-6" v-if="currentStock > 0">
            <label for="product-qty" class="text-sm font-medium text-text-secondary block mb-3">{{ $t('cart.quantity') }}</label>
            <div class="flex items-center gap-3">
              <button @click="qty = Math.max(1, qty - 1)" :aria-label="$t('cart.quantity') + ' -'" class="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors">
                <Icon name="ph:minus" class="w-4 h-4" />
              </button>
              <input id="product-qty" name="quantity" type="number" v-model.number="qty" :max="Math.min(10, currentStock)" min="1" class="w-12 text-center font-semibold text-lg bg-transparent border-none outline-none text-white" />
              <button @click="qty = Math.min(Math.min(10, currentStock), qty + 1)" :aria-label="$t('cart.quantity') + ' +'" class="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors">
                <Icon name="ph:plus" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Add to Cart / Out of Stock -->
          <button
            v-if="currentStock > 0"
            @click="addToCart"
            class="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3 mb-4"
          >
            <Icon name="ph:shopping-cart" class="w-5 h-5" />
            {{ $t('product.add_to_cart') }}
          </button>
          <div v-else class="mb-4">
            <button disabled class="w-full text-lg py-4 flex items-center justify-center gap-3 bg-red-900/30 text-red-400 rounded-lg cursor-not-allowed border border-red-800/50">
              <Icon name="ph:x-circle" class="w-5 h-5" />
              {{ $t('product.out_of_stock') }}
            </button>
            <NuxtLink :to="localePath('/contact')" class="btn-outline w-full text-center mt-3 block">
              {{ $t('product.contact_us') }}
            </NuxtLink>
          </div>

          <p v-if="currentStock > 0" class="text-accent text-sm flex items-center gap-2">
            <Icon name="ph:check-circle" class="w-4 h-4" />
            {{ $t('product.in_stock') }}
            <span v-if="currentStock <= 5" class="text-gold">— {{ $t('product.low_stock', { count: currentStock }) }}</span>
          </p>

          <!-- Delivery estimate -->
          <div v-if="currentStock > 0" class="mt-3 flex items-center gap-2 text-text-secondary text-sm">
            <Icon name="ph:truck" class="w-4 h-4 text-accent" />
            <span>{{ $t('product.delivery_estimate') }}</span>
          </div>

          <!-- Warranty -->
          <div v-if="l(product.warranty)" class="mt-2 flex items-center gap-2 text-text-secondary text-sm">
            <Icon name="ph:shield-check" class="w-4 h-4 text-accent" />
            <span>{{ l(product.warranty) }}</span>
          </div>

          <!-- Highlights -->
          <div v-if="product.highlights?.length" class="mt-6">
            <h2 class="font-display text-lg font-semibold text-white mb-3">{{ $t('product.highlights') }}</h2>
            <ul class="space-y-2">
              <li v-for="(h, i) in product.highlights" :key="i" class="flex items-start gap-2 text-text-secondary text-sm">
                <Icon name="ph:check-circle" class="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>{{ l(h) }}</span>
              </li>
            </ul>
          </div>

          <!-- Video -->
          <div v-if="product.videoUrl" class="mt-6">
            <a :href="product.videoUrl" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-accent hover:underline text-sm">
              <Icon name="ph:play-circle" class="w-5 h-5" />
              {{ $t('product.watch_video') }}
            </a>
          </div>

          <!-- Description -->
          <div class="mt-8" v-if="l(product.description)">
            <h2 class="font-display text-xl font-semibold text-white mb-3">{{ $t('product.description') }}</h2>
            <p class="text-text-secondary leading-relaxed">{{ l(product.description) }}</p>
          </div>

          <!-- Specs Table -->
          <div class="mt-8" v-if="product.specifications">
            <h2 class="font-display text-xl font-semibold text-white mb-4">{{ $t('product.specifications') }}</h2>
            <div class="card divide-y divide-dark-tertiary/50">
              <div v-for="spec in specRows" :key="spec.label" class="flex justify-between px-4 py-3">
                <span class="text-text-secondary text-sm">{{ $t(spec.label) }}</span>
                <span class="text-white text-sm font-medium">{{ spec.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Testimonials -->
      <section class="mt-16" v-if="testimonials?.length">
        <h2 class="section-title mb-8">{{ $t('product.reviews') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div v-for="review in testimonials" :key="review._id" class="card p-6">
            <div class="flex items-center gap-3 mb-3">
              <div v-if="review.photo?.asset" class="w-10 h-10 rounded-full overflow-hidden bg-dark-tertiary">
                <img :src="useSanityImageUrl(review.photo, 80, 80)" :alt="review.customerName" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
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

      <!-- Related Products -->
      <section class="mt-16" v-if="relatedProducts?.length">
        <h2 class="section-title mb-8">{{ $t('product.related') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="rp in relatedProducts"
            :key="rp._id"
            :to="localePath(`/produits/${rp.slug?.current}`)"
          >
            <ProductCard :product="rp" />
          </NuxtLink>
        </div>
      </section>
    </div>

    <!-- Loading -->
    <div v-else class="container-custom py-20 text-center">
      <Icon name="ph:spinner" class="w-8 h-8 text-accent animate-spin mx-auto" />
      <p class="text-text-secondary mt-4">{{ $t('common.loading') }}</p>
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

const selectedColor = ref(0)
const qty = ref(1)
const selectedImageIndex = ref(0)

const galleryContainer = ref<HTMLElement>()
const slug = computed(() => route.params.slug as string)

// Touch swipe for gallery
useSwipe(galleryContainer, {
  onLeft: () => { if (allImages.value.length > 1) selectedImageIndex.value = (selectedImageIndex.value + 1) % allImages.value.length },
  onRight: () => { if (allImages.value.length > 1) selectedImageIndex.value = (selectedImageIndex.value - 1 + allImages.value.length) % allImages.value.length },
})

const productQuery = groq`*[_type == "product" && slug.current == $slug][0] {
  _id, name, slug, shortDescription, description, price, compareAtPrice,
  isOnSale, isNew, isAvailable, warranty, highlights, videoUrl, seo,
  specifications, category->{ _id, name }, brand->{ name },
  variants[]{ _key, colorName, colorHex, sku, stock, priceOverride, images },
  relatedProducts[]->{ _id, name, slug, price, variants[]{ _key, colorHex, colorName, "images": images[]{asset} } }
}`

// Fetch testimonials for this product
const { data: testimonials } = useSanityFetch(
  () => `testimonials-${slug.value}`,
  groq`*[_type == "testimonial" && product->slug.current == $slug] | order(rating desc)[0..4] {
    _id, customerName, rating, text, photo
  }`,
  { slug }
)
const { data: product, status } = useSanityFetch(
  () => `product-${slug.value}`,
  productQuery,
  { slug }
)

// Show 404 if product not found after fetch
if (import.meta.server && status.value === 'success' && !product.value) {
  throw createError({ statusCode: 404, message: 'Product not found' })
}
if (import.meta.client) {
  watch([status, product], () => {
    if (status.value === 'success' && !product.value) {
      showError({ statusCode: 404, message: 'Product not found' })
    }
  })
}

// Reset UI state when product changes
watch(() => product.value?._id, () => {
  selectedColor.value = 0
  qty.value = 1
  selectedImageIndex.value = 0
})

// Related products - fetch separately to avoid dependency issues
const relatedProducts = computed(() => {
  return product.value?.relatedProducts?.length ? product.value.relatedProducts : []
})

// All images: selected color first, then other colors
const allImages = computed(() => {
  if (!product.value?.variants) return []
  const images: any[] = []
  // Selected color images first
  const selected = product.value.variants[selectedColor.value]
  if (selected?.images?.length) {
    images.push(...selected.images)
  }
  // Then other colors (one image each)
  for (let i = 0; i < product.value.variants.length; i++) {
    if (i === selectedColor.value) continue
    const v = product.value.variants[i]
    if (v?.images?.[0]?.asset) images.push(v.images[0])
  }
  return images
})

const currentImage = computed(() => allImages.value[selectedImageIndex.value] || allImages.value[0] || product.value?.mainImage)

const currentStock = computed(() => {
  return product.value?.variants?.[selectedColor.value]?.stock ?? 0
})

const currentPrice = computed(() => {
  const variant = product.value?.variants?.[selectedColor.value]
  return variant?.priceOverride || product.value?.price || 0
})

// Helper: get spec value (string or localizedString)
const specVal = (v: any) => typeof v === 'object' && v !== null ? l(v) : v

// Build spec rows — only shows fields that have data in Sanity
// When you fill a field in Sanity, it appears automatically on the site
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
  return all
    .filter(spec => {
      const val = s[spec.key]
      if (val === null || val === undefined || val === '' || val === 0) return false
      if (typeof val === 'object') return !!specVal(val) // localizedString: check if translated value exists
      return true
    })
    .map(spec => {
      const raw = s[spec.key]
      const val = specVal(raw)
      return { label: spec.label, value: spec.suffix ? `${val}${spec.suffix}` : val }
    })
})

// Reset selected image when color changes
watch(selectedColor, () => { selectedImageIndex.value = 0 })

function addToCart() {
  if (!product.value) return
  const variant = product.value.variants?.[selectedColor.value]
  // Get first image URL from selected variant
  const variantImage = variant?.images?.[0]
  const imageUrl = variantImage?.asset ? useSanityImageUrl(variantImage, 150, 150) : ''

  cart.addItem({
    productId: product.value._id,
    name: product.value.name,
    slug: product.value.slug?.current || '',
    price: currentPrice.value,
    colorHex: variant?.colorHex || '#000',
    colorName: variant?.colorName || { fr: '' },
    sku: variant?.sku || product.value._id,
    image: imageUrl,
  }, qty.value)
  cartOpen.value = true
  qty.value = 1
}

// Build SEO meta description with price + specs
const seoDescription = computed(() => {
  if (!product.value) return ''
  const p = product.value
  // Use Sanity SEO field first
  if (p.seo?.description) return p.seo.description
  // Auto-generate: Name + price + key specs
  const name = l(p.name) || ''
  const price = currentPrice.value
  const range = specVal(p.specifications?.range) || ''
  const battery = p.specifications?.battery || ''
  const desc = l(p.shortDescription) || ''
  return `${name} — ${price}€. ${desc}${range ? ` Autonomie: ${range}.` : ''}${battery ? ` Batterie: ${battery}.` : ''} Livraison gratuite en France.`.slice(0, 160)
})

useHead({
  title: computed(() => {
    if (!product.value) return 'Vitesse Eco'
    return product.value.seo?.title || `${l(product.value.name)} | Vitesse Eco`
  }),
  meta: computed(() => product.value ? [
    { name: 'description', content: seoDescription.value },
    { property: 'og:title', content: `${l(product.value.name)} — Vitesse Eco` },
    { property: 'og:description', content: seoDescription.value },
    { property: 'og:image', content: allImages.value[0] ? useSanityImageUrl(allImages.value[0], 1200, 630) : 'https://vitesse-eco.fr/poster.webp' },
    { property: 'og:url', content: `https://vitesse-eco.fr/produits/${product.value.slug?.current}` },
    { property: 'og:type', content: 'product' },
  ] : []),
  script: computed(() => {
    if (!product.value) return []
    const p = product.value
    const scripts: any[] = []
    // Product JSON-LD
    scripts.push({
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: l(p.name),
        description: l(p.shortDescription) || l(p.description)?.slice(0, 300),
        image: allImages.value.slice(0, 5).map(img => useSanityImageUrl(img, 800, 800)),
        brand: p.brand?.name ? { '@type': 'Brand', name: p.brand.name } : undefined,
        sku: p.variants?.[0]?.sku,
        offers: {
          '@type': 'Offer',
          price: currentPrice.value,
          priceCurrency: 'EUR',
          availability: currentStock.value > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: `https://vitesse-eco.fr/produits/${p.slug?.current}`,
          seller: { '@type': 'Organization', name: 'Vitesse Eco' },
        },
      }),
    })
    // BreadcrumbList JSON-LD
    scripts.push({
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://vitesse-eco.fr' },
          { '@type': 'ListItem', position: 2, name: 'Produits', item: 'https://vitesse-eco.fr/produits' },
          { '@type': 'ListItem', position: 3, name: l(p.name) },
        ],
      }),
    })
    return scripts
  }),
})
</script>
