<template>
  <div class="relative">
    <input
      :id="inputId"
      :name="inputId"
      ref="inputRef"
      type="text"
      :value="modelValue"
      @input="onInput"
      @focus="showSuggestions = true"
      class="input-field"
      :placeholder="placeholder"
      autocomplete="off"
      required
    />
    <!-- Suggestions dropdown -->
    <div
      v-if="showSuggestions && suggestions.length > 0"
      class="absolute z-50 left-0 right-0 mt-1 bg-dark-secondary border border-dark-tertiary rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
    >
      <button
        v-for="s in suggestions"
        :key="s.place_id"
        @mousedown.prevent="selectSuggestion(s)"
        class="w-full text-left px-4 py-3 text-sm text-text-secondary hover:bg-dark-tertiary hover:text-white transition-colors flex items-start gap-2"
      >
        <Icon name="ph:map-pin" class="w-4 h-4 shrink-0 mt-0.5 text-accent" />
        <span>{{ s.description }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  inputId?: string
  placeholder?: string
  countries?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'select': [details: { address: string; city: string; postalCode: string; country: string }]
}>()

const inputRef = ref<HTMLInputElement>()
const suggestions = ref<any[]>([])
const showSuggestions = ref(false)
let debounceTimer: ReturnType<typeof setTimeout>

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:modelValue', val)

  clearTimeout(debounceTimer)
  if (val.length < 3) {
    suggestions.value = []
    return
  }

  debounceTimer = setTimeout(() => fetchSuggestions(val), 300)
}

async function fetchSuggestions(query: string) {
  try {
    const data = await $fetch('/api/places/autocomplete', {
      query: {
        input: query,
        countries: (props.countries || ['fr', 'be', 'lu', 'de', 'nl', 'es']).join(','),
      },
    })
    suggestions.value = (data as any).predictions || []
  } catch {
    suggestions.value = []
  }
}

async function selectSuggestion(s: any) {
  showSuggestions.value = false
  emit('update:modelValue', s.structured_formatting?.main_text || s.description)

  try {
    const data = await $fetch('/api/places/details', { query: { place_id: s.place_id } })
    const result = data as any
    if (result.address) {
      emit('select', result)
    }
  } catch {}
}

// Close on click outside
function onClickOutside(e: MouseEvent) {
  if (inputRef.value && !inputRef.value.parentElement?.contains(e.target as Node)) {
    showSuggestions.value = false
  }
}
onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
