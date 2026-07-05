<template>
  <Teleport to="body">
    <div
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-toast flex flex-col items-center gap-2 pointer-events-none px-4"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      <TransitionGroup
        enter-active-class="transition duration-fast ease-soft"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-fast ease-soft"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="[
            'pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-2xl border max-w-sm text-sm',
            variantClass(t.type),
          ]"
          :role="t.type === 'error' ? 'alert' : 'status'"
        >
          <Icon :name="iconFor(t.type)" class="w-4 h-4 shrink-0" />
          <span class="flex-1">{{ t.message }}</span>
          <button
            v-if="t.action"
            @click="t.action.handler(); dismiss(t.id)"
            class="shrink-0 font-bold underline underline-offset-2 min-h-touch px-1.5 hover:opacity-80"
          >
            {{ t.action.label }}
          </button>
          <button
            @click="dismiss(t.id)"
            :aria-label="$t('nav.close_menu')"
            class="text-current opacity-60 hover:opacity-100 min-w-touch min-h-touch -mr-2 flex items-center justify-center"
          >
            <Icon name="ph:x" class="w-3.5 h-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * AppToast — global toast renderer (P2-10).
 * Mount once (e.g. in default layout); reads queue from useToast().
 */
const { toasts, dismiss } = useToast()

function variantClass(type: string) {
  switch (type) {
    case 'success': return 'bg-accent text-primary border-accent'
    case 'error':   return 'bg-danger text-white border-danger'
    case 'warning': return 'bg-gold text-primary border-gold'
    default:        return 'bg-dark-secondary text-white border-dark-tertiary'
  }
}

function iconFor(type: string) {
  switch (type) {
    case 'success': return 'ph:check-circle'
    case 'error':   return 'ph:x-circle'
    case 'warning': return 'ph:warning'
    default:        return 'ph:info'
  }
}
</script>
