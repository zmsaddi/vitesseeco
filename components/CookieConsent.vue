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
            <p class="text-white text-sm font-medium mb-1">🍪 {{ $t('legal.cookies') }}</p>
            <p class="text-text-secondary text-xs leading-relaxed">
              {{ $t('legal.cookie_notice') }}
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
