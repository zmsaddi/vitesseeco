<template>
  <div class="flex items-baseline gap-2 flex-wrap">
    <span class="font-bold text-accent" :class="sizeClasses">{{ format(price) }}</span>
    <template v-if="hasDiscount">
      <s class="text-on-surface-muted" :class="compareSizeClasses">{{ format(compareAt!) }}</s>
      <span class="rounded-md bg-danger/15 text-danger text-xs font-semibold px-1.5 py-0.5">
        −{{ discountPct }}%
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    price: number
    compareAt?: number | null
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { compareAt: null, size: 'md' }
)

const hasDiscount = computed(
  () => typeof props.compareAt === 'number' && props.compareAt > props.price
)
const discountPct = computed(() =>
  hasDiscount.value ? Math.round((1 - props.price / (props.compareAt as number)) * 100) : 0
)

const sizeClasses = computed(
  () => ({ sm: 'text-base', md: 'text-xl', lg: 'text-3xl' })[props.size]
)
const compareSizeClasses = computed(
  () => ({ sm: 'text-xs', md: 'text-sm', lg: 'text-base' })[props.size]
)

function format(n: number) {
  // invariant-ok: verified 2026-07-30 that this Node and Chromium both emit
  // U+202F here, so server and client agree. Latent if either ICU moves; the
  // rebuild avoids it entirely by formatting from cents with a literal euro sign.
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}
</script>
