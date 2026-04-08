<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('checkout.title') }}</h1>

      <!-- Empty cart -->
      <div v-if="cart.isEmpty" class="text-center py-20">
        <Icon name="ph:shopping-cart" class="w-16 h-16 text-dark-tertiary mx-auto mb-4" />
        <p class="text-text-secondary mb-4">{{ $t('cart.empty') }}</p>
        <NuxtLink :to="localePath('/produits')" class="btn-primary inline-block">{{ $t('cart.empty_cta') }}</NuxtLink>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: Forms -->
        <div class="lg:col-span-2 space-y-6">

          <!-- 1. Shipping Method -->
          <div class="card p-6">
            <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold">1</span>
              {{ $t('shipping.title') }}
            </h2>
            <div v-if="shippingMethods?.length" class="space-y-2">
              <label
                v-for="method in shippingMethods"
                :key="method.code"
                :for="`ship-${method.code}`"
                class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                :class="selectedShipping === method.code ? 'border-accent bg-accent/5' : 'border-dark-tertiary'"
              >
                <input :id="`ship-${method.code}`" type="radio" :value="method.code" v-model="selectedShipping" class="mt-1 accent-accent" />
                <div class="flex-1">
                  <div class="flex justify-between">
                    <span class="text-white text-sm font-medium">{{ l(method.name) }}</span>
                    <span class="text-accent text-sm font-bold">
                      {{ getShippingPrice(method) === 0 ? $t('shipping.free') : getShippingPrice(method) + $t('common.currency') }}
                    </span>
                  </div>
                  <p class="text-text-secondary text-xs mt-0.5">{{ l(method.description) }}</p>
                </div>
              </label>
            </div>
          </div>

          <!-- 2. Address (adapts to shipping type) -->
          <div class="card p-6">
            <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold">2</span>
              {{ isPickup ? $t('contact.address') : $t('checkout.shipping_address') }}
            </h2>

            <!-- PICKUP: Store info -->
            <div v-if="isPickup" class="bg-accent/5 border border-accent/20 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <Icon name="ph:storefront" class="w-6 h-6 text-accent shrink-0 mt-0.5" />
                <div>
                  <p class="text-white font-medium text-sm">Vitesse Eco — Poitiers</p>
                  <p class="text-text-secondary text-sm mt-1">32 Rue du Faubourg du Pont Neuf<br>86000 Poitiers, France</p>
                  <p class="text-text-secondary text-xs mt-2">{{ $t('contact.hours_text') }}</p>
                </div>
              </div>
            </div>

            <!-- DELIVERY -->
            <div v-else>
              <div v-if="loadingAddresses" class="flex items-center gap-2 text-text-secondary text-sm py-4">
                <Icon name="ph:spinner" class="w-4 h-4 animate-spin" /> {{ $t('common.loading') }}
              </div>

              <!-- Saved addresses -->
              <div v-else-if="savedAddresses.length && !showNewForm" class="space-y-2">
                <label
                  v-for="addr in savedAddresses" :key="addr.id" :for="`addr-${addr.id}`"
                  class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                  :class="selectedAddressId === addr.id ? 'border-accent bg-accent/5' : 'border-dark-tertiary'"
                >
                  <input :id="`addr-${addr.id}`" type="radio" :value="addr.id" v-model="selectedAddressId" class="mt-1 accent-accent" />
                  <div class="text-sm flex-1">
                    <p class="text-white font-medium">{{ addr.firstName }} {{ addr.lastName }}</p>
                    <p class="text-text-secondary">{{ addr.address }}, {{ addr.postalCode }} {{ addr.city }}</p>
                  </div>
                </label>
                <button @click="showNewForm = true" class="w-full p-3 rounded-lg border border-dashed border-dark-tertiary text-accent text-sm hover:border-accent transition-colors flex items-center justify-center gap-2">
                  <Icon name="ph:plus" class="w-4 h-4" /> {{ $t('account.add_address') }}
                </button>
              </div>

              <!-- New address form -->
              <div v-else class="space-y-3">
                <div>
                  <label for="co-country" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.country') }}</label>
                  <select id="co-country" v-model="addr.country" class="input-field">
                    <option value="FR">🇫🇷 France</option>
                    <option value="BE">🇧🇪 Belgique</option>
                    <option value="LU">🇱🇺 Luxembourg</option>
                    <option value="DE">🇩🇪 Deutschland</option>
                    <option value="NL">🇳🇱 Nederland</option>
                    <option value="ES">🇪🇸 España</option>
                  </select>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label for="co-fn" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.first_name') }}</label>
                    <input id="co-fn" v-model="addr.firstName" type="text" class="input-field" required />
                  </div>
                  <div>
                    <label for="co-ln" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.last_name') }}</label>
                    <input id="co-ln" v-model="addr.lastName" type="text" class="input-field" required />
                  </div>
                </div>
                <div>
                  <label for="co-phone" class="text-sm font-medium text-text-secondary block mb-1.5">{{ $t('checkout.phone') }}</label>
                  <input id="co-phone" v-model="addr.phone" type="tel" class="input-field" />
                </div>
                <div>
                  <label for="co-addr" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.address') }}</label>
                  <div class="relative">
                    <input id="co-addr" ref="coInput" v-model="addr.address" @input="onCoInput" type="text" class="input-field" autocomplete="off" required />
                    <div v-if="coLoading" class="absolute right-3 top-1/2 -translate-y-1/2"><Icon name="ph:spinner" class="w-4 h-4 text-accent animate-spin" /></div>
                    <div v-if="coSuggestions.length" class="absolute z-50 left-0 right-0 mt-1 bg-dark-secondary border border-dark-tertiary rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      <button v-for="s in coSuggestions" :key="s.place_id" type="button" @mousedown.prevent="pickCo(s)" class="w-full text-left px-3 py-2.5 text-sm text-text-secondary hover:bg-dark-tertiary hover:text-white flex items-start gap-2">
                        <Icon name="ph:map-pin" class="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" /><span>{{ s.description }}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="co-zip" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.postal_code') }}</label>
                    <input id="co-zip" v-model="addr.postalCode" type="text" class="input-field" required />
                  </div>
                  <div>
                    <label for="co-city" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.city') }}</label>
                    <input id="co-city" v-model="addr.city" type="text" class="input-field" required />
                  </div>
                </div>
                <label v-if="auth.isLoggedIn" class="flex items-center gap-2 text-text-secondary text-xs cursor-pointer">
                  <input type="checkbox" v-model="saveAddr" class="accent-accent" /> {{ $t('common.save') }}
                </label>
                <button v-if="savedAddresses.length" @click="showNewForm = false" class="text-text-secondary text-xs hover:text-accent">← {{ $t('common.back') }}</button>
              </div>
            </div>
          </div>

          <!-- 3. Payment -->
          <div class="card p-6">
            <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold">3</span>
              {{ $t('checkout.payment_method') }}
            </h2>
            <div v-if="paymentMethods?.length" class="space-y-2">
              <label v-for="m in paymentMethods" :key="m.code" :for="`pay-${m.code}`" class="flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors" :class="selectedPayment === m.code ? 'border-accent bg-accent/5' : 'border-dark-tertiary'">
                <input :id="`pay-${m.code}`" type="radio" :value="m.code" v-model="selectedPayment" class="mt-1 accent-accent" />
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <Icon :name="m.icon || 'ph:credit-card'" class="w-5 h-5 text-accent" />
                    <span class="text-white font-medium text-sm">{{ l(m.name) }}</span>
                  </div>
                  <p class="text-text-secondary text-xs mt-1">{{ l(m.description) }}</p>
                </div>
              </label>
            </div>
            <div v-if="selectedPaymentData?.instructions" class="mt-4 bg-accent/5 border border-accent/20 rounded-lg p-4">
              <p class="text-text-secondary text-sm whitespace-pre-line">{{ l(selectedPaymentData.instructions) }}</p>
            </div>
          </div>
        </div>

        <!-- Right: Summary -->
        <div>
          <div class="card p-6 sticky top-24 space-y-4">
            <h2 class="font-display font-semibold text-white flex items-center gap-2">
              <Icon name="ph:receipt" class="w-5 h-5 text-accent" /> {{ $t('checkout.step_review') }}
            </h2>
            <div class="space-y-2">
              <div v-for="item in cart.items" :key="`${item.productId}-${item.sku}`" class="flex justify-between text-sm">
                <span class="text-white truncate flex-1">{{ l(item.name) }} <span class="text-text-secondary">× {{ item.quantity }}</span></span>
                <span class="text-white font-medium ml-2">{{ item.price * item.quantity }}{{ $t('common.currency') }}</span>
              </div>
            </div>
            <div class="border-t border-dark-tertiary pt-3 space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-text-secondary">{{ $t('cart.subtotal') }}</span><span class="text-white">{{ cart.subtotal }}{{ $t('common.currency') }}</span></div>
              <div class="flex justify-between"><span class="text-text-secondary">{{ $t('cart.shipping') }}</span><span :class="currentShippingCost === 0 ? 'text-accent' : 'text-white'">{{ currentShippingCost === 0 ? $t('shipping.free') : currentShippingCost + $t('common.currency') }}</span></div>
              <div v-if="cart.discount > 0" class="flex justify-between"><span class="text-accent">{{ $t('cart.discount') }}</span><span class="text-accent">-{{ cart.discount }}{{ $t('common.currency') }}</span></div>
              <div class="flex justify-between text-lg font-bold border-t border-dark-tertiary pt-2"><span class="text-white">{{ $t('cart.total') }}</span><span class="text-accent">{{ orderTotal }}{{ $t('common.currency') }}</span></div>
            </div>
            <p v-if="orderError" class="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">{{ orderError }}</p>
            <ClientOnly><TurnstileWidget @verify="t => turnstileToken = t" /></ClientOnly>
            <button @click="placeOrder" :disabled="!canOrder || placing" class="btn-primary w-full py-4 text-lg disabled:opacity-50">
              <span v-if="placing" class="flex items-center justify-center gap-2"><Icon name="ph:spinner" class="w-5 h-5 animate-spin" /></span>
              <span v-else>{{ $t('checkout.place_order') }}</span>
            </button>
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
const auth = useAuthStore()

useHead({ title: `${t('checkout.title')} — Vitesse Eco` })

const selectedShipping = ref(cart.shippingCode || '')
const selectedAddressId = ref('')
const selectedPayment = ref('')
const placing = ref(false)
const orderError = ref('')
const turnstileToken = ref('')
const showNewForm = ref(false)
const saveAddr = ref(true)
const loadingAddresses = ref(true)

const addr = reactive({ firstName: auth.user?.firstName || '', lastName: auth.user?.lastName || '', phone: '', address: '', postalCode: '', city: '', country: 'FR' })

const isPickup = computed(() => selectedShipping.value === 'pickup')

// Shipping
const { data: shippingData } = useFetch('/api/shipping/methods', { query: { zone: 'FR' } })
const shippingMethods = computed(() => (shippingData.value as any)?.methods || [])
function getShippingPrice(m: any) { return m.freeAbove && cart.subtotal >= m.freeAbove ? 0 : m.price || 0 }
const currentShippingCost = computed(() => { const m = shippingMethods.value.find((m: any) => m.code === selectedShipping.value); return m ? getShippingPrice(m) : 0 })
const orderTotal = computed(() => Math.max(0, cart.subtotal - cart.discount + currentShippingCost.value))

// Payment
const { data: paymentData } = useFetch('/api/payment/methods')
const paymentMethods = computed(() => (paymentData.value as any)?.methods || [])
const selectedPaymentData = computed(() => paymentMethods.value.find((m: any) => m.code === selectedPayment.value))

// Addresses
const savedAddresses = ref<any[]>([])
onMounted(async () => {
  if (auth.isLoggedIn) {
    try {
      const { addresses } = await $fetch<any>('/api/addresses')
      savedAddresses.value = addresses
      if (addresses.length) { selectedAddressId.value = (addresses.find((a: any) => a.isDefault) || addresses[0]).id }
      else { showNewForm.value = true }
    } catch {}
  } else { showNewForm.value = true }
  loadingAddresses.value = false
})

// Autocomplete
const coInput = ref<HTMLInputElement>()
const coSuggestions = ref<any[]>([])
const coLoading = ref(false)
let coTimer: ReturnType<typeof setTimeout>
watch(() => addr.country, () => { addr.address = ''; addr.city = ''; addr.postalCode = ''; coSuggestions.value = [] })
function onCoInput() {
  clearTimeout(coTimer)
  if (addr.address.length < 3) { coSuggestions.value = []; coLoading.value = false; return }
  coLoading.value = true
  coTimer = setTimeout(async () => {
    try { const d = await $fetch<any>('/api/places/autocomplete', { query: { input: addr.address, country: addr.country.toLowerCase() } }); coSuggestions.value = d.predictions || [] }
    catch { coSuggestions.value = [] } finally { coLoading.value = false }
  }, 400)
}
async function pickCo(s: any) {
  coSuggestions.value = []; addr.address = s.structured_formatting?.main_text || s.description
  try { const d = await $fetch<any>('/api/places/details', { query: { place_id: s.place_id } }); if (d.address) { addr.address = d.address; addr.city = d.city || ''; addr.postalCode = d.postalCode || '' } } catch {}
}

// Can order?
const canOrder = computed(() => {
  if (!selectedShipping.value || !selectedPayment.value || !turnstileToken.value) return false
  if (isPickup.value) return true
  if (selectedAddressId.value && !showNewForm.value) return true
  return !!(showNewForm.value && addr.address && addr.city && addr.postalCode && addr.firstName && addr.lastName)
})

// Place order
async function placeOrder() {
  if (!canOrder.value) return
  placing.value = true; orderError.value = ''

  let shippingAddress: any
  if (isPickup.value) {
    shippingAddress = { firstName: auth.user?.firstName || 'Client', lastName: auth.user?.lastName || '', address: '32 Rue du Faubourg du Pont Neuf', city: 'Poitiers', postalCode: '86000', country: 'FR' }
  } else if (selectedAddressId.value && !showNewForm.value) {
    const a = savedAddresses.value.find(a => a.id === selectedAddressId.value)
    if (!a) { orderError.value = 'Select address'; placing.value = false; return }
    shippingAddress = { firstName: a.firstName, lastName: a.lastName, phone: a.phone, address: a.address, city: a.city, postalCode: a.postalCode, country: a.country }
  } else {
    shippingAddress = { ...addr }
    if (auth.isLoggedIn && saveAddr.value) {
      try { await $fetch('/api/addresses', { method: 'POST', body: { ...addr, isDefault: !savedAddresses.value.length } }) } catch {}
    }
  }

  try {
    const stockCheck = await cart.checkStock()
    if (!stockCheck.allValid) { orderError.value = stockCheck.messages.join(', '); placing.value = false; return }
    const result = await $fetch<any>('/api/orders/create', {
      method: 'POST',
      body: { items: cart.items.map(i => ({ productId: i.productId, sku: i.sku, quantity: i.quantity })), shippingCode: selectedShipping.value, paymentCode: selectedPayment.value, shippingAddress, promoCode: cart.promoCode || undefined, turnstileToken: turnstileToken.value },
    })
    cart.clearCart()
    navigateTo(localePath(`/commande/confirmation?order=${result.orderNumber}`))
  } catch (e: any) { orderError.value = e.data?.message || 'Order failed' }
  finally { placing.value = false }
}
</script>
