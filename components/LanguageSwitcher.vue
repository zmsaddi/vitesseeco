<template>
  <div class="relative" ref="dropdown">
    <button
      @click="open = !open"
      class="flex items-center gap-1.5 text-text-secondary hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-dark-secondary"
    >
      <span class="text-lg leading-none">{{ currentFlag }}</span>
      <Icon name="ph:caret-down" class="w-3 h-3" :class="{ 'rotate-180': open }" />
    </button>
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="absolute right-0 mt-2 w-44 bg-dark-secondary border border-dark-tertiary rounded-lg shadow-xl overflow-hidden z-50"
      >
        <button
          v-for="loc in visibleLocales"
          :key="loc.code"
          @click="switchLang(loc.code)"
          class="w-full text-left px-4 py-2.5 text-sm hover:bg-dark-tertiary transition-colors flex items-center gap-3"
          :class="locale === loc.code ? 'text-accent font-medium bg-accent/5' : 'text-text-secondary'"
        >
          <span class="text-lg leading-none">{{ flags[loc.code] }}</span>
          <span>{{ loc.name }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()
const open = ref(false)
const dropdown = ref<HTMLElement>()

const flags: Record<string, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  nl: '🇳🇱',
  de: '🇩🇪',
  ar: '🇸🇦',
}

const currentFlag = computed(() => flags[locale.value] || '🌐')

const hiddenLocales = ['ar']
const visibleLocales = computed(() =>
  (locales.value as Array<{ code: string; name?: string }>).filter(l => !hiddenLocales.includes(l.code))
)

function switchLang(code: string) {
  setLocale(code)
  open.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (dropdown.value && !dropdown.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>
