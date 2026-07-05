<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="modelValue" class="fixed inset-0 z-modal" @keydown.esc="close">
        <div class="absolute inset-0 bg-primary/80 backdrop-blur-sm" @click="close" />
        <div
          class="absolute inset-x-0 bottom-0 bg-surface border-t border-surface-2 rounded-t-2xl max-h-[85dvh] flex flex-col"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <div class="mx-auto mt-2.5 h-1 w-10 rounded-full bg-surface-2 shrink-0" aria-hidden="true" />
          <header class="flex items-center gap-3 px-5 pt-3 pb-1 shrink-0">
            <h2 class="flex-1 font-display font-bold">{{ title }}</h2>
            <button
              type="button"
              class="p-2 -me-2 rounded-lg text-on-surface-muted hover:bg-surface-2"
              :aria-label="$t('nav.close_menu')"
              @click="close"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </header>
          <div class="px-5 py-4 overflow-y-auto">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shrink-0 border-t border-surface-2">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; title: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (import.meta.server) return
    document.body.style.overflow = open ? 'hidden' : ''
  }
)

onBeforeUnmount(() => {
  if (!import.meta.server) document.body.style.overflow = ''
})
</script>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active > div:last-child,
.sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from > div:last-child,
.sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
