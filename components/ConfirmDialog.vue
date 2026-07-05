<template>
  <AppDialog :model-value="modelValue" :title="title" persistent @update:model-value="onCancel">
    <p class="text-sm text-on-surface-muted whitespace-pre-wrap">{{ message }}</p>
    <template #footer>
      <button
        type="button"
        class="rounded-lg bg-surface-2 px-4 py-2.5 text-sm font-medium min-h-touch"
        :disabled="loading"
        @click="onCancel"
      >
        {{ cancelLabel }}
      </button>
      <button
        type="button"
        class="rounded-lg px-4 py-2.5 text-sm font-semibold min-h-touch disabled:opacity-50 inline-flex items-center gap-2"
        :class="danger ? 'bg-danger text-white' : 'bg-accent text-primary'"
        :disabled="loading"
        @click="$emit('confirm')"
      >
        <Icon v-if="loading" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
        {{ confirmLabel }}
      </button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  /** Red confirm button for destructive actions. */
  danger?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function onCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>
