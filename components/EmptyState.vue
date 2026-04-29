<template>
  <div class="text-center py-12 px-4" role="status">
    <Icon
      v-if="icon"
      :name="icon"
      class="text-dark-tertiary mx-auto mb-4"
      :class="iconSize"
    />
    <h3 v-if="title" class="text-white font-display font-semibold text-lg mb-2">
      {{ title }}
    </h3>
    <p v-if="message" class="text-text-secondary text-sm md:text-base mb-6 max-w-md mx-auto">
      {{ message }}
    </p>
    <NuxtLink
      v-if="ctaTo && ctaLabel"
      :to="ctaTo"
      class="btn-primary inline-flex items-center gap-2 btn-sm"
      @click="ctaAction?.()"
    >
      <Icon v-if="ctaIcon" :name="ctaIcon" class="w-4 h-4" />
      {{ ctaLabel }}
    </NuxtLink>
    <button
      v-else-if="ctaAction && ctaLabel"
      @click="ctaAction"
      class="btn-primary inline-flex items-center gap-2 btn-sm"
    >
      <Icon v-if="ctaIcon" :name="ctaIcon" class="w-4 h-4" />
      {{ ctaLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * EmptyState — unified empty/zero/no-results UI (P3-06).
 *
 * Use everywhere a list, cart, results page, or account section has no
 * content. Keeps the visual language consistent: icon (muted) → title →
 * supporting message → optional CTA (link or button action).
 */
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  icon?: string
  title?: string
  message?: string
  ctaTo?: string
  ctaLabel?: string
  ctaIcon?: string
  ctaAction?: () => void
  size?: Size
}>(), {
  size: 'md',
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-12 h-12'
    case 'lg': return 'w-24 h-24'
    default:   return 'w-16 h-16'
  }
})
</script>
