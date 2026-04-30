<template>
  <div class="relative" ref="dropdown">
    <button
      @click="open = !open"
      class="flex items-center gap-1.5 text-text-secondary hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-dark-secondary min-h-touch focus-ring"
      :aria-expanded="open"
      :aria-label="currentLocaleName"
    >
      <Icon :name="currentFlag" class="w-5 h-4 rounded-sm" />
      <span class="text-sm font-medium">{{ currentLocaleData?.short }}</span>
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
        class="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-48 bg-dark-secondary border border-dark-tertiary rounded-lg shadow-xl overflow-hidden z-dropdown"
      >
        <button
          v-for="loc in allLocales"
          :key="loc.code"
          @click="switchLang(loc.code)"
          class="w-full text-start px-4 py-2.5 text-sm hover:bg-dark-tertiary transition-colors flex items-center gap-3 min-h-touch focus-ring"
          :class="locale === loc.code ? 'text-accent font-medium bg-accent/5' : 'text-text-secondary'"
        >
          <Icon :name="localeData[loc.code]?.flag || 'twemoji:globe-with-meridians'" class="w-5 h-4 rounded-sm shrink-0" />
          <span>{{ loc.name }}</span>
          <Icon v-if="locale === loc.code" name="ph:check-circle-fill" class="w-4 h-4 ms-auto text-accent" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()
const open = ref(false)
const dropdown = ref<HTMLElement>()

// SVG flag icons via Iconify (twemoji set) — render reliably on Windows
// browsers that lack native country-flag emoji glyphs in their system fonts.
// Without this, FR/GB/ES/etc. emoji collapse to plain country-code letters
// on Chrome/Edge/Firefox on Windows.
const localeData: Record<string, { flag: string; short: string }> = {
  fr: { flag: 'twemoji:flag-france',          short: 'FR' },
  en: { flag: 'twemoji:flag-united-kingdom',  short: 'EN' },
  es: { flag: 'twemoji:flag-spain',           short: 'ES' },
  nl: { flag: 'twemoji:flag-netherlands',     short: 'NL' },
  de: { flag: 'twemoji:flag-germany',         short: 'DE' },
  ar: { flag: 'twemoji:flag-saudi-arabia',    short: 'AR' },
}

const currentLocaleData = computed(() => localeData[locale.value])
const currentFlag = computed(() => currentLocaleData.value?.flag || 'twemoji:globe-with-meridians')
const currentLocaleName = computed(() => {
  const found = (locales.value as Array<{ code: string; name?: string }>).find(l => l.code === locale.value)
  return found?.name || locale.value || 'Language'
})

const allLocales = computed(() =>
  locales.value as Array<{ code: string; name?: string }>
)

function switchLang(code: string) {
  // Save choice so LanguageBanner never shows again + detect-language respects it
  if (import.meta.client) {
    localStorage.setItem('ve_lang_choice', code)
    localStorage.removeItem('ve_lang_detected')
  }
  setLocale(code as any)
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
