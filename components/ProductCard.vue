<template>
  <div class="card group" :class="listMode ? 'flex' : ''">
    <!-- Image with color slideshow -->
    <div
      ref="imageContainer"
      :class="listMode ? 'w-32 sm:w-48 shrink-0' : 'aspect-[4/3]'"
      class="bg-dark-tertiary relative overflow-hidden touch-pan-y"
      @mouseenter="startSlide"
      @mouseleave="stopSlide"
    >
      <!-- Images stack -->
      <template v-if="allImages.length > 0">
        <img
          v-for="(img, i) in allImages"
          :key="i"
          :src="useSanityImageUrl(img, 400, 300)"
          :alt="l(product.name)"
          width="400"
          height="300"
          class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          :class="i === activeIndex ? 'opacity-100' : 'opacity-0'"
          loading="lazy"
        />
        <!-- Dots indicator -->
        <div v-if="allImages.length > 1" class="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
          <span
            v-for="(_, i) in allImages"
            :key="i"
            @click.prevent="activeIndex = i"
            role="presentation"
            class="w-2 h-2 rounded-full transition-all cursor-pointer"
            :class="i === activeIndex ? 'bg-accent w-4' : 'bg-white/50'"
          />
        </div>
      </template>
      <div v-else class="absolute inset-0 flex items-center justify-center">
        <Icon name="ph:bicycle" class="w-16 h-16 text-dark-tertiary/50" />
      </div>

      <!-- Badges -->
      <span v-if="product.isOnSale" class="absolute top-3 left-3 badge-promo z-10">{{ $t('product.on_sale') }}</span>
      <span v-else-if="product.isNew" class="absolute top-3 left-3 badge-new z-10">{{ $t('product.new') }}</span>
    </div>

    <!-- Info -->
    <div class="p-4 flex-1">
      <h3 class="font-display font-semibold text-white group-hover:text-accent transition-colors mb-1">
        {{ l(product.name) }}
      </h3>
      <p class="text-text-secondary text-sm mb-2">{{ l(product.shortDescription) }}</p>
      <p class="text-text-secondary text-xs mb-3">{{ product.specifications?.battery }} — {{ sv(product.specifications?.range) }}</p>
      <div class="flex items-center justify-between">
        <div v-if="totalStock > 0">
          <span v-if="product.compareAtPrice" class="text-text-secondary line-through text-xs mr-2">{{ product.compareAtPrice }}{{ $t('common.currency') }}</span>
          <span class="text-accent font-bold">{{ $t('common.from') }} {{ product.price }}{{ $t('common.currency') }}</span>
        </div>
        <span v-else class="text-red-400 text-xs font-medium flex items-center gap-1">
          <Icon name="ph:x-circle" class="w-3 h-3" />
          {{ $t('product.out_of_stock') }}
        </span>
        <!-- Color dots that control image -->
        <div class="flex gap-1.5">
          <button
            v-for="(variant, i) in (product.variants || []).slice(0, 5)"
            :key="variant._key"
            @click.prevent="selectColor(Number(i))"
            :aria-label="l(variant.colorName)"
            class="w-6 h-6 rounded-full border-2 transition-all hover:scale-110 p-0.5"
            :class="colorIndex === i ? 'border-accent scale-110' : 'border-white/30'"
          >
            <span class="block w-full h-full rounded-full" :style="{ backgroundColor: variant.colorHex }" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const l = useLocalizedField()
const sv = (v: any) => typeof v === 'object' && v !== null ? l(v) : v

const props = defineProps<{
  product: any
  listMode?: boolean
}>()

const colorIndex = ref(0)
const activeIndex = ref(0)
const imageContainer = ref<HTMLElement>()
let slideInterval: ReturnType<typeof setInterval> | null = null

// Touch swipe support
useSwipe(imageContainer, {
  onLeft: () => { if (allImages.value.length > 1) activeIndex.value = (activeIndex.value + 1) % allImages.value.length },
  onRight: () => { if (allImages.value.length > 1) activeIndex.value = (activeIndex.value - 1 + allImages.value.length) % allImages.value.length },
})

// Total stock across all variants
const totalStock = computed(() => {
  return (props.product.variants || []).reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0)
})

// Collect first image from each variant
const allImages = computed(() => {
  const images: any[] = []
  for (const variant of props.product.variants || []) {
    if (variant.images?.[0]?.asset) {
      images.push(variant.images[0])
    }
  }
  return images
})

function selectColor(i: number) {
  colorIndex.value = i
  activeIndex.value = i
}

function startSlide() {
  if (allImages.value.length <= 1) return
  slideInterval = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % allImages.value.length
  }, 2000)
}

function stopSlide() {
  if (slideInterval) {
    clearInterval(slideInterval)
    slideInterval = null
  }
  // Return to selected color
  activeIndex.value = colorIndex.value
}

onUnmounted(() => {
  if (slideInterval) clearInterval(slideInterval)
})
</script>
