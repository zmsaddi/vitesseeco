<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div v-if="show" class="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div class="container-custom">
        <div class="bg-dark-secondary border border-dark-tertiary rounded-xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-2xl">
          <div class="flex-1">
            <p class="text-white text-sm font-medium mb-1">🍪 Cookies</p>
            <p class="text-text-secondary text-xs leading-relaxed">
              {{ cookieText }}
              <NuxtLink :to="localePath('/politique-confidentialite')" class="text-accent hover:underline">{{ $t('footer.privacy') }}</NuxtLink>
            </p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button @click="accept" class="btn-primary py-2 px-5 text-sm">OK</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const localePath = useLocalePath()
const show = ref(false)

const texts: Record<string, string> = {
  fr: 'Ce site utilise des cookies techniques nécessaires à son fonctionnement et des cookies de préférence linguistique.',
  en: 'This site uses technical cookies necessary for its operation and language preference cookies.',
  es: 'Este sitio utiliza cookies técnicas necesarias para su funcionamiento y cookies de preferencia de idioma.',
  nl: 'Deze site gebruikt technische cookies die nodig zijn voor de werking en taalvoorkeurcookies.',
  de: 'Diese Website verwendet technische Cookies, die für ihren Betrieb erforderlich sind, sowie Sprachpräferenz-Cookies.',
  ar: 'يستخدم هذا الموقع ملفات تعريف ارتباط تقنية ضرورية لعمله وملفات تفضيل اللغة.',
}
const cookieText = computed(() => texts[locale.value] || texts.fr)

function accept() {
  show.value = false
  if (import.meta.client) {
    localStorage.setItem('cookie_consent', 'accepted')
  }
}

onMounted(() => {
  if (!localStorage.getItem('cookie_consent')) {
    setTimeout(() => { show.value = true }, 1500)
  }
})
</script>
