<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <!-- P1-05: compact bottom bar on mobile (single row, no border padding,
         small font). Expands to a card on >=sm. Takes <=10% viewport height
         on small screens vs ~25% before. -->
    <div v-if="show" class="fixed bottom-0 left-0 right-0 z-30 sm:p-4">
      <div class="container-custom sm:px-4">
        <div class="bg-dark-secondary border-t sm:border border-dark-tertiary sm:rounded-xl px-4 py-2.5 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-2xl">
          <div class="flex-1 min-w-0">
            <p class="hidden sm:block text-white text-sm font-medium mb-1">🍪 {{ $t('legal.cookies') }}</p>
            <p class="text-text-secondary text-xs leading-snug truncate sm:whitespace-normal sm:truncate-none">
              <span class="sm:hidden">🍪 </span>{{ $t('legal.cookie_notice') }}
              <NuxtLink :to="localePath('/politique-confidentialite')" class="text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent whitespace-nowrap">{{ $t('footer.privacy') }}</NuxtLink>
            </p>
          </div>
          <button
            @click="accept"
            class="btn-primary py-2 px-4 sm:px-5 text-sm shrink-0 min-h-[44px]"
            :aria-label="$t('legal.cookies')"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const show = ref(false)

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
