<template>
  <div class="card group transition-all duration-slow ease-soft hover:border-accent/40 hover:-translate-y-0.5" :class="listMode ? 'flex' : ''">
    <!-- Image -->
    <div :class="listMode ? 'w-32 sm:w-48 shrink-0' : 'aspect-[4/3]'" class="bg-dark-tertiary relative overflow-hidden">
      <img
        v-if="mainImage"
        :src="useSanityImageUrl(mainImage, 400, 300)"
        :alt="l(product.name)"
        width="400" height="300"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow ease-soft"
        loading="lazy"
      />
      <div v-else class="absolute inset-0 flex items-center justify-center">
        <Icon name="ph:package" class="w-16 h-16 text-dark-tertiary/50" />
      </div>

      <!-- Top-left badge stack: only ONE of (sale / new) shown to keep hierarchy -->
      <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-base pointer-events-none">
        <span v-if="discountPercent" class="badge-promo">
          −{{ discountPercent }}%
        </span>
        <span v-else-if="product.isOnSale" class="badge-promo">{{ $t('product.on_sale') }}</span>
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

      <!-- Color dot — bottom right, doesn't fight with badges -->
      <span
        v-if="product.colorHex"
        class="absolute bottom-3 right-3 w-5 h-5 rounded-full border-2 border-white/50 z-base"
        :style="{ backgroundColor: product.colorHex }"
        :title="l(product.color)"
      />
    </div>

    <!-- Info -->
    <div class="p-4 flex-1 flex flex-col">
      <p v-if="product.brand?.name" class="text-text-secondary text-xs mb-1">{{ product.brand.name }}</p>
      <h3 class="font-display font-semibold text-white group-hover:text-accent transition-colors duration-normal mb-1 text-sm leading-tight line-clamp-2">
        {{ l(product.name) }}
      </h3>

      <!-- Spec chip row — surfaces 1-2 key specs at a glance, only if present -->
      <div v-if="topSpec" class="text-text-secondary text-xs mt-1 flex items-center gap-1.5">
        <Icon :name="topSpec.icon" class="w-3 h-3 shrink-0" />
        <span class="truncate">{{ topSpec.value }}</span>
      </div>

      <div class="flex items-center justify-between mt-auto pt-3 gap-2">
        <div v-if="product.stock > 0" class="flex items-baseline gap-2 min-w-0">
          <span class="text-accent font-bold text-base">{{ product.price }}€</span>
          <span v-if="product.compareAtPrice" class="text-text-secondary line-through text-xs">{{ product.compareAtPrice }}€</span>
        </div>
        <span v-else class="text-red-400 text-xs font-medium flex items-center gap-1">
          <Icon name="ph:x-circle" class="w-3 h-3" />
          {{ $t('product.out_of_stock') }}
        </span>
        <span v-if="product.isFeatured" class="badge-bestseller shrink-0">⭐ {{ $t('product.bestseller') }}</span>
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

// P3-01: discount percent is more compelling than a generic "On sale" label
// when there's a real number to show.
const discountPercent = computed(() => {
  const p = props.product
  if (!p.isOnSale || !p.compareAtPrice || !p.price || p.compareAtPrice <= p.price) return null
  return Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
})

// P3-01: low-stock urgency cue. Threshold is conservative (≤3) so it fires
// only when scarcity is real.
const LOW_STOCK_THRESHOLD = 3
const stockState = computed<'out' | 'low' | 'healthy'>(() => {
  const stock = props.product.stock ?? 0
  if (stock <= 0) return 'out'
  if (stock <= LOW_STOCK_THRESHOLD) return 'low'
  return 'healthy'
})

// P3-01: surface ONE most-relevant spec under the title to communicate the
// product's identity at a glance (battery for bikes, etc.). Falls back
// silently if no spec is available.
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
