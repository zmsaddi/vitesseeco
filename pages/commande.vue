<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-3xl">
      <h1 class="section-title mb-8">{{ $t('checkout.title') }}</h1>

      <!-- Empty cart redirect -->
      <div v-if="cart.isEmpty" class="text-center py-20">
        <Icon name="ph:shopping-cart" class="w-16 h-16 text-dark-tertiary mx-auto mb-4" />
        <p class="text-text-secondary mb-4">{{ $t('cart.empty') }}</p>
        <NuxtLink :to="localePath('/produits')" class="btn-primary inline-block">{{ $t('cart.empty_cta') }}</NuxtLink>
      </div>

      <div v-else class="space-y-6">
        <!-- Order Summary -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="ph:receipt" class="w-5 h-5 text-accent" />
            {{ $t('checkout.step_review') }}
          </h2>
          <div class="space-y-3">
            <div v-for="item in cart.items" :key="`${item.productId}-${item.sku}`" class="flex justify-between text-sm">
              <div>
                <span class="text-white">{{ l(item.name) }}</span>
                <span class="text-text-secondary ml-2">× {{ item.quantity }}</span>
              </div>
              <span class="text-white font-medium">{{ item.price * item.quantity }}{{ $t('common.currency') }}</span>
            </div>
            <div class="border-t border-dark-tertiary pt-3 space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">{{ $t('cart.subtotal') }}</span>
                <span class="text-white">{{ cart.subtotal }}{{ $t('common.currency') }}</span>
              </div>
              <div v-if="cart.shippingCost > 0" class="flex justify-between text-sm">
                <span class="text-text-secondary">{{ $t('cart.shipping') }}</span>
                <span class="text-white">{{ cart.shippingCost }}{{ $t('common.currency') }}</span>
              </div>
              <div v-else class="flex justify-between text-sm">
                <span class="text-text-secondary">{{ $t('cart.shipping') }}</span>
                <span class="text-accent">{{ $t('shipping.free') }}</span>
              </div>
              <div v-if="cart.discount > 0" class="flex justify-between text-sm">
                <span class="text-accent">{{ $t('cart.discount') }}</span>
                <span class="text-accent">-{{ cart.discount }}{{ $t('common.currency') }}</span>
              </div>
              <div class="flex justify-between text-lg font-bold border-t border-dark-tertiary pt-2">
                <span class="text-white">{{ $t('cart.total') }}</span>
                <span class="text-accent">{{ cart.total }}{{ $t('common.currency') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Shipping Address -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="ph:map-pin" class="w-5 h-5 text-accent" />
            {{ $t('checkout.shipping_address') }}
          </h2>

          <!-- Saved addresses -->
          <div v-if="savedAddresses.length" class="space-y-2 mb-4">
            <label
              v-for="addr in savedAddresses"
              :key="addr.id"
              :for="`addr-${addr.id}`"
              class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="selectedAddressId === addr.id ? 'border-accent bg-accent/5' : 'border-dark-tertiary'"
            >
              <input :id="`addr-${addr.id}`" type="radio" :value="addr.id" v-model="selectedAddressId" class="mt-1 accent-accent" />
              <div class="text-sm">
                <p class="text-white font-medium">{{ addr.firstName }} {{ addr.lastName }}</p>
                <p class="text-text-secondary">{{ addr.address }}, {{ addr.postalCode }} {{ addr.city }}, {{ addr.country }}</p>
              </div>
            </label>
          </div>
          <p v-else class="text-text-secondary text-sm">{{ $t('account.no_addresses') }}</p>
        </div>

        <!-- Payment Method -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="ph:credit-card" class="w-5 h-5 text-accent" />
            {{ $t('checkout.payment_method') }}
          </h2>
          <div v-if="paymentMethods?.length" class="space-y-2">
            <label
              v-for="method in paymentMethods"
              :key="method.code"
              :for="`pay-${method.code}`"
              class="flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors"
              :class="selectedPayment === method.code ? 'border-accent bg-accent/5' : 'border-dark-tertiary'"
            >
              <input :id="`pay-${method.code}`" type="radio" :value="method.code" v-model="selectedPayment" class="mt-1 accent-accent" />
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <Icon :name="method.icon || 'ph:credit-card'" class="w-5 h-5 text-accent" />
                  <span class="text-white font-medium text-sm">{{ l(method.name) }}</span>
                </div>
                <p class="text-text-secondary text-xs mt-1">{{ l(method.description) }}</p>
              </div>
            </label>
          </div>

          <!-- Payment instructions -->
          <div v-if="selectedPaymentData?.instructions" class="mt-4 bg-accent/5 border border-accent/20 rounded-lg p-4">
            <p class="text-text-secondary text-sm">{{ l(selectedPaymentData.instructions) }}</p>
          </div>
        </div>

        <!-- Place Order -->
        <div class="space-y-3">
          <p v-if="orderError" class="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">{{ orderError }}</p>

          <button
            @click="placeOrder"
            :disabled="!canOrder || placing"
            class="btn-primary w-full py-4 text-lg disabled:opacity-50"
          >
            <span v-if="placing" class="flex items-center justify-center gap-2">
              <Icon name="ph:spinner" class="w-5 h-5 animate-spin" />
              {{ $t('common.loading') }}
            </span>
            <span v-else>{{ $t('checkout.place_order') }}</span>
          </button>

          <NuxtLink :to="localePath('/panier')" class="block text-center text-text-secondary text-sm hover:text-accent">
            ← {{ $t('common.back') }}
          </NuxtLink>
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
const auth = useAuthStore()

useHead({ title: `${t('checkout.title')} — Vitesse Eco` })

const selectedAddressId = ref('')
const selectedPayment = ref('')
const placing = ref(false)
const orderError = ref('')

// Fetch saved addresses
const savedAddresses = ref<any[]>([])
onMounted(async () => {
  if (auth.user) {
    try {
      const { addresses } = await $fetch<any>('/api/addresses')
      savedAddresses.value = addresses
      if (addresses.length) {
        const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0]
        selectedAddressId.value = defaultAddr.id
      }
    } catch {}
  }
})

// Fetch active payment methods
const { data: paymentData } = useFetch('/api/payment/methods')
const paymentMethods = computed(() => (paymentData.value as any)?.methods || [])

const selectedPaymentData = computed(() =>
  paymentMethods.value.find((m: any) => m.code === selectedPayment.value)
)

const canOrder = computed(() => selectedAddressId.value && selectedPayment.value && !cart.isEmpty)

async function placeOrder() {
  if (!canOrder.value) return

  placing.value = true
  orderError.value = ''

  const address = savedAddresses.value.find(a => a.id === selectedAddressId.value)
  if (!address) {
    orderError.value = 'Please select an address'
    placing.value = false
    return
  }

  try {
    // Final stock check
    const stockCheck = await cart.checkStock()
    if (!stockCheck.allValid) {
      orderError.value = stockCheck.messages.join(', ')
      placing.value = false
      return
    }

    const result = await $fetch<any>('/api/orders/create', {
      method: 'POST',
      body: {
        items: cart.items.map(i => ({ productId: i.productId, sku: i.sku, quantity: i.quantity })),
        shippingCode: cart.shippingCode,
        paymentCode: selectedPayment.value,
        shippingAddress: {
          firstName: address.firstName,
          lastName: address.lastName,
          phone: address.phone,
          address: address.address,
          city: address.city,
          postalCode: address.postalCode,
          country: address.country,
        },
        promoCode: cart.promoCode || undefined,
      },
    })

    // Success — clear cart and redirect
    cart.clearCart()
    navigateTo(localePath(`/commande/confirmation?order=${result.orderNumber}`))
  } catch (e: any) {
    orderError.value = e.data?.message || 'Order failed'
  } finally {
    placing.value = false
  }
}
</script>
