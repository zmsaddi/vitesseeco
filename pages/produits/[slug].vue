<template>
  <div class="py-8 md:py-12">
    <div class="container-custom" v-if="product">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-text-secondary mb-8">
        <NuxtLink :to="localePath('/')" class="hover:text-accent transition-colors">{{ $t('nav.home') }}</NuxtLink>
        <Icon name="ph:caret-right" class="w-3 h-3" />
        <NuxtLink :to="localePath('/produits')" class="hover:text-accent transition-colors">{{ $t('nav.products') }}</NuxtLink>
        <Icon name="ph:caret-right" class="w-3 h-3" />
        <span class="text-white">{{ l(product.name) }}</span>
      </nav>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <!-- Image Gallery -->
        <div class="space-y-4">
          <div class="card aspect-square flex items-center justify-center bg-dark-tertiary overflow-hidden">
            <NuxtImg
              v-if="currentImage"
              :src="$sanity.visual.urlFor(currentImage).width(800).height(800).url()"
              :alt="l(product.name)"
              class="w-full h-full object-cover"
            />
            <Icon v-else name="ph:bicycle" class="w-32 h-32 text-dark-tertiary/50" />
          </div>
          <div v-if="allImages.length > 1" class="grid grid-cols-4 gap-2">
            <button
              v-for="(img, i) in allImages.slice(0, 4)"
              :key="i"
              @click="selectedImageIndex = i"
              class="card aspect-square flex items-center justify-center bg-dark-tertiary cursor-pointer overflow-hidden"
              :class="selectedImageIndex === i ? 'border-accent' : 'hover:border-accent/50'"
            >
              <NuxtImg
                v-if="img?.asset"
                :src="$sanity.visual.urlFor(img).width(200).height(200).url()"
                :alt="l(product.name)"
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
            <label class="text-sm font-medium text-text-secondary block mb-3">
              {{ $t('product.select_color') }}
              <span class="text-white ml-2">{{ l(product.variants[selectedColor]?.colorName) }}</span>
            </label>
            <div class="flex gap-3">
              <button
                v-for="(variant, i) in product.variants"
                :key="variant._key"
                @click="selectedColor = i"
                class="w-10 h-10 rounded-full border-2 transition-all"
                :class="selectedColor === i ? 'border-accent scale-110' : 'border-dark-tertiary'"
                :style="{ backgroundColor: variant.colorHex }"
                :title="l(variant.colorName)"
              />
            </div>
          </div>

          <!-- Quantity -->
          <div class="mb-6">
            <label class="text-sm font-medium text-text-secondary block mb-3">{{ $t('cart.quantity') }}</label>
            <div class="flex items-center gap-3">
              <button @click="qty = Math.max(1, qty - 1)" class="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors">
                <Icon name="ph:minus" class="w-4 h-4" />
              </button>
              <span class="w-12 text-center font-semibold text-lg">{{ qty }}</span>
              <button @click="qty++" class="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors">
                <Icon name="ph:plus" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Add to Cart -->
          <button
            @click="addToCart"
            :disabled="currentStock <= 0"
            class="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="ph:shopping-cart" class="w-5 h-5" />
            {{ $t('product.add_to_cart') }}
          </button>

          <p v-if="currentStock > 0" class="text-accent text-sm flex items-center gap-2">
            <Icon name="ph:check-circle" class="w-4 h-4" />
            {{ $t('product.in_stock') }}
            <span v-if="currentStock <= 5" class="text-gold">— {{ $t('product.low_stock', { count: currentStock }) }}</span>
          </p>
          <p v-else class="text-red-400 text-sm flex items-center gap-2">
            <Icon name="ph:x-circle" class="w-4 h-4" />
            {{ $t('product.out_of_stock') }}
          </p>

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

      <!-- Related Products -->
      <section class="mt-16" v-if="relatedProducts?.length">
        <h2 class="section-title mb-8">{{ $t('product.related') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="rp in relatedProducts"
            :key="rp._id"
            :to="localePath(`/produits/${rp.slug?.current}`)"
            class="card group"
          >
            <div class="aspect-[4/3] bg-dark-tertiary flex items-center justify-center overflow-hidden">
              <NuxtImg
                v-if="rp.mainImage?.asset"
                :src="$sanity.visual.urlFor(rp.mainImage).width(400).height(300).url()"
                :alt="l(rp.name)"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <Icon v-else name="ph:bicycle" class="w-16 h-16 text-dark-tertiary/50" />
            </div>
            <div class="p-4">
              <h3 class="font-display font-semibold text-white group-hover:text-accent transition-colors">{{ l(rp.name) }}</h3>
              <p class="text-accent font-bold mt-1">{{ $t('common.from') }} {{ rp.price }}{{ $t('common.currency') }}</p>
            </div>
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

const slug = computed(() => route.params.slug as string)

const productQuery = groq`*[_type == "product" && slug.current == $slug][0] {
  _id, name, slug, shortDescription, description, price, compareAtPrice,
  isOnSale, isNew, isAvailable, mainImage, gallery,
  specifications, category->{ _id, name },
  variants[]{ _key, colorName, colorHex, sku, stock, priceOverride, images },
  relatedProducts[]->{ _id, name, slug, price, mainImage }
}`
const { data: product, refresh: refreshProduct } = useSanityQuery(productQuery, { slug })

// Refresh when slug changes (client-side navigation)
watch(slug, () => {
  refreshProduct()
  selectedColor.value = 0
  qty.value = 1
  selectedImageIndex.value = 0
})

// Related products - fetch separately to avoid dependency issues
const relatedProducts = computed(() => {
  return product.value?.relatedProducts?.length ? product.value.relatedProducts : []
})

const allImages = computed(() => {
  if (!product.value) return []
  const images = []
  // Variant-specific images first
  const variant = product.value.variants?.[selectedColor.value]
  if (variant?.images?.length) {
    images.push(...variant.images)
  }
  // Main image
  if (product.value.mainImage?.asset) images.push(product.value.mainImage)
  // Gallery
  if (product.value.gallery?.length) images.push(...product.value.gallery)
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

const specRows = computed(() => {
  const s = product.value?.specifications
  if (!s) return []
  const rows = []
  if (s.motor) rows.push({ label: 'product.motor', value: s.motor })
  if (s.battery) rows.push({ label: 'product.battery', value: s.battery })
  if (s.tireSize) rows.push({ label: 'product.tire_size', value: s.tireSize })
  if (s.range) rows.push({ label: 'product.range', value: s.range })
  if (s.brakeType) rows.push({ label: 'product.brake_type', value: s.brakeType })
  if (s.maxSpeed) rows.push({ label: 'product.max_speed', value: `${s.maxSpeed} km/h` })
  if (s.weight) rows.push({ label: 'product.weight', value: `${s.weight} kg` })
  if (s.suspension) rows.push({ label: 'product.suspension', value: s.suspension })
  if (s.frame) rows.push({ label: 'product.frame', value: s.frame })
  if (s.chargeTime) rows.push({ label: 'product.charge_time', value: `${s.chargeTime}h` })
  if (s.dimensions) rows.push({ label: 'product.dimensions', value: s.dimensions })
  return rows
})

// Reset selected image when color changes
watch(selectedColor, () => { selectedImageIndex.value = 0 })

function addToCart() {
  if (!product.value) return
  const variant = product.value.variants?.[selectedColor.value]
  cart.addItem({
    productId: product.value._id,
    name: product.value.name,
    slug: product.value.slug?.current || '',
    price: currentPrice.value,
    colorHex: variant?.colorHex || '#000',
    colorName: variant?.colorName || { fr: '' },
    sku: variant?.sku || product.value._id,
    image: product.value.mainImage?.asset ? product.value._id : undefined,
  }, qty.value)
  cartOpen.value = true
  qty.value = 1
}

useHead({ title: computed(() => product.value ? `${l(product.value.name)} — Vitesse Eco` : 'Vitesse Eco') })
</script>
