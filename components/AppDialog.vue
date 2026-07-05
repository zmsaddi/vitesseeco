<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-modal flex items-center justify-center p-4"
        @keydown.esc="close"
      >
        <div class="absolute inset-0 bg-primary/80 backdrop-blur-sm" @click="persistent ? null : close()" />
        <div
          ref="panel"
          class="relative w-full max-w-md bg-surface border border-surface-2 rounded-2xl shadow-2xl flex flex-col max-h-[85dvh]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <header v-if="title || !hideClose" class="flex items-center gap-3 px-5 pt-5 pb-1 shrink-0">
            <h2 v-if="title" class="flex-1 font-display font-bold text-lg">{{ title }}</h2>
            <button
              v-if="!hideClose"
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

          <footer v-if="$slots.footer" class="flex flex-wrap justify-end gap-2 px-5 pb-5 pt-1 shrink-0">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    /** Overlay click does not close (forced-choice dialogs). Esc still works. */
    persistent?: boolean
    hideClose?: boolean
  }>(),
  { title: '', persistent: false, hideClose: false }
)

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const panel = ref<HTMLElement>()

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (import.meta.server) return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) nextTick(() => panel.value?.focus())
  }
)

onBeforeUnmount(() => {
  if (!import.meta.server) document.body.style.overflow = ''
})
</script>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
