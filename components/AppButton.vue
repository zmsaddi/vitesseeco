<template>
  <component
    :is="tag"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' && (disabled || loading) ? true : undefined"
    :aria-busy="loading || undefined"
    :class="[
      variantClass,
      sizeClass,
      loading && 'btn-loading',
      block && 'w-full',
      className,
    ]"
  >
    <Icon
      v-if="loading"
      name="ph:spinner-gap"
      class="animate-spin"
      :class="iconSize"
    />
    <Icon
      v-else-if="iconLeft"
      :name="iconLeft"
      :class="iconSize"
    />
    <span v-if="$slots.default" :class="[loading || iconLeft || iconRight ? 'mx-1' : '']">
      <slot />
    </span>
    <Icon
      v-if="iconRight && !loading"
      :name="iconRight"
      :class="iconSize"
    />
  </component>
</template>

<script setup lang="ts">
/**
 * AppButton — Phase 2 unified button component.
 *
 * Variants:  primary | secondary | outline | danger | ghost
 * Sizes:     xs | sm | md (default)
 * Slots:     default (label)
 * Props:     iconLeft | iconRight (Iconify name), loading, disabled, block
 *
 * Falls back to <button> by default; pass tag="a" or tag="NuxtLink" for links.
 * Loading prop disables interaction and shows a spinner in place of the left
 * icon. Disabled prop applies opacity + cursor styling via .btn-base.
 */
type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
type Size = 'xs' | 'sm' | 'md'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  type?: 'button' | 'submit' | 'reset'
  tag?: string
  loading?: boolean
  disabled?: boolean
  block?: boolean
  iconLeft?: string
  iconRight?: string
  className?: string
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  tag: 'button',
  loading: false,
  disabled: false,
  block: false,
})

const variantClass = computed(() => {
  switch (props.variant) {
    case 'secondary': return 'btn-secondary'
    case 'outline':   return 'btn-outline'
    case 'danger':    return 'btn-danger'
    case 'ghost':     return 'btn-ghost'
    default:          return 'btn-primary'
  }
})

const sizeClass = computed(() => {
  if (props.size === 'xs') return 'btn-xs'
  if (props.size === 'sm') return 'btn-sm'
  return ''
})

const iconSize = computed(() => {
  if (props.size === 'xs') return 'w-3.5 h-3.5'
  if (props.size === 'sm') return 'w-4 h-4'
  return 'w-5 h-5'
})
</script>
