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
    />
    <!-- Loading -->
    <div v-if="loading" class="absolute right-3 top-1/2 -translate-y-1/2">
      <Icon name="ph:spinner" class="w-4 h-4 text-accent animate-spin" />
    </div>
    <!-- Suggestions dropdown -->
    <div
      v-if="showSuggestions && suggestions.length > 0"
      class="absolute z-50 left-0 right-0 mt-1 bg-dark-secondary border border-dark-tertiary rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
    >
      <button
        v-for="s in suggestions"
        :key="s.place_id"
        type="button"
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
const loading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout>

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:modelValue', val)

  clearTimeout(debounceTimer)
  if (val.length < 3) {
    suggestions.value = []
    loading.value = false
    return
  }

  loading.value = true
  debounceTimer = setTimeout(() => fetchSuggestions(val), 400)
}

async function fetchSuggestions(query: string) {
  try {
    const data = await $fetch<any>('/api/places/autocomplete', {
      query: {
        input: query,
        countries: (props.countries || ['fr', 'be', 'lu', 'de', 'nl', 'es']).join(','),
      },
    })
    suggestions.value = data.predictions || []
  } catch (e) {
    console.error('Places autocomplete error:', e)
    suggestions.value = []
  } finally {
    loading.value = false
  }
}

async function selectSuggestion(s: any) {
  showSuggestions.value = false
  suggestions.value = []
  emit('update:modelValue', s.structured_formatting?.main_text || s.description)

  try {
    const data = await $fetch<any>('/api/places/details', { query: { place_id: s.place_id } })
    if (data.address) {
      emit('select', data)
    }
  } catch (e) {
    console.error('Places details error:', e)
  }
}

function onClickOutside(e: MouseEvent) {
  if (inputRef.value && !inputRef.value.parentElement?.contains(e.target as Node)) {
    showSuggestions.value = false
  }
}
onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
