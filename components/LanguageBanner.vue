<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-full opacity-0"
  >
    <!-- P1-04: positioned below header (top-16) with lower z-index so the
         header stays clickable. Was top-0 z-[60] which covered the language
         switcher and other header controls. -->
    <div v-if="show" class="fixed top-16 left-0 right-0 z-30 bg-dark-secondary/95 backdrop-blur-sm border-b border-dark-tertiary shadow-xl">
      <div class="container-custom py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <Icon :name="detectedFlag" class="w-6 h-5 rounded-sm shrink-0" />
          <p class="text-white text-sm">
            {{ bannerText }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            @click="switchToDetected"
            class="bg-accent text-primary px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            {{ switchLabel }}
          </button>
          <button
            @click="stayInFrench"
            class="text-text-secondary hover:text-white px-3 py-1.5 rounded-lg text-sm border border-dark-tertiary hover:border-white/30 transition-colors"
          >
            Continuer en français
          </button>
          <button @click="stayInFrench" class="text-text-secondary hover:text-white ml-1" :aria-label="$t('nav.close_menu')">
            <Icon name="ph:x" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { setLocale } = useI18n()
const show = ref(false)
const detectedLang = ref('')

// SVG flag icons (twemoji) — render on Windows where native country-flag
// emoji are not in the system font.
const localeInfo: Record<string, { flag: string; name: string; switchLabel: string; bannerText: string }> = {
  en: {
    flag: 'twemoji:flag-united-kingdom',
    name: 'English',
    switchLabel: 'Switch to English',
    bannerText: 'It looks like you speak English. Would you like to browse in English?',
  },
  es: {
    flag: 'twemoji:flag-spain',
    name: 'Español',
    switchLabel: 'Cambiar a español',
    bannerText: 'Parece que hablas español. ¿Te gustaría navegar en español?',
  },
  nl: {
    flag: 'twemoji:flag-netherlands',
    name: 'Nederlands',
    switchLabel: 'Naar Nederlands',
    bannerText: 'Het lijkt erop dat je Nederlands spreekt. Wil je in het Nederlands bladeren?',
  },
  de: {
    flag: 'twemoji:flag-germany',
    name: 'Deutsch',
    switchLabel: 'Auf Deutsch wechseln',
    bannerText: 'Es sieht so aus, als ob Sie Deutsch sprechen. Möchten Sie auf Deutsch weiterlesen?',
  },
  ar: {
    flag: 'twemoji:flag-saudi-arabia',
    name: 'العربية',
    switchLabel: 'التبديل للعربية',
    bannerText: 'يبدو أنك تتحدث العربية. هل تريد تصفح الموقع بالعربية؟',
  },
}

const detectedFlag = computed(() => localeInfo[detectedLang.value]?.flag || 'twemoji:globe-with-meridians')
const bannerText = computed(() => localeInfo[detectedLang.value]?.bannerText || '')
const switchLabel = computed(() => localeInfo[detectedLang.value]?.switchLabel || '')

function switchToDetected() {
  const lang = detectedLang.value
  localStorage.setItem('ve_lang_choice', lang)
  localStorage.removeItem('ve_lang_detected')
  show.value = false
  setLocale(lang as any)
}

function stayInFrench() {
  localStorage.setItem('ve_lang_choice', 'fr')
  localStorage.removeItem('ve_lang_detected')
  show.value = false
}

onMounted(() => {
  // Already chose? Don't show
  if (localStorage.getItem('ve_lang_choice')) return

  const detected = localStorage.getItem('ve_lang_detected')
  if (detected && localeInfo[detected]) {
    detectedLang.value = detected
    // Small delay so page renders first
    setTimeout(() => { show.value = true }, 800)
  }
})
</script>
