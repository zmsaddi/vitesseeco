<template>
  <div class="space-y-1">
    <label
      v-if="label"
      :for="id"
      class="input-label"
      :class="required ? 'required' : ''"
    >
      {{ label }}
    </label>

    <div class="relative">
      <Icon
        v-if="iconLeft"
        :name="iconLeft"
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none"
      />
      <input
        :id="id"
        :name="name || id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :autocomplete="autocomplete"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-error` : help ? `${id}-help` : undefined"
        :class="[
          'input-field',
          error ? 'input-error' : '',
          iconLeft ? 'pl-10' : '',
        ]"
        @input="onInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />
    </div>

    <p v-if="error" :id="`${id}-error`" class="input-error-text" role="alert">
      <Icon name="ph:warning-circle" class="w-3.5 h-3.5 shrink-0" />
      <span>{{ error }}</span>
    </p>
    <p v-else-if="help" :id="`${id}-help`" class="input-help">
      {{ help }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * AppInput — Phase 2 unified text input.
 *
 * Manages: label + required marker, optional left icon, error + help text,
 * accessible aria-invalid / aria-describedby wiring.
 *
 * v-model is the value. Pass type='email' / 'tel' / 'password' / etc. to
 * forward to the native input. Browser-level validation is delegated.
 */
const props = defineProps<{
  modelValue: string | number | null | undefined
  id: string
  name?: string
  type?: string
  label?: string
  placeholder?: string
  help?: string
  error?: string
  iconLeft?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  autocomplete?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'blur': [event: FocusEvent]
  'focus': [event: FocusEvent]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>
