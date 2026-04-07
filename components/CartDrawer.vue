<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-50" @click.self="close">
      <div class="absolute inset-0 bg-black/60" @click="close" />
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="isOpen"
          class="absolute right-0 top-0 h-full w-full max-w-md bg-primary border-l border-dark-tertiary shadow-2xl flex flex-col"
        >
          <div class="flex items-center justify-between p-6 border-b border-dark-tertiary">
            <h2 class="font-display text-xl font-bold">{{ $t('cart.title') }}</h2>
            <button @click="close" class="text-text-secondary hover:text-white transition-colors">
              <Icon name="ph:x" class="w-6 h-6" />
            </button>
          </div>
          <div class="flex-1 flex items-center justify-center p-6">
            <div class="text-center">
              <Icon name="ph:shopping-cart" class="w-16 h-16 text-dark-tertiary mx-auto mb-4" />
              <p class="text-text-secondary mb-4">{{ $t('cart.empty') }}</p>
              <NuxtLink :to="localePath('/produits')" class="btn-primary inline-block" @click="close">
                {{ $t('cart.empty_cta') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const isOpen = useState('cartOpen', () => false)

function close() {
  isOpen.value = false
}
</script>
