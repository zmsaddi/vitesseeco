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
            <template v-if="product.images?.length">
              <img
                v-for="(img, i) in product.images"
                :key="i"
                :src="useSanityImageUrl(img, 800, 800)"
                :alt="l(product.name)"
                width="800" height="800"
                class="absolute inset-0 w-full h-full object-contain bg-dark-tertiary transition-opacity duration-300"
                :class="i === selectedImage ? 'opacity-100' : 'opacity-0'"
              />
              <button v-if="product.images?.length > 1" @click="selectedImage = (selectedImage - 1 + product.images?.length) % product.images?.length"
                :aria-label="$t('product.previous_image')"
                class="absolute ltr:left-2 rtl:right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 z-10">
                <Icon name="ph:caret-left" class="w-5 h-5" />
              </button>
              <button v-if="product.images?.length > 1" @click="selectedImage = (selectedImage + 1) % product.images?.length"
                :aria-label="$t('product.next_image')"
                class="absolute ltr:right-2 rtl:left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 z-10">
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
              class="card aspect-square bg-dark-tertiary cursor-pointer overflow-hidden border-2 transition-colors"
              :class="selectedImage === i ? 'border-accent' : 'border-transparent hover:border-accent/30'">
              <img :src="useSanityImageUrl(img, 150, 150)" :alt="l(product.name)" width="150" height="150" loading="lazy" class="w-full h-full object-cover" />
            </button>
          </div>
        </div>

        <!-- Product Info -->
        <div>
          <p v-if="product.brand?.name" class="text-text-secondary text-sm mb-1">{{ product.brand.name }}</p>
          <div class="flex items-center gap-2 mb-2">
            <span v-if="product.isOnSale" class="badge-promo">{{ $t('product.on_sale') }}</span>
            <span v-if="product.isNew" class="badge-new">{{ $t('product.new') }}</span>
          </div>

          <h1 class="font-display text-3xl md:text-4xl font-bold text-white mb-4">{{ l(product.name) }}</h1>

          <div class="text-3xl font-bold mb-6">
            <span v-if="product.compareAtPrice" class="text-text-secondary line-through text-xl mr-3">{{ product.compareAtPrice }}€</span>
            <span class="text-accent">{{ product.price }}€</span>
          </div>

          <!-- Other Colors (auto from modelFamily) -->
          <div v-if="otherColors.length" class="mb-6">
            <p class="text-sm font-medium text-text-secondary block mb-3">{{ $t('product.other_colors') }}</p>
            <div class="flex gap-3">
              <!-- Current color -->
              <span class="w-11 h-11 rounded-full border-2 border-accent scale-110"
                :style="{ backgroundColor: product.colorHex }" :title="l(product.color)" role="img" :aria-label="$t('product.current_color', { color: l(product.color) })" />
              <!-- Other colors as links -->
              <NuxtLink v-for="c in otherColors" :key="c._id" :to="localePath(`/produits/${c.slug?.current}`)"
                :aria-label="$t('product.switch_color', { color: l(c.color) })"
                class="w-11 h-11 rounded-full border-2 border-dark-tertiary hover:border-accent transition-all hover:scale-110"
                :style="{ backgroundColor: c.colorHex }" :title="l(c.color)" />
            </div>
          </div>

          <!-- Quantity + Add to Cart -->
          <div v-if="product.stock > 0" class="mb-6">
            <label for="product-qty" class="text-sm font-medium text-text-secondary block mb-3">{{ $t('cart.quantity') }}</label>
            <div class="flex items-center gap-3">
              <button @click="qty = Math.max(1, qty - 1)" :aria-label="$t('cart.decrease_quantity')" class="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent">
                <Icon name="ph:minus" class="w-4 h-4" />
              </button>
              <input id="product-qty" type="number" v-model.number="qty" :max="Math.min(10, product.stock)" min="1" :aria-label="$t('cart.quantity')" class="w-12 text-center font-semibold text-lg bg-transparent border-none outline-none text-white" />
              <button @click="qty = Math.min(Math.min(10, product.stock), qty + 1)" :aria-label="$t('cart.increase_quantity')" class="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent">
                <Icon name="ph:plus" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <button v-if="product.stock > 0" @click="addToCart" class="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3 mb-4">
            <Icon name="ph:shopping-cart" class="w-5 h-5" /> {{ $t('product.add_to_cart') }}
          </button>
          <div v-else class="mb-4">
            <button disabled class="w-full text-lg py-4 flex items-center justify-center gap-3 bg-red-900/30 text-red-400 rounded-lg cursor-not-allowed border border-red-800/50">
              <Icon name="ph:x-circle" class="w-5 h-5" /> {{ $t('product.out_of_stock') }}
            </button>
            <NuxtLink :to="localePath('/contact')" class="btn-outline w-full text-center mt-3 block">{{ $t('product.contact_us') }}</NuxtLink>
          </div>

          <p v-if="product.stock > 0" class="text-accent text-sm flex items-center gap-2">
            <Icon name="ph:check-circle" class="w-4 h-4" /> {{ $t('product.in_stock') }}
            <span v-if="product.stock <= 5" class="text-gold">— {{ $t('product.low_stock', { count: product.stock }) }}</span>
          </p>

          <div v-if="product.stock > 0" class="mt-3 flex items-center gap-2 text-text-secondary text-sm">
            <Icon name="ph:truck" class="w-4 h-4 text-accent" /> {{ $t('product.delivery_estimate') }}
          </div>
          <div v-if="l(product.warranty)" class="mt-2 flex items-center gap-2 text-text-secondary text-sm">
            <Icon name="ph:shield-check" class="w-4 h-4 text-accent" /> {{ l(product.warranty) }}
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
          <div v-if="product.videoUrl" class="mt-6">
            <a :href="product.videoUrl" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-accent hover:underline text-sm">
              <Icon name="ph:play-circle" class="w-5 h-5" /> {{ $t('product.watch_video') }}
            </a>
          </div>

          <!-- Description -->
          <div class="mt-8" v-if="l(product.description)">
            <h2 class="font-display text-xl font-semibold text-white mb-3">{{ $t('product.description') }}</h2>
            <p class="text-text-secondary leading-relaxed whitespace-pre-line">{{ l(product.description) }}</p>
          </div>

          <!-- Specs -->
          <div class="mt-8" v-if="specRows.length">
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

      <!-- Other Colors Section -->
      <section class="mt-16" v-if="otherColors.length">
        <h2 class="section-title mb-8">{{ $t('product.other_colors') }}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <NuxtLink v-for="c in otherColors" :key="c._id" :to="localePath(`/produits/${c.slug?.current}`)">
            <ProductCard :product="c" />
          </NuxtLink>
        </div>
      </section>

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

    <div v-else class="container-custom py-20 text-center">
      <Icon name="ph:spinner" class="w-8 h-8 text-accent animate-spin mx-auto" />
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

const selectedImage = ref(0)
const qty = ref(1)
const galleryContainer = ref<HTMLElement>()
const slug = computed(() => route.params.slug as string)

if (import.meta.client) {
  useSwipe(galleryContainer, {
    onLeft: () => { if (product.value?.images?.length && product.value.images.length > 1) selectedImage.value = (selectedImage.value + 1) % product.value.images.length },
    onRight: () => { if (product.value?.images?.length && product.value.images.length > 1) selectedImage.value = (selectedImage.value - 1 + product.value.images.length) % product.value.images.length },
  })
}

const specVal = (v: any) => typeof v === 'object' && v !== null ? l(v) : v

// Single query: product + other colors + testimonials
const productQuery = groq`{
  "product": *[_type == "product" && slug.current == $slug][0] {
    _id, name, slug, shortDescription, description, price, compareAtPrice,
    isOnSale, isNew, isAvailable, warranty, highlights, videoUrl,
    productType, color, colorHex, stock, modelFamily, seo,
    specifications, brand->{ name },
    "images": images[]{asset}
  },
  "otherColors": *[_type == "product" && modelFamily == *[_type == "product" && slug.current == $slug][0].modelFamily && slug.current != $slug && isAvailable == true] | order(sortOrder asc) {
    _id, name, slug, price, color, colorHex, stock, brand->{ name },
    "images": images[0..0]{asset}
  },
  "testimonials": *[_type == "testimonial"] | order(rating desc)[0..4] {
    _id, customerName, rating, text
  }
}`
const { data: pageData, status } = useSanityFetch(() => `product-page-${slug.value}`, productQuery, { slug })

const product = computed(() => pageData.value?.product || null)
const otherColors = computed(() => pageData.value?.otherColors || [])
const testimonials = computed(() => pageData.value?.testimonials || [])

// 404
if (import.meta.server && status.value === 'success' && !product.value) throw createError({ statusCode: 404 })
if (import.meta.client) { watch([status, product], () => { if (status.value === 'success' && !product.value) showError({ statusCode: 404 }) }) }

watch(() => product.value?._id, () => { selectedImage.value = 0; qty.value = 1 })

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
}

// SEO
const seoDescription = computed(() => {
  if (!product.value) return ''
  const p = product.value
  if (p.seo?.description) return p.seo.description
  const name = l(p.name) || ''
  const price = p.price
  return `${name} — ${price}€. ${l(p.shortDescription) || ''}`.slice(0, 160)
})

useHead({
  title: computed(() => product.value?.seo?.title || (product.value ? `${l(product.value.name)} | Vitesse Eco` : 'Vitesse Eco')),
  meta: computed(() => product.value ? [
    { name: 'description', content: seoDescription.value },
    { property: 'og:title', content: `${l(product.value.name)} — Vitesse Eco` },
    { property: 'og:description', content: seoDescription.value },
    { property: 'og:image', content: product.value.images?.[0]?.asset ? useSanityImageUrl(product.value.images[0], 1200, 630) : 'https://vitesse-eco.fr/poster.webp' },
    { property: 'og:url', content: `https://vitesse-eco.fr/produits/${product.value.slug?.current}` },
    { property: 'og:type', content: 'product' },
  ] : []),
  script: computed(() => {
    if (!product.value) return []
    const p = product.value
    return [
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
    ]
  }),
})
</script>
