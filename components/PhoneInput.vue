<template>
  <div class="flex gap-2">
    <select
      :id="`${inputId}-code`"
      :name="`${inputId}-code`"
      v-model="countryCode"
      class="input-field w-28 shrink-0 text-sm"
      @change="emitValue"
    >
      <option v-for="c in countries" :key="c.code" :value="c.dial">
        {{ c.flag }} {{ c.dial }}
      </option>
    </select>
    <input
      :id="inputId"
      :name="inputId"
      type="tel"
      :value="localNumber"
      @input="onInput"
      class="input-field flex-1"
      :placeholder="placeholder || '6 12 34 56 78'"
      :required="required"
      autocomplete="tel-national"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  inputId?: string
  placeholder?: string
  required?: boolean
  defaultCountry?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const countries = [
  { code: 'FR', dial: '+33', flag: '🇫🇷' },
  { code: 'BE', dial: '+32', flag: '🇧🇪' },
  { code: 'LU', dial: '+352', flag: '🇱🇺' },
  { code: 'DE', dial: '+49', flag: '🇩🇪' },
  { code: 'NL', dial: '+31', flag: '🇳🇱' },
  { code: 'ES', dial: '+34', flag: '🇪🇸' },
]

const countryCode = ref('+33')
const localNumber = ref('')

// Parse initial value
onMounted(() => {
  if (props.modelValue) {
    const match = countries.find(c => props.modelValue.startsWith(c.dial))
    if (match) {
      countryCode.value = match.dial
      localNumber.value = props.modelValue.slice(match.dial.length).trim()
    } else {
      localNumber.value = props.modelValue
    }
  }
  if (props.defaultCountry) {
    const match = countries.find(c => c.code === props.defaultCountry)
    if (match) countryCode.value = match.dial
  }
})

function onInput(e: Event) {
  localNumber.value = (e.target as HTMLInputElement).value
  emitValue()
}

function emitValue() {
  const num = localNumber.value.replace(/\s/g, '')
  emit('update:modelValue', num ? `${countryCode.value} ${localNumber.value}` : '')
}
</script>
