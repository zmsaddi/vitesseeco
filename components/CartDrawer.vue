<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-modal">
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
            <button
              @click="close"
              class="text-text-secondary hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
              :aria-label="$t('nav.close_menu')"
            >
              <Icon name="ph:x" class="w-6 h-6" />
            </button>
          </div>

          <!-- Empty State (P3-06: unified via EmptyState) -->
          <div v-if="cart.isEmpty" class="flex-1 flex items-center justify-center">
            <EmptyState
              icon="ph:shopping-cart"
              :message="$t('cart.empty')"
              :cta-to="localePath('/produits')"
              :cta-label="$t('cart.empty_cta')"
              cta-icon="ph:arrow-right"
              :cta-action="() => close()"
            />
          </div>

          <!-- Cart Items -->
          <div v-else class="flex-1 overflow-y-auto p-6 space-y-4">
            <div
              v-for="item in cart.items"
              :key="`${item.productId}-${item.sku}`"
              class="flex gap-4 bg-dark-secondary rounded-lg p-3"
            >
              <!-- Image and name link back to the product page — a shopper must
                   always be able to re-check what they are buying. -->
              <NuxtLink
                :to="localePath(`/produits/${item.slug}`)"
                class="w-16 h-16 rounded-lg bg-dark-tertiary flex items-center justify-center shrink-0 overflow-hidden"
                @click="close"
              >
                <img v-if="item.image" :src="item.image" :alt="l(item.name)" class="w-full h-full object-cover" />
                <span v-else class="w-8 h-8 rounded-full border-2 border-white/20" :style="{ backgroundColor: item.colorHex }" />
              </NuxtLink>
              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="localePath(`/produits/${item.slug}`)"
                  class="text-white text-sm font-medium line-clamp-2 hover:text-accent transition-colors"
                  @click="close"
                >
                  {{ l(item.name) }}
                </NuxtLink>
                <p class="text-text-secondary text-xs">{{ l(item.colorName) }}</p>
                <p class="text-accent font-bold text-sm mt-1">
                  {{ item.price }}{{ $t('common.currency') }}
                  <span v-if="item.quantity > 1" class="text-text-secondary font-normal text-xs">× {{ item.quantity }} = {{ (item.price * item.quantity).toFixed(2) }}{{ $t('common.currency') }}</span>
                </p>
              </div>
              <!-- P1-06: every interactive element is now ≥44px hit area on mobile -->
              <div class="flex flex-col items-end gap-2">
                <button
                  @click="removeWithUndo(item)"
                  :aria-label="$t('cart.remove')"
                  class="text-text-secondary hover:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Icon name="ph:trash" class="w-5 h-5" />
                </button>
                <div class="flex items-center gap-1">
                  <button
                    @click="cart.updateQuantity(item.productId, item.sku, item.quantity - 1)"
                    :aria-label="$t('cart.decrease_quantity')"
                    class="w-11 h-11 rounded bg-dark-tertiary flex items-center justify-center text-base font-medium hover:bg-accent hover:text-primary transition-colors"
                  >−</button>
                  <input
                    type="number"
                    :id="`cart-qty-${item.sku}`"
                    :name="`qty-${item.sku}`"
                    :value="item.quantity"
                    @change="cart.updateQuantity(item.productId, item.sku, Math.max(1, Math.min(10, Number(($event.target as HTMLInputElement).value))))"
                    min="1" max="10"
                    class="text-white text-sm w-10 h-11 text-center bg-transparent border-none outline-none"
                    :aria-label="$t('cart.quantity')"
                  />
                  <button
                    @click="cart.updateQuantity(item.productId, item.sku, item.quantity + 1)"
                    :aria-label="$t('cart.increase_quantity')"
                    class="w-11 h-11 rounded bg-dark-tertiary flex items-center justify-center text-base font-medium hover:bg-accent hover:text-primary transition-colors"
                  >+</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div v-if="!cart.isEmpty" class="border-t border-dark-tertiary p-6 space-y-4">
            <!-- U-P4: free-shipping progress — the strongest average-basket lever -->
            <div v-if="freeShippingThreshold > 0 && cart.subtotal < freeShippingThreshold" class="bg-accent/5 border border-accent/20 rounded-lg p-3">
              <p class="text-xs text-text-secondary mb-1.5">
                {{ $t('shipping.free_above', { amount: freeShippingThreshold }) }}
              </p>
              <div class="h-2 bg-dark-tertiary rounded-full overflow-hidden">
                <div class="bg-accent h-2 rounded-full transition-all" :style="{ width: Math.min(100, (cart.subtotal / freeShippingThreshold) * 100) + '%' }" />
              </div>
              <p class="text-xs text-accent mt-1.5">{{ Math.ceil(freeShippingThreshold - cart.subtotal) }}{{ $t('common.currency') }} {{ $t('shipping.remaining_free') }}</p>
            </div>
            <div v-else-if="freeShippingThreshold > 0" class="flex items-center gap-2 text-accent text-xs bg-accent/5 border border-accent/20 rounded-lg p-3">
              <Icon name="ph:truck" class="w-4 h-4 shrink-0" /> {{ $t('shipping.free_unlocked') }}
            </div>
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
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const cart = useCartStore()
const toast = useToast()
const isOpen = useState('cartOpen', () => false)

function close() {
  isOpen.value = false
}

// U-P4: remove with Undo on the toast — same pattern as /panier.
function removeWithUndo(item: any) {
  const snapshot = { ...item }
  cart.removeItem(item.productId, item.sku)
  toast.info(t('cart.removed_with_undo', { name: l(item.name) }), 6000, {
    label: t('common.undo'),
    handler: () => cart.addItem(snapshot, snapshot.quantity),
  })
}

// U-P4: free-shipping threshold, fetched once the drawer first opens
// (min freeAbove across active methods — same rule as /panier).
const shippingMethods = ref<any[]>([])
const shippingLoaded = ref(false)
const freeShippingThreshold = computed(() => {
  const thresholds = shippingMethods.value.filter((m: any) => m.freeAbove).map((m: any) => m.freeAbove)
  return thresholds.length ? Math.min(...thresholds) : 0
})

// Body scroll lock when drawer is open + lazy shipping fetch
watch(isOpen, async (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open && !shippingLoaded.value) {
    shippingLoaded.value = true
    try {
      const res: any = await $fetch('/api/shipping/methods', { query: { zone: cart.shippingZone || 'FR' } })
      shippingMethods.value = res.methods || []
    } catch { /* progress bar simply stays hidden */ }
  }
})

// Close on Escape key
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) close()
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>
