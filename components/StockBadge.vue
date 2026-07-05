<template>
  <span class="inline-flex items-center gap-1.5 text-sm font-medium" :class="colorClass">
    <span class="w-2 h-2 rounded-full shrink-0" :class="dotClass" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    stock: number | null | undefined
    /** Below or equal → show the urgency "only X left" variant. */
    lowThreshold?: number
  }>(),
  { lowThreshold: 5 }
)

const { t } = useI18n()

const state = computed(() => {
  const s = props.stock ?? 0
  if (s <= 0) return 'out'
  if (s <= props.lowThreshold) return 'low'
  return 'in'
})

const label = computed(() => {
  if (state.value === 'out') return t('product.out_of_stock')
  if (state.value === 'low') return t('product.low_stock', { count: props.stock })
  return t('product.in_stock')
})

const colorClass = computed(
  () => ({ in: 'text-accent', low: 'text-warning', out: 'text-danger' })[state.value]
)
const dotClass = computed(
  () => ({ in: 'bg-accent', low: 'bg-warning', out: 'bg-danger' })[state.value]
)
</script>
