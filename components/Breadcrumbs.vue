<template>
  <nav aria-label="Fil d'Ariane" class="text-sm">
    <ol class="flex items-center flex-wrap gap-1.5 text-on-surface-muted">
      <li v-for="(item, i) in items" :key="i" class="flex items-center gap-1.5 min-w-0">
        <Icon v-if="i > 0" name="heroicons:chevron-right" class="w-3.5 h-3.5 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
        <NuxtLink
          v-if="item.to && i < items.length - 1"
          :to="item.to"
          class="hover:text-on-surface transition-colors duration-200 truncate"
        >
          {{ item.label }}
        </NuxtLink>
        <span v-else class="text-on-surface truncate" aria-current="page">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{ label: string; to?: string }>
}>()
</script>
