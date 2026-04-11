<template>
  <div class="card group" :class="listMode ? 'flex' : ''">
    <!-- Image -->
    <div :class="listMode ? 'w-32 sm:w-48 shrink-0' : 'aspect-[4/3]'" class="bg-dark-tertiary relative overflow-hidden">
      <img
        v-if="mainImage"
        :src="useSanityImageUrl(mainImage, 400, 300)"
        :alt="l(product.name)"
        width="400" height="300"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
      <div v-else class="absolute inset-0 flex items-center justify-center">
        <Icon name="ph:package" class="w-16 h-16 text-dark-tertiary/50" />
      </div>
      <!-- Badges -->
      <span v-if="product.isOnSale" class="absolute top-3 left-3 badge-promo z-10">{{ $t('product.on_sale') }}</span>
      <span v-else-if="product.isNew" class="absolute top-3 left-3 badge-new z-10">{{ $t('product.new') }}</span>
      <!-- Color dot -->
      <span
        v-if="product.colorHex"
        class="absolute bottom-3 right-3 w-5 h-5 rounded-full border-2 border-white/50 z-10"
        :style="{ backgroundColor: product.colorHex }"
        :title="l(product.color)"
      />
    </div>

    <!-- Info -->
    <div class="p-4 flex-1">
      <p v-if="product.brand?.name" class="text-text-secondary text-xs mb-1">{{ product.brand.name }}</p>
      <h3 class="font-display font-semibold text-white group-hover:text-accent transition-colors mb-1 text-sm leading-tight">
        {{ l(product.name) }}
      </h3>
      <div class="flex items-center justify-between mt-2">
        <div v-if="product.stock > 0">
          <span v-if="product.compareAtPrice" class="text-text-secondary line-through text-xs mr-2">{{ product.compareAtPrice }}€</span>
          <span class="text-accent font-bold">{{ product.price }}€</span>
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
</script>
