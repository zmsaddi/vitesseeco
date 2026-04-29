<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-3xl">
      <NuxtLink :to="localePath('/compte')" class="text-text-secondary hover:text-accent text-sm flex items-center gap-1.5 mb-6">
        <Icon name="ph:arrow-left" class="w-4 h-4 rtl:rotate-180" />
        {{ $t('account.title') }}
      </NuxtLink>

      <!-- Loading -->
      <div v-if="pending" class="space-y-4">
        <AppSkeleton class="h-9 w-1/2" />
        <AppSkeleton class="h-32 w-full rounded-xl" />
        <AppSkeleton class="h-48 w-full rounded-xl" />
      </div>

      <!-- Error / not found -->
      <div v-else-if="error || !data" class="card p-8 text-center">
        <Icon name="ph:warning-circle" class="w-12 h-12 text-text-secondary mx-auto mb-4" />
        <p class="text-text-secondary mb-4">{{ $t('account.no_orders') }}</p>
        <NuxtLink :to="localePath('/compte')" class="btn-outline btn-sm inline-block">
          {{ $t('account.title') }}
        </NuxtLink>
      </div>

      <!-- Order detail -->
      <template v-else>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 class="font-display text-2xl md:text-3xl font-bold text-white">
              {{ $t('checkout.order_number') }}: {{ data.orderNumber }}
            </h1>
            <p class="text-text-secondary text-sm mt-1">{{ formatDate(data.createdAt) }}</p>
          </div>
          <span :class="statusClass" class="badge-base inline-flex">
            <Icon :name="statusIcon" class="w-3.5 h-3.5" />
            {{ statusLabel }}
          </span>
        </div>

        <!-- Tracking -->
        <div v-if="data.trackingNumber" class="card p-4 mb-6 flex items-center gap-3">
          <Icon name="ph:package" class="w-5 h-5 text-accent shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-text-secondary text-xs">{{ $t('account.tracking') }}</p>
            <p class="text-white font-medium">{{ data.trackingNumber }}</p>
          </div>
        </div>

        <!-- Items -->
        <section class="card mb-6">
          <header class="px-4 py-3 border-b border-dark-tertiary/50">
            <h2 class="font-display font-semibold text-white">{{ $t('cart.title') }}</h2>
          </header>
          <ul class="divide-y divide-dark-tertiary/50">
            <li v-for="(item, i) in data.items" :key="i" class="px-4 py-3 flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-medium">{{ item.productName }}</p>
                <p v-if="item.color" class="text-text-secondary text-xs">{{ item.color }}</p>
                <p class="text-text-secondary text-xs mt-0.5">× {{ item.quantity }}</p>
              </div>
              <p class="text-accent font-semibold text-sm whitespace-nowrap">
                {{ (item.price * item.quantity).toFixed(2) }}€
              </p>
            </li>
          </ul>
        </section>

        <!-- Totals -->
        <section class="card p-4 mb-6 space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-text-secondary">{{ $t('cart.subtotal') }}</span>
            <span class="text-white">{{ Number(data.subtotal).toFixed(2) }}€</span>
          </div>
          <div v-if="Number(data.discount) > 0" class="flex justify-between text-sm">
            <span class="text-accent">{{ $t('cart.discount') }}{{ data.promoCode ? ` (${data.promoCode})` : '' }}</span>
            <span class="text-accent">−{{ Number(data.discount).toFixed(2) }}€</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-text-secondary">{{ $t('cart.shipping') }}</span>
            <span class="text-white">{{ Number(data.shippingCost).toFixed(2) }}€</span>
          </div>
          <div class="flex justify-between border-t border-dark-tertiary pt-2 mt-2">
            <span class="text-white font-display font-semibold">{{ $t('cart.total') }}</span>
            <span class="text-accent font-display font-bold text-lg">{{ Number(data.total).toFixed(2) }}€</span>
          </div>
        </section>

        <!-- Address -->
        <section v-if="data.shippingAddress" class="card p-4 mb-6">
          <h2 class="font-display font-semibold text-white mb-2">{{ $t('checkout.shipping_address') }}</h2>
          <address class="text-text-secondary text-sm not-italic leading-relaxed">
            {{ data.shippingAddress.firstName }} {{ data.shippingAddress.lastName }}<br />
            {{ data.shippingAddress.address }}<br />
            <span v-if="data.shippingAddress.addressLine2">{{ data.shippingAddress.addressLine2 }}<br /></span>
            {{ data.shippingAddress.postalCode }} {{ data.shippingAddress.city }}<br />
            {{ data.shippingAddress.country }}
            <template v-if="data.shippingAddress.phone"><br />{{ data.shippingAddress.phone }}</template>
          </address>
        </section>

        <!-- Payment -->
        <section v-if="data.paymentMethod" class="card p-4">
          <h2 class="font-display font-semibold text-white mb-2">{{ $t('checkout.payment_method') }}</h2>
          <p class="text-text-secondary text-sm">{{ paymentMethodLabel }}</p>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

definePageMeta({ middleware: ['auth'] })

const orderNumber = computed(() => route.params.orderNumber as string)

const { data, error, pending } = await useFetch<any>(() => `/api/orders/${orderNumber.value}`, {
  watch: [orderNumber],
})

useSeoMeta({
  title: () => `${t('checkout.order_number')} ${orderNumber.value} — Vitesse Eco`,
})

function formatDate(d: string | Date | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

const statusInfo = computed(() => {
  const s = data.value?.status || 'pending'
  return {
    pending:    { icon: 'ph:clock',         class: 'bg-gold/20 text-gold' },
    paid:       { icon: 'ph:check-circle',  class: 'bg-accent/20 text-accent' },
    processing: { icon: 'ph:package',       class: 'bg-accent/20 text-accent' },
    shipped:    { icon: 'ph:truck',         class: 'bg-accent/20 text-accent' },
    delivered:  { icon: 'ph:check-circle',  class: 'bg-accent/20 text-accent' },
    cancelled:  { icon: 'ph:x-circle',      class: 'bg-danger/20 text-red-400' },
  }[s as string] || { icon: 'ph:circle', class: 'bg-dark-tertiary text-text-secondary' }
})

const statusIcon = computed(() => statusInfo.value.icon)
const statusClass = computed(() => statusInfo.value.class)
const statusLabel = computed(() => t(`account.order_status.${data.value?.status || 'pending'}`))

const paymentMethodLabel = computed(() => {
  const code = data.value?.paymentMethod
  if (!code) return ''
  // Match Sanity paymentMethod enum
  const labels: Record<string, string> = {
    in_store: '🏪 ' + t('checkout.payment_method'),
    stripe: '💳 Stripe',
    paypal: '🅿️ PayPal',
    apple_pay: '📱 Apple Pay',
    google_pay: '📱 Google Pay',
    bank_transfer: '🏦 ' + t('checkout.payment_method'),
  }
  return labels[code] || code
})
</script>
