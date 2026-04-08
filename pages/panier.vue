<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <h1 class="section-title mb-8">{{ $t('cart.title') }}</h1>

      <!-- Empty State -->
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
            <!-- Image placeholder -->
            <NuxtLink :to="localePath(`/produits/${item.slug}`)" class="w-20 h-20 md:w-28 md:h-28 rounded-lg bg-dark-tertiary flex items-center justify-center shrink-0">
              <span
                class="w-10 h-10 md:w-14 md:h-14 rounded-full border-2 border-white/20"
                :style="{ backgroundColor: item.colorHex }"
              />
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
                    aria-label="Decrease"
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
                    aria-label="Increase"
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
              <div class="flex justify-between">
                <span class="text-text-secondary">{{ $t('cart.shipping') }}</span>
                <span class="text-text-secondary">{{ $t('cart.shipping_calculated') }}</span>
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

async function applyPromo() {
  if (!promoInput.value.trim()) return
  await cart.applyPromoServer(promoInput.value.trim())
}

async function proceedToCheckout() {
  // Server validates ALL prices, stock, and promo before allowing checkout
  const valid = await cart.validateCart()
  if (valid) {
    // Will navigate to checkout page in Phase 3
    alert('Cart validated — checkout coming soon!')
  }
}
</script>
