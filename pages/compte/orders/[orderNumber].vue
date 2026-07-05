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

        <!-- U-P11: status timeline — the customer sees exactly where the order is -->
        <section v-if="data.status !== 'cancelled'" class="card p-5 mb-6">
          <ol class="flex items-start">
            <template v-for="(step, i) in timelineSteps" :key="step.key">
              <li class="flex flex-col items-center text-center flex-1 min-w-0">
                <span
                  class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors"
                  :class="i <= currentStep
                    ? 'bg-accent border-accent text-primary'
                    : i === currentStep + 1
                      ? 'border-accent/50 text-accent bg-accent/10'
                      : 'border-dark-tertiary text-text-secondary'"
                >
                  <Icon v-if="i <= currentStep" name="ph:check-bold" class="w-4 h-4" />
                  <Icon v-else :name="step.icon" class="w-4 h-4" />
                </span>
                <span class="text-xs mt-2 leading-tight" :class="i <= currentStep ? 'text-accent font-medium' : 'text-text-secondary'">
                  {{ step.label }}
                </span>
              </li>
              <li v-if="i < timelineSteps.length - 1" aria-hidden="true" class="flex-1 h-0.5 mt-[1.1rem] -mx-4" :class="i < currentStep ? 'bg-accent' : 'bg-dark-tertiary'" />
            </template>
          </ol>
          <p v-if="data.status === 'pending'" class="text-gold text-xs text-center mt-4 flex items-center justify-center gap-1.5">
            <Icon name="ph:clock" class="w-3.5 h-3.5" /> {{ statusLabel }}
          </p>
        </section>

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
                <!-- Order item sku IS the product slug (System B) — always give
                     the customer a way back to the product page. -->
                <NuxtLink
                  v-if="item.sku"
                  :to="localePath(`/produits/${item.sku}`)"
                  class="text-white text-sm font-medium hover:text-accent transition-colors"
                >
                  {{ item.productName }}
                </NuxtLink>
                <p v-else class="text-white text-sm font-medium">{{ item.productName }}</p>
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

        <!-- U-P11: one-click reorder -->
        <button
          type="button"
          class="btn-primary w-full py-3.5 mb-6 flex items-center justify-center gap-2 disabled:opacity-50"
          :disabled="reordering"
          @click="reorder"
        >
          <Icon :name="reordering ? 'ph:spinner' : 'ph:arrow-clockwise'" class="w-5 h-5" :class="{ 'animate-spin': reordering }" />
          {{ $t('account.reorder') }}
        </button>

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
  robots: 'noindex',
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

// U-P11: timeline. pending sits before the first milestone (awaiting payment).
const timelineSteps = computed(() => [
  { key: 'paid',       icon: 'ph:credit-card', label: t('account.order_status.paid') },
  { key: 'processing', icon: 'ph:package',     label: t('account.order_status.processing') },
  { key: 'shipped',    icon: 'ph:truck',       label: t('account.order_status.shipped') },
  { key: 'delivered',  icon: 'ph:house',       label: t('account.order_status.delivered') },
])
const currentStep = computed(() => {
  const order = ['paid', 'processing', 'shipped', 'delivered']
  return order.indexOf(data.value?.status || '')
})

// U-P11: one-click reorder — items carry sku (== product slug in System B),
// so we refetch live product docs and rebuild cart lines from fresh data
// (current price/stock, not the historical snapshot).
const sanity = useSanity()
const cart = useCartStore()
const toast = useToast()
const cartOpen = useState('cartOpen', () => false)
const reordering = ref(false)

async function reorder() {
  const items: any[] = data.value?.items || []
  if (!items.length || reordering.value) return
  reordering.value = true
  try {
    const skus = items.map((i) => i.sku).filter(Boolean)
    const products: any[] = await sanity.fetch(
      groq`*[_type == "product" && slug.current in $skus && isAvailable == true]{
        _id, name, slug, price, color, colorHex, stock, "images": images[0..0]{asset}
      }`,
      { skus }
    )
    const bySku = new Map(products.map((p) => [p.slug?.current, p]))
    let added = 0
    for (const item of items) {
      const p = bySku.get(item.sku)
      if (!p || (p.stock || 0) <= 0) continue
      const qty = Math.min(item.quantity || 1, p.stock, 10)
      const imgUrl = p.images?.[0]?.asset ? useSanityImageUrl(p.images[0], 150, 150) : ''
      cart.addItem({
        productId: p._id,
        name: p.name,
        slug: p.slug?.current || '',
        price: p.price,
        colorHex: p.colorHex || '#000',
        colorName: p.color || { fr: '' },
        sku: p.slug?.current || p._id,
        image: imgUrl,
      }, qty)
      added += qty
    }
    if (added > 0) {
      toast.success(t('account.reorder_done', { n: added }))
      if (added < items.reduce((s, i) => s + (i.quantity || 1), 0)) {
        toast.warning(t('account.reorder_partial'))
      }
      cartOpen.value = true
    } else {
      toast.error(t('account.reorder_partial'))
    }
  } catch {
    toast.error(t('account.reorder_partial'))
  } finally {
    reordering.value = false
  }
}

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
