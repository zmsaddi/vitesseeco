<script setup lang="ts">
/**
 * One order, as the person packing it needs to see it.
 *
 * The delivery address and the line items are the whole point of this page:
 * without them an order that arrives cannot be shipped, and the queue view
 * deliberately does not carry them.
 *
 * Status changes go through the same transition machine the payment webhooks
 * use, so a click here cannot move an order anywhere a payment event could not,
 * including backwards.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const route = useRoute()
const { t, locale } = useI18n()
const { formatDecimal, formatPercent } = useFormatPrice()
const orderNumber = computed(() => String(route.params.orderNumber ?? ''))

interface Address {
  firstName?: string
  lastName?: string
  phone?: string
  line1?: string
  line2?: string
  postalCode?: string
  city?: string
  country?: string
}

interface OrderItem {
  productId: string
  sku: string | null
  name: string
  color: string | null
  image: string | null
  quantity: number
  unitPrice: string
  lineTotal: string
}

interface AdminOrder {
  orderNumber: string
  status: string
  paymentMethod: string
  shippingMethodCode: string
  locale: string
  marketCountry: string
  subtotal: string
  discount: string
  shipping: string
  total: string
  vat: { ratePercent: number; amount: string }
  promoCode: string | null
  customerSnapshot: { name?: string; email?: string } | null
  guestEmail: string | null
  shippingAddress: Address | null
  billingAddress: Address | null
  trackingNumber: string | null
  notes: string | null
  adminNotes: string | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  items: OrderItem[]
}

const { data: order, refresh, status: loadState } = await useFetch<AdminOrder>(
  () => `/api/admin/orders/${orderNumber.value}`
)

const busy = ref(false)
const error = ref<string | null>(null)

async function patch(body: Record<string, unknown>): Promise<void> {
  busy.value = true
  error.value = null
  try {
    await $fetch<unknown>(`/api/admin/orders/${orderNumber.value}`, { method: 'PATCH', body })
    await refresh()
  } catch (err: unknown) {
    const payload = (err as { data?: { messageKey?: string } })?.data
    error.value = payload?.messageKey ? t(payload.messageKey) : t('errors.internal')
  } finally {
    busy.value = false
  }
}

/** What this order can become next, mirroring the server's transition table. */
function nextStatuses(status: string): string[] {
  switch (status) {
    case 'paid':
      return ['processing', 'cancelled']
    case 'processing':
      return ['shipped', 'cancelled']
    case 'shipped':
      return ['delivered']
    case 'awaiting_payment':
      return ['cancelled']
    default:
      return []
  }
}

const canMarkCash = computed(
  () => order.value?.status === 'awaiting_payment' && order.value?.paymentMethod !== 'stripe'
)

const { formatDateTime } = useFormatDate()
const formatDate = (value: string | null) => formatDateTime(value) || '—'

/** The address as it goes on a label — one line per line, in postal order. */
const addressLines = computed<string[]>(() => {
  const address = order.value?.shippingAddress
  if (!address) return []
  return [
    [address.firstName, address.lastName].filter(Boolean).join(' '),
    address.line1,
    address.line2,
    [address.postalCode, address.city].filter(Boolean).join(' '),
    address.country,
  ].filter((line): line is string => Boolean(line && line.trim()))
})

const timeline = computed(() =>
  [
    { key: 'placed', at: order.value?.createdAt ?? null },
    { key: 'paid', at: order.value?.paidAt ?? null },
    { key: 'shipped', at: order.value?.shippedAt ?? null },
    { key: 'delivered', at: order.value?.deliveredAt ?? null },
    { key: 'cancelled', at: order.value?.cancelledAt ?? null },
  ].filter((entry) => entry.at !== null)
)

useSeoMeta({ title: () => `${orderNumber.value} — ${t('admin.orders')}`, robots: 'noindex' })
</script>

<template>
  <div class="container-page">
    <NuxtLink :to="useLocalePath()('/admin/commandes')" class="text-sm text-content-muted hover:text-content-strong">
      ← {{ $t('admin.orders') }}
    </NuxtLink>

    <p v-if="loadState === 'pending'" class="mt-6 text-content-muted">{{ $t('common.loading') }}</p>
    <p v-else-if="!order" class="mt-6 text-content-muted">{{ $t('admin.no_orders') }}</p>

    <template v-else>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <h1 class="font-display text-2xl font-extrabold text-content-strong">{{ order.orderNumber }}</h1>
        <span class="rounded-full bg-accent-subtle px-2.5 py-0.5 text-sm font-semibold text-accent">
          {{ $t(`order_status.${order.status}`) }}
        </span>
        <span class="ms-auto text-xl font-bold text-content-strong">{{ formatDecimal(order.total) }}</span>
      </div>

      <p v-if="error" role="alert" class="mt-4 text-sm text-danger">{{ error }}</p>

      <!-- Actions first: this page is opened to DO something. -->
      <div class="mt-6 flex flex-wrap items-center gap-2">
        <button
          v-if="canMarkCash"
          type="button"
          class="btn-primary h-10 px-4 text-sm"
          :disabled="busy"
          @click="patch({ markCashReceived: true })"
        >
          {{ $t('admin.mark_cash_received') }}
        </button>
        <button
          v-for="next in nextStatuses(order.status)"
          :key="next"
          type="button"
          class="btn-secondary h-10 px-4 text-sm"
          :disabled="busy"
          @click="patch({ status: next })"
        >
          {{ $t(`order_status.${next}`) }}
        </button>
        <input
          :value="order.trackingNumber ?? ''"
          type="text"
          class="field h-10 w-56"
          :placeholder="$t('admin.tracking_number')"
          :disabled="busy"
          @change="patch({ trackingNumber: ($event.target as HTMLInputElement).value })"
        />
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-3">
        <!-- What goes in the box. -->
        <section class="card p-4 lg:col-span-2">
          <h2 class="font-display font-bold text-content-strong">{{ $t('admin.items') }}</h2>
          <ul class="mt-3 divide-y divide-surface-border">
            <li v-for="item in order.items" :key="item.productId" class="flex items-center gap-3 py-3">
              <NuxtImg
                v-if="item.image"
                :src="item.image"
                :alt="item.name"
                width="48"
                height="48"
                class="h-12 w-12 rounded-lg object-cover"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-content-strong">{{ item.name }}</p>
                <p class="text-xs text-content-muted">
                  <span v-if="item.color">{{ item.color }} · </span>
                  <span v-if="item.sku" class="font-mono">{{ item.sku }}</span>
                </p>
              </div>
              <span class="text-sm text-content-muted">× {{ item.quantity }}</span>
              <span class="w-24 text-end font-semibold text-content-strong">{{ formatDecimal(item.lineTotal) }}</span>
            </li>
          </ul>

          <dl class="mt-4 space-y-1 border-t border-surface-border pt-4 text-sm">
            <div class="flex justify-between">
              <dt class="text-content-muted">{{ $t('cart.subtotal') }}</dt>
              <dd class="text-content">{{ formatDecimal(order.subtotal) }}</dd>
            </div>
            <div v-if="order.discount !== '0.00'" class="flex justify-between">
              <dt class="text-content-muted">
                {{ $t('cart.discount') }}<span v-if="order.promoCode"> ({{ order.promoCode }})</span>
              </dt>
              <dd class="text-success">−{{ formatDecimal(order.discount) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-content-muted">{{ $t('checkout.shipping') }}</dt>
              <dd class="text-content">{{ formatDecimal(order.shipping) }}</dd>
            </div>
            <div class="flex justify-between border-t border-surface-border pt-2 font-bold">
              <dt class="text-content-strong">{{ $t('cart.total') }}</dt>
              <dd class="text-content-strong">{{ formatDecimal(order.total) }}</dd>
            </div>
            <div class="flex justify-between text-xs">
              <dt class="text-content-muted">
                {{ $t('admin.vat_in_price') }} ({{ formatPercent(order.vat.ratePercent) }} · {{ order.marketCountry }})
              </dt>
              <dd class="text-content-muted">{{ formatDecimal(order.vat.amount) }}</dd>
            </div>
          </dl>
        </section>

        <div class="space-y-6">
          <!-- Where it goes. Selectable so it can be copied onto a label. -->
          <section class="card p-4">
            <h2 class="font-display font-bold text-content-strong">{{ $t('admin.delivery_address') }}</h2>
            <address v-if="addressLines.length" class="mt-2 select-all not-italic leading-relaxed text-content">
              <span v-for="line in addressLines" :key="line" class="block">{{ line }}</span>
            </address>
            <p v-else class="mt-2 text-sm text-content-muted">{{ $t('admin.no_address') }}</p>
            <p v-if="order.shippingAddress?.phone" class="mt-2 text-sm">
              <a :href="`tel:${order.shippingAddress.phone}`" class="text-accent">
                {{ order.shippingAddress.phone }}
              </a>
            </p>
            <!--
              A pickup order has no address by design, so this card would
              otherwise read as missing data on the one kind of order that needs
              a different action: nothing to ship, someone is coming to Poitiers.
              The method was here before as a bare machine code in 12px grey.
            -->
            <p class="mt-3 text-sm">
              <span class="text-content-muted">{{ $t('checkout.how') }}&nbsp;: </span>
              <span class="font-semibold text-content-strong">
                {{ order.shippingMethodCode === 'pickup' ? $t('admin.pickup') : $t('checkout.shipping') }}
              </span>
              <span class="ms-1 font-mono text-xs text-content-muted">{{ order.shippingMethodCode }}</span>
            </p>
          </section>

          <section class="card p-4">
            <h2 class="font-display font-bold text-content-strong">{{ $t('admin.customer') }}</h2>
            <p class="mt-2 text-content">{{ order.customerSnapshot?.name ?? '—' }}</p>
            <p class="text-sm">
              <a
                :href="`mailto:${order.customerSnapshot?.email ?? order.guestEmail ?? ''}`"
                class="text-accent"
              >{{ order.customerSnapshot?.email ?? order.guestEmail ?? '—' }}</a>
            </p>
            <p v-if="order.notes" class="mt-3 whitespace-pre-wrap rounded-lg bg-surface-sunken p-2 text-sm text-content">
              {{ order.notes }}
            </p>
          </section>

          <section class="card p-4">
            <h2 class="font-display font-bold text-content-strong">{{ $t('admin.history') }}</h2>
            <ul class="mt-2 space-y-1 text-sm">
              <li v-for="entry in timeline" :key="entry.key" class="flex justify-between gap-3">
                <span class="text-content-muted">{{ $t(`admin.at_${entry.key}`) }}</span>
                <span class="text-content">{{ formatDate(entry.at) }}</span>
              </li>
            </ul>

            <label class="mt-4 block">
              <span class="text-xs font-semibold uppercase tracking-wide text-content-muted">
                {{ $t('admin.internal_note') }}
              </span>
              <textarea
                :value="order.adminNotes ?? ''"
                rows="3"
                class="field mt-1 w-full"
                :placeholder="$t('admin.internal_note_hint')"
                :disabled="busy"
                @blur="patch({ adminNotes: ($event.target as HTMLTextAreaElement).value })"
              />
            </label>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
