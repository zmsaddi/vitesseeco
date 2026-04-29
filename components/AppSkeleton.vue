<template>
  <!-- Pre-built skeleton patterns. variant=card | line | image | avatar | custom -->
  <div v-if="variant === 'card'" class="card animate-pulse">
    <div class="aspect-[4/3] bg-dark-tertiary" />
    <div class="p-4 space-y-3">
      <div class="skeleton-text w-1/3" />
      <div class="skeleton-text-lg w-3/4" />
      <div class="skeleton-text w-1/4" />
    </div>
  </div>

  <div v-else-if="variant === 'line'" class="skeleton-text" :class="lineClass" />

  <div v-else-if="variant === 'image'" class="skeleton aspect-[4/3] w-full" />

  <div v-else-if="variant === 'avatar'" class="skeleton rounded-full" :style="{ width: size + 'px', height: size + 'px' }" />

  <div v-else class="skeleton w-full h-full" />
</template>

<script setup lang="ts">
/**
 * AppSkeleton — Phase 2 unified loading placeholder.
 *
 * Variants:
 *  - card    : full product/article card shape
 *  - line    : single line of text (use widthClass)
 *  - image   : image placeholder (4:3)
 *  - avatar  : circle (use size)
 *  - custom  : the parent controls dimensions
 */
withDefaults(defineProps<{
  variant?: 'card' | 'line' | 'image' | 'avatar' | 'custom'
  size?: number
  lineClass?: string
}>(), {
  variant: 'custom',
  size: 32,
  lineClass: 'w-full',
})
</script>
