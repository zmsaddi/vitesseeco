<script setup lang="ts">
/**
 * Order confirmation — and the truth about the payment.
 *
 * The order number is read from the URL and shown, but nothing about the
 * order's state is taken from there — a customer arriving with a made-up
 * number is told nothing about anyone's order.
 *
 * When Stripe redirected us here, the URL also carries the session id, and
 * THAT is asked of the server: paid, still settling, or failed. Delayed
 * methods (iDEAL, Bancontact, SEPA) legitimately confirm before the money
 * moves, so "received" and "paid" are different words on this page by design.
 * A failed payment keeps the basket — the retry costs one click, not a
 * rebuild of the cart.
 */
const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()

const orderNumber = computed(() => {
  const value = Array.isArray(route.query.order) ? route.query.order[0] : route.query.order
  return typeof value === 'string' && /^ORD-[A-Z0-9]{6,20}$/.test(value) ? value : null
})

const sessionId = computed(() => {
  const value = Array.isArray(route.query.session) ? route.query.session[0] : route.query.session
  return typeof value === 'string' && /^cs_(test|live)_[A-Za-z0-9]+$/.test(value) ? value : null
})

/** none = cash/pickup (no online payment to report on). */
type PayState = 'none' | 'checking' | 'paid' | 'processing' | 'failed'
const payState = ref<PayState>(sessionId.value ? 'checking' : 'none')

// The checkout form's saved typing has served its purpose once an order is on
// its way; after a failure it stays, so the retry costs one click.
function clearCheckoutStore(): void {
  try {
    sessionStorage.removeItem('vitesse.checkout.v1')
  } catch {
    // Storage unavailable never breaks a confirmation.
  }
}

onMounted(async () => {
  if (!sessionId.value) {
    // Cash or collection: the order is agreed, the basket has done its job.
    useCart().clear()
    clearCheckoutStore()
    return
  }
  try {
    const result = await $fetch<{ state: 'paid' | 'processing' | 'failed' }>(
      '/api/checkout/session-status',
      { query: { session: sessionId.value } }
    )
    payState.value = result.state
  } catch {
    // The page must not claim failure it cannot prove; the webhook and the
    // account page carry the authoritative story.
    payState.value = 'processing'
  }
  // A failed payment keeps the basket and the typed form, so the customer can
  // simply try again.
  if (payState.value !== 'failed') {
    useCart().clear()
    clearCheckoutStore()
  }
})

const heading = computed(() => {
  switch (payState.value) {
    case 'paid': return t('confirmation.paid_title')
    case 'processing': return t('confirmation.processing_title')
    case 'failed': return t('confirmation.failed_title')
    case 'checking': return t('confirmation.checking')
    default: return t('confirmation.title')
  }
})

useSeoMeta({ title: () => t('confirmation.title'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-16">
    <div class="mx-auto max-w-lg text-center">
      <div
        class="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        :class="{
          'bg-success-subtle': payState === 'none' || payState === 'paid',
          'bg-warning-subtle': payState === 'processing' || payState === 'checking',
          'bg-danger-subtle': payState === 'failed',
        }"
      >
        <Icon v-if="payState === 'none' || payState === 'paid'" name="ph:check-bold" class="h-8 w-8 text-success" />
        <Icon v-else-if="payState === 'failed'" name="ph:x-bold" class="h-8 w-8 text-danger" />
        <Icon v-else name="ph:clock-bold" class="h-8 w-8 text-warning" />
      </div>

      <h1 class="mt-6 font-display text-3xl font-extrabold text-content-strong">
        {{ heading }}
      </h1>

      <p v-if="orderNumber && payState !== 'failed'" class="mt-3 text-content">
        {{ $t('confirmation.number') }}
        <span class="font-mono font-bold text-content-strong">{{ orderNumber }}</span>
      </p>

      <p v-if="payState === 'processing'" class="mt-4 text-content-muted">
        {{ $t('confirmation.processing_body') }}
      </p>
      <p v-else-if="payState === 'failed'" class="mt-4 text-content-muted">
        {{ $t('confirmation.failed_body') }}
      </p>
      <p v-else-if="payState !== 'checking'" class="mt-4 text-content-muted">
        {{ $t('confirmation.next_steps') }}
      </p>

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <template v-if="payState === 'failed'">
          <NuxtLink :to="localePath('/commande')" class="btn-primary">
            {{ $t('confirmation.retry') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/panier')" class="btn-secondary">
            {{ $t('cart.title') }}
          </NuxtLink>
        </template>
        <template v-else>
          <NuxtLink :to="localePath('/compte/commandes')" class="btn-primary">
            {{ $t('confirmation.view_orders') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/produits')" class="btn-secondary">
            {{ $t('cart.browse') }}
          </NuxtLink>
        </template>
      </div>
    </div>
  </div>
</template>
