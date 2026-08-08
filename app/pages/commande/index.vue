<script setup lang="ts">
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js'

/**
 * Checkout.
 *
 * One straight line: where it goes, how it arrives, how it is paid. The
 * delivery options are asked of the server for the address entered, so the
 * customer is only ever offered something the shop can actually do — the
 * previous build quoted French rates to German addresses and failed at the
 * payment step.
 *
 * Stripe's form is embedded here rather than on a redirect page: the customer
 * stays on our URL and our design, and only the embedded mode can update
 * shipping options while an address is being typed.
 */
const cart = useCart()
const localePath = useLocalePath()
const { locale, t } = useI18n()
const { formatDecimal } = useFormatPrice()
const config = useRuntimeConfig()

const { data: me } = await useFetch<{
  id: string
  email: string
  firstName: string
  lastName: string
} | null>('/api/auth/me')

interface ShippingOption {
  code: string
  name: string
  description: string | null
  price: string
  freeAbove: string | null
  estimatedDays: string | null
}

const destination = reactive({ country: 'FR', postalCode: '' })
const email = ref(me.value?.email ?? '')
// Prefilled for a signed-in customer but still editable: someone buying for a
// partner or a company must be able to put that name on the invoice.
const firstName = ref(me.value?.firstName ?? '')
const lastName = ref(me.value?.lastName ?? '')
// Required for every order. /api/auth/me does not carry one, so even a signed-in
// customer states it here — the number frozen onto the order is the number given
// that day, not whatever the account holds later.
const phone = ref('')
const selectedShipping = ref<string | null>(null)
const selectedPayment = ref<'stripe' | 'cod' | 'in_store'>('stripe')

interface Totals {
  subtotal: string
  discount: string
  shipping: string
  total: string
}

const shippingOptions = ref<ShippingOption[]>([])
const pricing = ref<Totals | null>(null)
const stripeContainer = ref<HTMLElement | null>(null)
const embedded = shallowRef<StripeEmbeddedCheckout | null>(null)
const submitting = ref(false)
const error = ref<string | null>(null)

onMounted(cart.restore)

/** Enough of an address to know what we can deliver and what it costs. */
const destinationReady = computed(
  () => destination.country.length === 2 && destination.postalCode.trim().length >= 3
)

// Delivery options follow the address, and are re-asked whenever it changes —
// a method that served the old postcode may not serve the new one.
watch(
  () => [destination.country, destination.postalCode] as const,
  async () => {
    selectedShipping.value = null
    shippingOptions.value = []
    if (!destinationReady.value) return
    const result = await $fetch<{ methods: ShippingOption[] }>('/api/catalog/shipping', {
      query: { country: destination.country, postalCode: destination.postalCode, locale: locale.value },
    })
    shippingOptions.value = result.methods
    if (pendingRestore.shipping && result.methods.some((option) => option.code === pendingRestore.shipping)) {
      // The choice the customer had already made, back without a click.
      selectedShipping.value = pendingRestore.shipping
      pendingRestore.shipping = null
      if (pendingRestore.payment) {
        selectedPayment.value = pendingRestore.payment
        pendingRestore.payment = null
      }
    } else if (result.methods.length === 1) {
      // Exactly one option is not a choice; selecting it saves a pointless click.
      selectedShipping.value = result.methods[0]!.code
    }
  }
)

// Cash on delivery only where our own van goes; paying at the counter only when
// the customer is collecting. The server checks this again — the list a browser
// was shown is not an authority.
const paymentOptions = computed(() => {
  // A bare label makes the customer open the payment form just to learn what
  // is behind it; one honest line under each option decides for them here.
  const options: Array<{ code: 'stripe' | 'cod' | 'in_store'; label: string; desc: string }> = [
    { code: 'stripe', label: t('checkout.pay_online'), desc: t('checkout.pay_online_desc') },
  ]
  if (['BE', 'NL'].includes(destination.country) && selectedShipping.value !== 'pickup') {
    options.push({ code: 'cod', label: t('checkout.pay_cash'), desc: t('checkout.pay_cash_desc') })
  }
  if (selectedShipping.value === 'pickup') {
    options.push({ code: 'in_store', label: t('checkout.pay_in_store'), desc: t('checkout.pay_in_store_desc') })
  }
  return options
})

watch(paymentOptions, (options) => {
  if (!options.some((option) => option.code === selectedPayment.value)) {
    selectedPayment.value = 'stripe'
  }
})

watch([selectedShipping, () => cart.lines.value], refreshTotals, { deep: true })

async function refreshTotals(): Promise<void> {
  if (cart.isEmpty.value || !selectedShipping.value) {
    pricing.value = null
    return
  }
  // Typed explicitly: leaving Nuxt to infer the response from its route table
  // sends the checker into a recursion it cannot finish.
  pricing.value = await $fetch<Totals>('/api/cart/price', {
    method: 'POST',
    body: {
      cart: { lines: cart.lines.value, ...(cart.promoCode.value ? { promoCode: cart.promoCode.value } : {}) },
      locale: locale.value,
      shipping: {
        methodCode: selectedShipping.value,
        country: destination.country,
        postalCode: destination.postalCode,
      },
    },
  })
}

/**
 * The token is single-use at Cloudflare, so a rejected attempt needs a fresh
 * one. Cleared and the widget reset on every failure — otherwise the customer's
 * second attempt fails on a stale token and they conclude the shop is broken.
 */
/**
 * The delivery address.
 *
 * The country and postcode alone decide which shipping methods are OFFERED, but
 * they are not an address — and the server rejects any order that is not a
 * store collection without one. Collecting only those two made every delivery
 * order fail validation with a generic error, which is to say the shop could
 * not sell anything to Belgium, the Netherlands or Poitiers.
 *
 * `country` and `postalCode` are the same fields the shipping quote uses, not a
 * second copy: a customer must not be able to claim a Belgian destination — free
 * delivery, cash on collection — for a Spanish address.
 */
const address = reactive({
  line1: '',
  line2: '',
})

const city = ref('')

/**
 * A failed payment must not cost the customer their typing. Everything entered
 * is mirrored to sessionStorage as it changes and restored on return, so a
 * retry is one click, not a second data entry. The confirmation page clears
 * this once an order is truly on its way; a failed one keeps it.
 */
const CHECKOUT_STORE = 'vitesse.checkout.v1'
const pendingRestore: { shipping: string | null; payment: 'stripe' | 'cod' | 'in_store' | null } = {
  shipping: null,
  payment: null,
}

onMounted(() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CHECKOUT_STORE) ?? 'null')
    if (!saved) return
    destination.country = saved.country ?? destination.country
    destination.postalCode = saved.postalCode ?? ''
    city.value = saved.city ?? ''
    if (saved.email) email.value = saved.email
    if (saved.phone) phone.value = saved.phone
    if (saved.firstName) firstName.value = saved.firstName
    if (saved.lastName) lastName.value = saved.lastName
    // Restored so a customer returning from a failed payment retries INTO the
    // order they already have, instead of creating a second one.
    if (typeof saved.purchaseKey === 'string') purchaseKey.value = saved.purchaseKey
    if (typeof saved.keyBelongsTo === 'string') keyBelongsTo = saved.keyBelongsTo
    Object.assign(address, saved.address ?? {})
    // Shipping and payment can only be re-applied once the options for the
    // restored address have been fetched — the destination watcher does it.
    pendingRestore.shipping = saved.shipping ?? null
    pendingRestore.payment = saved.payment ?? null
  } catch {
    // A torn value must not break checkout.
  }
})

watch(
  () => [
    destination.country,
    destination.postalCode,
    city.value,
    email.value,
    phone.value,
    firstName.value,
    lastName.value,
    { ...address },
    selectedShipping.value,
    selectedPayment.value,
  ],
  () => {
    try {
      sessionStorage.setItem(
        CHECKOUT_STORE,
        JSON.stringify({
          country: destination.country,
          postalCode: destination.postalCode,
          city: city.value,
          email: email.value,
          phone: phone.value,
          firstName: firstName.value,
          lastName: lastName.value,
          purchaseKey: purchaseKey.value,
          keyBelongsTo,
          address: { ...address },
          shipping: selectedShipping.value,
          payment: selectedPayment.value,
        })
      )
    } catch {
      // A full storage is the browser's business, not the checkout's.
    }
  }
)

/** The street part only — the name is asked of every order, above. */
const addressComplete = computed(
  () => address.line1.trim().length > 0 && city.value.trim().length > 0
)

/** Collection needs no address; anything we drive to does. */
const needsAddress = computed(
  () => selectedPayment.value !== 'in_store' && selectedShipping.value !== 'pickup'
)

/**
 * One key per purchase attempt, not one per click.
 *
 * A new UUID was minted inline on every submit, so a lost response, a retry, or
 * a Stripe failure in the browser wrote a SECOND order and a second stock hold
 * for the same basket — the shelf lost units to a customer who bought nothing.
 * The key now survives a failed attempt and a return to this page.
 *
 * It must still change when the purchase itself changes: reusing it after the
 * basket is edited would resolve to the earlier order and charge for contents
 * the customer no longer wants. So it is tied to a fingerprint of everything
 * that decides what is being bought and what it costs, and checked at the only
 * moment it matters — just before sending.
 */
const purchaseKey = ref('')
let keyBelongsTo = ''

const purchaseFingerprint = computed(() =>
  JSON.stringify({
    lines: cart.lines.value,
    promo: cart.promoCode.value,
    shipping: selectedShipping.value,
    payment: selectedPayment.value,
    country: destination.country,
    postalCode: destination.postalCode,
  })
)

function refreshPurchaseKey(): void {
  if (purchaseKey.value && purchaseFingerprint.value === keyBelongsTo) return
  purchaseKey.value = crypto.randomUUID()
  keyBelongsTo = purchaseFingerprint.value
}

const captchaToken = ref('')
const captcha = ref<{ reset: () => void } | null>(null)

const canSubmit = computed(
  () =>
    !cart.isEmpty.value &&
    !!selectedShipping.value &&
    !!email.value &&
    phone.value.trim().length > 0 &&
    firstName.value.trim().length > 0 &&
    lastName.value.trim().length > 0 &&
    !!captchaToken.value &&
    (!needsAddress.value || addressComplete.value) &&
    !submitting.value
)

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  // Mints a key on the first attempt and keeps it across retries, unless what
  // is being bought has changed since — checked here, the last moment before
  // the basket leaves the browser.
  refreshPurchaseKey()
  submitting.value = true
  error.value = null

  try {
    const result = await $fetch<{
      orderNumber: string
      mode: 'stripe' | 'cash'
      clientSecret?: string
    }>('/api/checkout/start', {
      method: 'POST',
      body: {
        cart: { lines: cart.lines.value, ...(cart.promoCode.value ? { promoCode: cart.promoCode.value } : {}) },
        shipping: {
          methodCode: selectedShipping.value,
          destination: { country: destination.country, postalCode: destination.postalCode },
        },
        paymentMethod: selectedPayment.value,
        locale: locale.value,
        email: email.value,
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        phone: phone.value.trim(),
        // Sent only when it is required and complete. The country and postcode
        // come from the same fields that produced the shipping quote, so the
        // address delivered to and the address priced for are one address.
        ...(needsAddress.value
          ? {
              shippingAddress: {
                // The same three the order carries, so the label and the
                // invoice cannot disagree about who this is.
                firstName: firstName.value.trim(),
                lastName: lastName.value.trim(),
                phone: phone.value.trim(),
                line1: address.line1.trim(),
                ...(address.line2.trim() ? { line2: address.line2.trim() } : {}),
                postalCode: destination.postalCode.trim(),
                city: city.value.trim(),
                country: destination.country,
              },
            }
          : {}),
        idempotencyKey: purchaseKey.value,
        captchaToken: captchaToken.value,
      },
    })

    if (result.mode === 'cash') {
      cart.clear()
      await navigateTo(localePath(`/commande/confirmation?order=${result.orderNumber}`))
      return
    }

    const stripe = await loadStripe(config.public.stripePublishableKey as string)
    if (!stripe || !result.clientSecret) throw new Error('Stripe failed to initialise')

    const instance = await stripe.createEmbeddedCheckoutPage({ clientSecret: result.clientSecret })
    embedded.value = instance
    // Mounted after the branch renders its container, not before it exists.
    await nextTick()
    if (stripeContainer.value) instance.mount(stripeContainer.value)
  } catch (err: unknown) {
    const data = (err as { data?: { messageKey?: string } })?.data
    error.value = data?.messageKey ? t(data.messageKey) : t('errors.internal')
    // Spent, whether or not it was the reason. Asking Cloudflare to accept it
    // twice fails, and the customer would never learn why.
    captchaToken.value = ''
    captcha.value?.reset()
  } finally {
    submitting.value = false
  }
}

// The embedded form holds an iframe; leaving the page without destroying it
// leaks a live payment session into the next route.
onBeforeUnmount(() => embedded.value?.destroy())

useSeoMeta({ title: () => t('checkout.title'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-10">
    <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('checkout.title') }}</h1>

    <ClientOnly>
      <div v-if="cart.isEmpty.value" class="mt-8">
        <p class="text-content-muted">{{ $t('cart.empty') }}</p>
        <NuxtLink :to="localePath('/produits')" class="btn-primary mt-6">{{ $t('cart.browse') }}</NuxtLink>
      </div>

      <!-- Once Stripe is mounted the form owns the page: showing our own inputs
           beside it invites the customer to edit an order already priced. -->
      <div v-else-if="embedded" class="mt-8">
        <div ref="stripeContainer" />
      </div>

      <div v-else class="mt-8 grid gap-8 lg:grid-cols-3">
        <div class="space-y-8 lg:col-span-2">
          <section>
            <h2 class="font-display text-lg font-bold text-content-strong">1. {{ $t('checkout.where') }}</h2>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span class="text-sm text-content-muted">{{ $t('checkout.country') }}</span>
                <select v-model="destination.country" class="field mt-1">
                  <option value="FR">France</option>
                  <option value="BE">Belgique</option>
                  <option value="NL">Nederland</option>
                  <option value="DE">Deutschland</option>
                  <option value="ES">España</option>
                  <option value="LU">Luxembourg</option>
                </select>
              </label>
              <label>
                <span class="text-sm text-content-muted">{{ $t('checkout.postal_code') }}</span>
                <!-- Dutch postcodes contain letters, so a numeric keypad would
                     make them impossible to type on a phone. -->
                <input
                  v-model="destination.postalCode"
                  type="text"
                  :inputmode="destination.country === 'NL' ? 'text' : 'numeric'"
                  autocomplete="postal-code"
                  class="field mt-1"
                />
              </label>
              <label>
                <span class="text-sm text-content-muted">{{ $t('checkout.city') }}</span>
                <input v-model="city" type="text" autocomplete="address-level2" class="field mt-1" />
              </label>
              <!--
                Name, email and telephone all sit here rather than in the
                address block below, because a collection order never renders
                that block — so anything asked only there is never asked at all
                for exactly the orders someone walks in to claim. The name is
                what goes on the invoice; without it a paid order cannot be
                invoiced without ringing to ask who bought.
              -->
              <label>
                <span class="text-sm text-content-muted">{{ $t('checkout.first_name') }}</span>
                <input
                  v-model="firstName"
                  type="text"
                  autocomplete="given-name"
                  maxlength="100"
                  class="field mt-1"
                  required
                />
              </label>
              <label>
                <span class="text-sm text-content-muted">{{ $t('checkout.last_name') }}</span>
                <input
                  v-model="lastName"
                  type="text"
                  autocomplete="family-name"
                  maxlength="100"
                  class="field mt-1"
                  required
                />
              </label>
              <label>
                <span class="text-sm text-content-muted">{{ $t('checkout.email') }}</span>
                <input v-model="email" type="email" autocomplete="email" class="field mt-1" required />
              </label>
              <label>
                <span class="text-sm text-content-muted">{{ $t('checkout.phone') }}</span>
                <input
                  v-model="phone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  maxlength="24"
                  class="field mt-1"
                  required
                />
              </label>
              <p class="text-xs text-content-muted sm:col-span-2">{{ $t('checkout.phone_why') }}</p>
            </div>

            <!-- Shown only when we are driving to it. Collection in store needs
                 a name at the counter, not a street — and that name is asked
                 above, for every order. -->
            <div v-if="needsAddress" class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="sm:col-span-2">
                <span class="text-sm text-content-muted">{{ $t('checkout.address') }}</span>
                <input
                  v-model="address.line1"
                  type="text"
                  autocomplete="address-line1"
                  maxlength="200"
                  class="field mt-1"
                  required
                />
              </label>
              <label class="sm:col-span-2">
                <span class="text-sm text-content-muted">{{ $t('checkout.address_line2') }}</span>
                <input
                  v-model="address.line2"
                  type="text"
                  autocomplete="address-line2"
                  maxlength="200"
                  class="field mt-1"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 class="font-display text-lg font-bold text-content-strong">2. {{ $t('checkout.how') }}</h2>
            <p v-if="!destinationReady" class="mt-3 text-sm text-content-muted">
              {{ $t('checkout.enter_address_first') }}
            </p>
            <p v-else-if="shippingOptions.length === 0" class="mt-3 text-sm text-warning">
              {{ $t('checkout.no_delivery_here') }}
            </p>
            <ul v-else class="mt-4 space-y-2">
              <li v-for="option in shippingOptions" :key="option.code">
                <label
                  class="flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                  :class="selectedShipping === option.code ? 'border-accent bg-accent-subtle' : 'border-surface-border'"
                >
                  <input v-model="selectedShipping" type="radio" :value="option.code" class="mt-1 accent-accent" />
                  <span class="flex-1">
                    <span class="flex justify-between gap-2">
                      <span class="font-medium text-content-strong">{{ option.name }}</span>
                      <span class="font-semibold text-accent">
                        {{ option.price === '0.00' ? $t('checkout.free') : formatDecimal(option.price) }}
                      </span>
                    </span>
                    <span v-if="option.description" class="mt-0.5 block text-sm text-content-muted">
                      {{ option.description }}
                    </span>
                  </span>
                </label>
              </li>
            </ul>
          </section>

          <section v-if="selectedShipping">
            <h2 class="font-display text-lg font-bold text-content-strong">3. {{ $t('checkout.payment') }}</h2>
            <ul class="mt-4 space-y-2">
              <li v-for="option in paymentOptions" :key="option.code">
                <label
                  class="flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                  :class="selectedPayment === option.code ? 'border-accent bg-accent-subtle' : 'border-surface-border'"
                >
                  <input v-model="selectedPayment" type="radio" :value="option.code" class="mt-1 accent-accent" />
                  <span class="flex-1">
                    <span class="block font-medium text-content-strong">{{ option.label }}</span>
                    <span class="mt-0.5 block text-sm text-content-muted">{{ option.desc }}</span>
                  </span>
                </label>
              </li>
            </ul>
          </section>
        </div>

        <aside class="card h-fit p-5">
          <h2 class="font-display font-bold text-content-strong">{{ $t('cart.summary') }}</h2>

          <dl v-if="pricing" class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-content-muted">{{ $t('cart.subtotal') }}</dt>
              <dd class="text-content-strong">{{ formatDecimal(pricing.subtotal) }}</dd>
            </div>
            <div v-if="pricing.discount !== '0.00'" class="flex justify-between">
              <dt class="text-content-muted">{{ $t('cart.discount') }}</dt>
              <dd class="text-success">−{{ formatDecimal(pricing.discount) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-content-muted">{{ $t('checkout.shipping') }}</dt>
              <dd class="text-content-strong">
                {{ pricing.shipping === '0.00' ? $t('checkout.free') : formatDecimal(pricing.shipping) }}
              </dd>
            </div>
            <div class="flex justify-between border-t border-surface-border pt-2 text-base font-bold">
              <dt class="text-content-strong">{{ $t('cart.total') }}</dt>
              <dd class="text-content-strong">{{ formatDecimal(pricing.total) }}</dd>
            </div>
          </dl>
          <p v-else class="mt-4 text-sm text-content-muted">{{ $t('checkout.totals_pending') }}</p>

          <p v-if="error" role="alert" class="mt-4 text-sm text-danger">{{ error }}</p>

          <!-- Placing an order reserves stock before any money moves, so this
               path is gated like login is. -->
          <div class="mt-6">
            <CaptchaWidget ref="captcha" v-model="captchaToken" />
          </div>

          <button type="button" class="btn-primary mt-4 w-full" :disabled="!canSubmit" @click="submit">
            {{ submitting ? $t('common.loading') : $t('checkout.confirm') }}
          </button>
        </aside>
      </div>
    </ClientOnly>
  </div>
</template>
