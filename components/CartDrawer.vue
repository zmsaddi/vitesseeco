<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/60" @click="close" />
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="ltr:translate-x-full rtl:-translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="ltr:translate-x-full rtl:-translate-x-full"
      >
        <div
          v-if="isOpen"
          class="absolute ltr:right-0 rtl:left-0 top-0 h-full w-full max-w-md bg-primary border-l border-dark-tertiary shadow-2xl flex flex-col"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-dark-tertiary">
            <h2 class="font-display text-xl font-bold">{{ $t('cart.title') }} ({{ cart.totalItems }})</h2>
            <button @click="close" class="text-text-secondary hover:text-white transition-colors">
              <Icon name="ph:x" class="w-6 h-6" />
            </button>
          </div>

          <!-- Empty State -->
          <div v-if="cart.isEmpty" class="flex-1 flex items-center justify-center p-6">
            <div class="text-center">
              <Icon name="ph:shopping-cart" class="w-16 h-16 text-dark-tertiary mx-auto mb-4" />
              <p class="text-text-secondary mb-4">{{ $t('cart.empty') }}</p>
              <NuxtLink :to="localePath('/produits')" class="btn-primary inline-block" @click="close">
                {{ $t('cart.empty_cta') }}
              </NuxtLink>
            </div>
          </div>

          <!-- Cart Items -->
          <div v-else class="flex-1 overflow-y-auto p-6 space-y-4">
            <div
              v-for="item in cart.items"
              :key="`${item.productId}-${item.sku}`"
              class="flex gap-4 bg-dark-secondary rounded-lg p-3"
            >
              <div class="w-16 h-16 rounded-lg bg-dark-tertiary flex items-center justify-center shrink-0 overflow-hidden">
                <img v-if="item.image" :src="item.image" :alt="l(item.name)" class="w-full h-full object-cover" />
                <span v-else class="w-8 h-8 rounded-full border-2 border-white/20" :style="{ backgroundColor: item.colorHex }" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-white text-sm font-medium truncate">{{ l(item.name) }}</h3>
                <p class="text-text-secondary text-xs">{{ l(item.colorName) }}</p>
                <p class="text-accent font-bold text-sm mt-1">{{ item.price }}{{ $t('common.currency') }}</p>
              </div>
              <div class="flex flex-col items-end gap-2">
                <button @click="cart.removeItem(item.productId, item.sku)" :aria-label="$t('cart.remove')" class="text-text-secondary hover:text-red-400 transition-colors">
                  <Icon name="ph:trash" class="w-4 h-4" />
                </button>
                <div class="flex items-center gap-1">
                  <button
                    @click="cart.updateQuantity(item.productId, item.sku, item.quantity - 1)"
                    :aria-label="$t('cart.quantity') + ' -'"
                    class="w-6 h-6 rounded bg-dark-tertiary flex items-center justify-center text-xs hover:bg-accent hover:text-primary transition-colors"
                  >-</button>
                  <input
                    type="number"
                    :id="`cart-qty-${item.sku}`"
                    :name="`qty-${item.sku}`"
                    :value="item.quantity"
                    @change="cart.updateQuantity(item.productId, item.sku, Math.max(1, Math.min(10, Number(($event.target as HTMLInputElement).value))))"
                    min="1" max="10"
                    class="text-white text-sm w-8 text-center bg-transparent border-none outline-none"
                    :aria-label="$t('cart.quantity')"
                  />
                  <button
                    @click="cart.updateQuantity(item.productId, item.sku, item.quantity + 1)"
                    :aria-label="$t('cart.quantity') + ' +'"
                    class="w-6 h-6 rounded bg-dark-tertiary flex items-center justify-center text-xs hover:bg-accent hover:text-primary transition-colors"
                  >+</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div v-if="!cart.isEmpty" class="border-t border-dark-tertiary p-6 space-y-4">
            <div class="flex justify-between text-sm">
              <span class="text-text-secondary">{{ $t('cart.subtotal') }}</span>
              <span class="text-white font-semibold">{{ cart.subtotal }}{{ $t('common.currency') }}</span>
            </div>
            <div v-if="cart.discount > 0" class="flex justify-between text-sm">
              <span class="text-accent">{{ $t('cart.discount') }}</span>
              <span class="text-accent font-semibold">-{{ cart.discount }}{{ $t('common.currency') }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-text-secondary">{{ $t('cart.shipping') }}</span>
              <span class="text-text-secondary">{{ $t('cart.shipping_calculated') }}</span>
            </div>
            <div class="flex justify-between border-t border-dark-tertiary pt-3">
              <span class="text-white font-display font-semibold">{{ $t('cart.total') }}</span>
              <span class="text-accent font-display font-bold text-xl">{{ cart.total }}{{ $t('common.currency') }}</span>
            </div>
            <NuxtLink :to="localePath('/panier')" class="btn-primary w-full text-center block" @click="close">
              {{ $t('cart.checkout') }}
            </NuxtLink>
            <button @click="close" class="w-full text-center text-text-secondary text-sm hover:text-accent transition-colors">
              {{ $t('cart.continue_shopping') }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const l = useLocalizedField()
const cart = useCartStore()
const isOpen = useState('cartOpen', () => false)

function close() {
  isOpen.value = false
}

// Body scroll lock when drawer is open
watch(isOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

// Close on Escape key
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) close()
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>
