<script setup lang="ts">
/**
 * Order confirmation.
 *
 * The order number is read from the URL and shown, but nothing about the
 * order's state is taken from there — a customer arriving with a made-up number
 * is told nothing about anyone's order.
 *
 * Delayed payment methods reach this page BEFORE the money settles: iDEAL and
 * Bancontact confirm the session and settle afterwards. So the wording says the
 * order was received, not that it was paid, and the real state arrives by
 * webhook and appears in the account.
 */
const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()

const orderNumber = computed(() => {
  const value = Array.isArray(route.query.order) ? route.query.order[0] : route.query.order
  return typeof value === 'string' && /^ORD-[A-Z0-9]{6,20}$/.test(value) ? value : null
})

onMounted(() => {
  // The basket has done its job. Clearing it here rather than before payment
  // means an abandoned checkout still has its contents when the customer
  // comes back.
  useCart().clear()
})

useSeoMeta({ title: () => t('confirmation.title'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-16">
    <div class="mx-auto max-w-lg text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
        <Icon name="ph:check-bold" class="h-8 w-8 text-success" />
      </div>

      <h1 class="mt-6 font-display text-3xl font-extrabold text-content-strong">
        {{ $t('confirmation.title') }}
      </h1>

      <p v-if="orderNumber" class="mt-3 text-content">
        {{ $t('confirmation.number') }}
        <span class="font-mono font-bold text-content-strong">{{ orderNumber }}</span>
      </p>

      <p class="mt-4 text-content-muted">{{ $t('confirmation.next_steps') }}</p>

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <NuxtLink :to="localePath('/compte/commandes')" class="btn-primary">
          {{ $t('confirmation.view_orders') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/produits')" class="btn-secondary">
          {{ $t('cart.browse') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
