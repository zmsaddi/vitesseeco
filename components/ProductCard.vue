<template>
  <div
    class="card group card-lift relative"
    :class="[listMode ? 'flex' : '', product.isFeatured ? 'ring-accent-soft' : '']"
  >
    <!-- Image -->
    <div
      :class="listMode ? 'w-32 sm:w-48 shrink-0' : 'aspect-[5/4]'"
      class="bg-gradient-to-br from-dark-tertiary to-dark-secondary relative overflow-hidden"
    >
      <img
        v-if="mainImage"
        :src="useSanityImageUrl(mainImage, 600, 480)"
        :alt="l(product.name)"
        width="600" height="480"
        class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-soft"
        loading="lazy"
      />
      <div v-else class="absolute inset-0 flex items-center justify-center">
        <Icon name="ph:package" class="w-16 h-16 text-dark-tertiary/50" />
      </div>

      <!-- Subtle vignette to anchor white badges visually -->
      <div class="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/20 pointer-events-none" />

      <!-- Top-left badge stack — single emphasis badge -->
      <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-base pointer-events-none">
        <span v-if="discountPercent" class="badge-promo glow-accent">
          −{{ discountPercent }}%
        </span>
        <span v-else-if="product.isOnSale" class="badge-promo glow-accent">{{ $t('product.on_sale') }}</span>
        <span v-else-if="product.isNew" class="badge-new">{{ $t('product.new') }}</span>
      </div>

      <!-- Stock indicator (top-right) — only when low or out -->
      <div v-if="stockState !== 'healthy'" class="absolute top-3 right-3 z-base pointer-events-none">
        <span v-if="stockState === 'low'" class="badge-stock-low">
          {{ $t('product.low_stock', { count: product.stock }) }}
        </span>
        <span v-else class="badge-stock-out">
          {{ $t('product.out_of_stock') }}
        </span>
      </div>

    </div>

    <!-- Info -->
    <div class="p-4 md:p-5 flex-1 flex flex-col">
      <p v-if="product.brand?.name" class="text-text-secondary text-xs uppercase tracking-wider mb-1.5">
        {{ product.brand.name }}
      </p>
      <h3 class="font-display font-bold text-white group-hover:text-accent transition-colors duration-normal mb-2 text-base leading-tight line-clamp-2">
        {{ l(product.name) }}
      </h3>

      <!-- Spec chip row -->
      <div v-if="topSpec" class="text-text-secondary text-xs mt-1 flex items-center gap-1.5">
        <Icon :name="topSpec.icon" class="w-3.5 h-3.5 shrink-0 text-accent/70" />
        <span class="truncate">{{ topSpec.value }}</span>
      </div>

      <!-- Bestseller chip on its own row above the price (no price overlap on mobile) -->
      <div v-if="product.isFeatured" class="mt-3">
        <span class="badge-bestseller inline-flex items-center gap-1">
          <span aria-hidden="true">⭐</span>
          <span>{{ $t('product.bestseller') }}</span>
        </span>
      </div>

      <div class="flex items-baseline justify-between mt-auto pt-3 gap-2">
        <div v-if="product.stock > 0" class="flex items-baseline gap-2 min-w-0">
          <span class="text-accent font-bold text-lg leading-none">{{ product.price }}€</span>
          <span v-if="product.compareAtPrice && product.compareAtPrice > product.price" class="text-text-secondary line-through text-xs">{{ product.compareAtPrice }}€</span>
        </div>
        <span v-else class="text-red-400 text-xs font-medium flex items-center gap-1">
          <Icon name="ph:x-circle" class="w-3 h-3" />
          {{ $t('product.out_of_stock') }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const l = useLocalizedField()

const props = defineProps<{
  product: any
  listMode?: boolean
}>()

const mainImage = computed(() => props.product.images?.[0] || null)

const discountPercent = computed(() => {
  const p = props.product
  if (!p.isOnSale || !p.compareAtPrice || !p.price || p.compareAtPrice <= p.price) return null
  return Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
})

const LOW_STOCK_THRESHOLD = 3
const stockState = computed<'out' | 'low' | 'healthy'>(() => {
  const stock = props.product.stock ?? 0
  if (stock <= 0) return 'out'
  if (stock <= LOW_STOCK_THRESHOLD) return 'low'
  return 'healthy'
})

const topSpec = computed(() => {
  const specs = props.product.specifications
  if (!specs) return null
  if (specs.range) {
    const v = typeof specs.range === 'object' ? l(specs.range) : specs.range
    if (v) return { icon: 'ph:battery-charging', value: v }
  }
  if (specs.motor) return { icon: 'ph:gauge', value: specs.motor }
  if (specs.tireSize) return { icon: 'ph:circle', value: specs.tireSize }
  return null
})
</script>
