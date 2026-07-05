<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <h1 class="section-title mb-8">{{ $t('cart.title') }}</h1>

      <!-- Known-issue #2: cart state is restored from localStorage during
           hydration, so SSR (empty) never matches a returning visitor's cart.
           Cart content is client-only by design — zero SEO value here. -->
      <ClientOnly>
      <!-- Stock warnings -->
      <div v-if="stockMessages.length > 0" class="mb-6 bg-gold/10 border border-gold/30 rounded-xl p-4">
        <p class="text-gold text-sm font-medium mb-2 flex items-center gap-2">
          <Icon name="ph:warning" class="w-5 h-5" />
          {{ $t('cart.stock_updated') || 'Your cart has been updated' }}
        </p>
        <ul class="text-text-secondary text-xs space-y-1">
          <li v-for="msg in stockMessages" :key="msg">• {{ msg }}</li>
        </ul>
      </div>

      <EmptyState
        v-if="cart.isEmpty"
        icon="ph:shopping-cart"
        :message="$t('cart.empty')"
        :cta-to="localePath('/produits')"
        :cta-label="$t('cart.empty_cta')"
        cta-icon="ph:arrow-right"
        size="lg"
      />

      <!-- Cart Content -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Items -->
        <div class="lg:col-span-2 space-y-4">
          <div
            v-for="item in cart.items"
            :key="`${item.productId}-${item.sku}`"
            class="card p-4 md:p-6 flex gap-4 md:gap-6"
          >
            <NuxtLink :to="localePath(`/produits/${item.slug}`)" class="w-20 h-20 md:w-28 md:h-28 rounded-lg bg-dark-tertiary shrink-0 overflow-hidden flex items-center justify-center">
              <img v-if="item.image" :src="item.image" :alt="l(item.name)" class="w-full h-full object-cover" />
              <span v-else class="w-10 h-10 md:w-14 md:h-14 rounded-full border-2 border-white/20" :style="{ backgroundColor: item.colorHex }" />
            </NuxtLink>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <NuxtLink :to="localePath(`/produits/${item.slug}`)" class="font-display font-semibold text-white hover:text-accent transition-colors">
                {{ l(item.name) }}
              </NuxtLink>
              <p class="text-text-secondary text-sm mt-1">{{ l(item.colorName) }}</p>
              <p class="text-accent font-bold text-lg mt-2">{{ item.price }}{{ $t('common.currency') }}</p>

              <!-- Quantity + Remove (P3-03 / P1-06: ≥44px touch targets, undo on remove) -->
              <div class="flex items-center justify-between mt-3 gap-2 flex-wrap">
                <div class="flex items-center gap-1">
                  <button
                    @click="cart.updateQuantity(item.productId, item.sku, item.quantity - 1)"
                    :aria-label="$t('cart.decrease_quantity')"
                    class="w-11 h-11 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors duration-fast"
                  >
                    <Icon name="ph:minus" class="w-3.5 h-3.5" />
                  </button>
                  <label :for="`panier-qty-${item.sku}`" class="sr-only">{{ $t('cart.quantity') }}</label>
                  <input
                    :id="`panier-qty-${item.sku}`"
                    :name="`qty-${item.sku}`"
                    type="number"
                    :value="item.quantity"
                    @change="cart.updateQuantity(item.productId, item.sku, Math.max(1, Math.min(10, Number(($event.target as HTMLInputElement).value))))"
                    min="1" max="10"
                    class="w-12 h-11 text-center font-semibold bg-transparent border-none outline-none text-white"
                  />
                  <button
                    @click="cart.updateQuantity(item.productId, item.sku, item.quantity + 1)"
                    :aria-label="$t('cart.increase_quantity')"
                    class="w-11 h-11 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors duration-fast"
                  >
                    <Icon name="ph:plus" class="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  @click="removeWithUndo(item)"
                  class="text-text-secondary hover:text-red-400 transition-colors duration-fast flex items-center gap-1.5 text-sm min-h-touch px-3 -mx-3"
                  :aria-label="$t('cart.remove')"
                >
                  <Icon name="ph:trash" class="w-4 h-4" />
                  {{ $t('cart.remove') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div>
          <div class="card p-6 sticky top-24 space-y-4">
            <h2 class="font-display text-lg font-semibold text-white">{{ $t('cart.subtotal') }}</h2>

            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-text-secondary">{{ $t('cart.subtotal') }}</span>
                <span class="text-white font-medium">{{ cart.subtotal }}{{ $t('common.currency') }}</span>
              </div>
              <div v-if="cart.discount > 0" class="flex justify-between">
                <span class="text-accent">{{ $t('cart.discount') }}</span>
                <span class="text-accent">-{{ cart.discount }}{{ $t('common.currency') }}</span>
              </div>
            </div>

            <!-- U-CX1: the shipping DECISION lives at checkout only (address
                 first, then options). The cart just says where it happens. -->
            <div class="flex justify-between text-sm border-t border-dark-tertiary pt-4">
              <span class="text-text-secondary">{{ $t('cart.shipping') }}</span>
              <span class="text-text-secondary">{{ $t('cart.shipping_calculated') }}</span>
            </div>

            <!-- Promo Code -->
            <div class="border-t border-dark-tertiary pt-4">
              <label for="promo-code" class="text-text-secondary text-sm block mb-2">{{ $t('cart.promo_code') }}</label>
              <div class="flex gap-2">
                <input
                  id="promo-code"
                  name="promo-code"
                  v-model="promoInput"
                  type="text"
                  :placeholder="$t('cart.promo_code')"
                  class="input-field flex-1 text-sm py-2"
                />
                <button @click="applyPromo" class="btn-secondary py-2 px-4 text-sm">
                  {{ $t('cart.apply') }}
                </button>
              </div>
              <p v-if="promoFeedback" class="text-xs mt-2 flex items-center gap-1" :class="promoFeedback.type === 'success' ? 'text-accent' : 'text-red-400'">
                <Icon :name="promoFeedback.type === 'success' ? 'ph:check-circle' : 'ph:x-circle'" class="w-3.5 h-3.5" />
                {{ promoFeedback.message }}
              </p>
            </div>

            <!-- Free shipping progress -->
            <div v-if="freeShippingThreshold > 0 && cart.subtotal < freeShippingThreshold" class="bg-accent/5 border border-accent/20 rounded-lg p-3">
              <p class="text-sm text-text-secondary mb-2">
                {{ $t('trust.fast_delivery') }} — {{ $t('shipping.free_above', { amount: freeShippingThreshold }) }}
              </p>
              <div class="w-full bg-dark-tertiary rounded-full h-2">
                <div class="bg-accent h-2 rounded-full transition-all" :style="{ width: Math.min(100, (cart.subtotal / freeShippingThreshold) * 100) + '%' }" />
              </div>
              <p class="text-xs text-accent mt-1.5">{{ Math.ceil(freeShippingThreshold - cart.subtotal) }}{{ $t('common.currency') }} {{ $t('shipping.remaining_free') }}</p>
            </div>
            <div v-else-if="freeShippingThreshold > 0 && cart.subtotal >= freeShippingThreshold" class="flex items-center gap-2 text-accent text-sm bg-accent/5 border border-accent/20 rounded-lg p-3">
              <Icon name="ph:check-circle" class="w-5 h-5" /> {{ $t('shipping.free_unlocked') }}
            </div>

            <!-- Total -->
            <div class="border-t border-dark-tertiary pt-4 flex justify-between">
              <span class="font-display font-semibold text-white text-lg">{{ $t('cart.total') }}</span>
              <span class="font-display font-bold text-accent text-2xl">{{ cart.total }}{{ $t('common.currency') }}</span>
            </div>

            <!-- Validation error -->
            <p v-if="cart.validationError" class="text-red-400 text-sm">{{ cart.validationError }}</p>

            <button
              @click="proceedToCheckout"
              :disabled="cart.validating"
              class="btn-primary w-full text-center py-4 text-lg disabled:opacity-50"
            >
              <span v-if="cart.validating" class="flex items-center justify-center gap-2">
                <Icon name="ph:spinner" class="w-5 h-5 animate-spin" />
                {{ $t('common.loading') }}
              </span>
              <span v-else>{{ $t('cart.checkout') }}</span>
            </button>

            <!-- Trust badges -->
            <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"><Icon name="ph:lock-simple" class="w-3.5 h-3.5 text-accent" /> {{ $t('trust.secure_payment') }}</span>
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"><Icon name="ph:shield-check" class="w-3.5 h-3.5 text-accent" /> {{ $t('trust.warranty') }}</span>
            </div>

            <NuxtLink :to="localePath('/produits')" class="block text-center text-text-secondary text-sm hover:text-accent transition-colors">
              {{ $t('cart.continue_shopping') }}
            </NuxtLink>
          </div>
        </div>
      </div>
      <template #fallback>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8" aria-hidden="true">
          <div class="lg:col-span-2 space-y-4">
            <div class="card p-6 h-36 animate-pulse" />
            <div class="card p-6 h-36 animate-pulse" />
          </div>
          <div class="card p-6 h-72 animate-pulse" />
        </div>
      </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const cart = useCartStore()
const toast = useToast()
const promoInput = ref('')
const promoFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// P3-03: remove with a real Undo action on the toast (U-P4) — an accidental
// tap costs one more tap, never the selection.
function removeWithUndo(item: any) {
  const snapshot = { ...item }
  cart.removeItem(item.productId, item.sku)
  toast.info(t('cart.removed_with_undo', { name: l(item.name) }), 6000, {
    label: t('common.undo'),
    handler: () => cart.addItem(snapshot, snapshot.quantity),
  })
}

useHead({ title: `${t('cart.title')} — Vitesse Eco`, meta: [{ name: 'robots', content: 'noindex' }] })

// Check stock when page loads
const stockMessages = ref<string[]>([])
const stockChecked = ref(false)

onMounted(async () => {
  if (cart.items.length > 0) {
    const { hasChanges, messages } = await cart.checkStock()
    stockMessages.value = messages
    stockChecked.value = true
  }
})

// Zone methods fetched ONLY to compute the free-shipping motivation bar —
// the shipping decision itself moved to checkout (address first).
const { data: shippingData } = useFetch('/api/shipping/methods', {
  query: computed(() => ({ zone: cart.shippingZone })),
})
const shippingMethods = computed(() => (shippingData.value as any)?.methods || [])

const freeShippingThreshold = computed(() => {
  const thresholds = shippingMethods.value.filter((m: any) => m.freeAbove).map((m: any) => m.freeAbove)
  return thresholds.length ? Math.min(...thresholds) : 0
})

async function applyPromo() {
  if (!promoInput.value.trim()) return
  promoFeedback.value = null
  const valid = await cart.applyPromoServer(promoInput.value.trim())
  if (valid && cart.promoDiscount > 0) {
    promoFeedback.value = { type: 'success', message: t('cart.promo_applied') }
  } else {
    promoFeedback.value = { type: 'error', message: t('cart.promo_invalid') }
  }
}

async function proceedToCheckout() {
  // Shipping is chosen AT CHECKOUT (address first) — the cart only verifies
  // that everything is still purchasable before handing over.
  const stockCheck = await cart.checkStock()
  if (!stockCheck.allValid || stockCheck.hasChanges) {
    stockMessages.value = stockCheck.messages
    cart.validationError = t('cart.stock_updated')
    return
  }

  // Legacy selection from an earlier checkout visit: revalidate it so the
  // totals shown at checkout start correct.
  if (cart.shippingCode) {
    const valid = await cart.validateCart()
    if (!valid) return
  }

  cart.validationError = ''
  navigateTo(localePath('/commande'))
}
</script>
