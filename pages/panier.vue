<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <h1 class="section-title mb-8">{{ $t('cart.title') }}</h1>

      <!-- Empty State -->
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

      <div v-if="cart.isEmpty" class="text-center py-20">
        <Icon name="ph:shopping-cart" class="w-20 h-20 text-dark-tertiary mx-auto mb-6" />
        <p class="text-text-secondary text-lg mb-6">{{ $t('cart.empty') }}</p>
        <NuxtLink :to="localePath('/produits')" class="btn-primary inline-block">
          {{ $t('cart.empty_cta') }}
        </NuxtLink>
      </div>

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

              <!-- Quantity + Remove -->
              <div class="flex items-center justify-between mt-3">
                <div class="flex items-center gap-2">
                  <button
                    @click="cart.updateQuantity(item.productId, item.sku, item.quantity - 1)"
                    :aria-label="$t('cart.quantity') + ' -'"
                    class="w-8 h-8 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors"
                  >
                    <Icon name="ph:minus" class="w-3 h-3" />
                  </button>
                  <label :for="`panier-qty-${item.sku}`" class="sr-only">{{ $t('cart.quantity') }}</label>
                  <input
                    :id="`panier-qty-${item.sku}`"
                    :name="`qty-${item.sku}`"
                    type="number"
                    :value="item.quantity"
                    @change="cart.updateQuantity(item.productId, item.sku, Math.max(1, Math.min(10, Number(($event.target as HTMLInputElement).value))))"
                    min="1" max="10"
                    class="w-10 text-center font-semibold bg-transparent border-none outline-none text-white"
                  />
                  <button
                    @click="cart.updateQuantity(item.productId, item.sku, item.quantity + 1)"
                    :aria-label="$t('cart.quantity') + ' +'"
                    class="w-8 h-8 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors"
                  >
                    <Icon name="ph:plus" class="w-3 h-3" />
                  </button>
                </div>
                <button
                  @click="cart.removeItem(item.productId, item.sku)"
                  class="text-text-secondary hover:text-red-400 transition-colors flex items-center gap-1 text-sm"
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

            <!-- Shipping Methods -->
            <div class="border-t border-dark-tertiary pt-4">
              <label class="text-text-secondary text-sm block mb-3">{{ $t('shipping.title') }}</label>
              <div v-if="shippingPending" class="text-text-secondary text-sm">{{ $t('common.loading') }}</div>
              <div v-else class="space-y-2">
                <label
                  v-for="method in shippingMethods"
                  :key="method.code"
                  :for="`ship-${method.code}`"
                  class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                  :class="cart.shippingCode === method.code ? 'border-accent bg-accent/5' : 'border-dark-tertiary hover:border-dark-tertiary/80'"
                >
                  <input
                    :id="`ship-${method.code}`"
                    :name="'shipping'"
                    type="radio"
                    :value="method.code"
                    :checked="cart.shippingCode === method.code"
                    @change="selectShipping(method.code)"
                    class="mt-1 accent-accent"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between">
                      <span class="text-white text-sm font-medium">{{ l(method.name) }}</span>
                      <span class="text-accent text-sm font-bold">
                        {{ getShippingPrice(method) === 0 ? $t('shipping.free') : getShippingPrice(method) + $t('common.currency') }}
                      </span>
                    </div>
                    <p class="text-text-secondary text-xs mt-0.5">{{ l(method.description) }}</p>
                    <p class="text-text-secondary text-xs">{{ $t('shipping.estimated', { days: method.estimatedDays }) }}</p>
                    <p v-if="method.freeAbove && cart.subtotal < method.freeAbove" class="text-gold text-xs mt-1">
                      {{ $t('shipping.free_above', { amount: method.freeAbove }) }}
                    </p>
                  </div>
                </label>
              </div>
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
            </div>

            <!-- Summary line: shipping -->
            <div v-if="cart.shippingCode" class="flex justify-between text-sm">
              <span class="text-text-secondary">{{ $t('cart.shipping') }}</span>
              <span class="text-white font-medium">{{ cart.shippingCost === 0 ? $t('shipping.free') : cart.shippingCost + $t('common.currency') }}</span>
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

            <NuxtLink :to="localePath('/produits')" class="block text-center text-text-secondary text-sm hover:text-accent transition-colors">
              {{ $t('cart.continue_shopping') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const cart = useCartStore()
const promoInput = ref('')

useHead({ title: `${t('cart.title')} — Vitesse Eco` })

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

// Fetch shipping methods for current zone
const { data: shippingData, pending: shippingPending } = useFetch('/api/shipping/methods', {
  query: { zone: cart.shippingZone },
  key: `shipping-${cart.shippingZone}`,
})
const shippingMethods = computed(() => shippingData.value?.methods || [])

function getShippingPrice(method: any) {
  if (method.freeAbove && cart.subtotal >= method.freeAbove) return 0
  return method.price || 0
}

async function selectShipping(code: string) {
  await cart.selectShipping(code, cart.shippingZone)
}

async function applyPromo() {
  if (!promoInput.value.trim()) return
  await cart.applyPromoServer(promoInput.value.trim())
}

async function proceedToCheckout() {
  if (!cart.shippingCode) {
    cart.validationError = t('shipping.select_method')
    return
  }

  // Final stock check before checkout
  const stockCheck = await cart.checkStock()
  if (!stockCheck.allValid) {
    stockMessages.value = stockCheck.messages
    cart.validationError = t('cart.stock_updated') || 'Some items are no longer available'
    return
  }
  if (stockCheck.hasChanges) {
    stockMessages.value = stockCheck.messages
    cart.validationError = t('cart.stock_updated') || 'Cart updated — please review'
    return
  }

  // Validate prices + shipping + promo
  const valid = await cart.validateCart()
  if (valid) {
    cart.validationError = ''
    navigateTo(localePath('/commande'))
  }
}
</script>
