<script setup lang="ts">
/**
 * The order queue.
 *
 * Status changes go through the same transition machine the payment webhooks
 * use, so a click here cannot move an order anywhere a payment event could not
 * — including backwards. Marking cash received is a separate, audited action
 * and is refused outright on an online order: whether money arrived is decided
 * by the provider, not by a button.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const { formatDecimal } = useFormatPrice()

interface AdminOrder {
  orderNumber: string
  status: string
  paymentMethod: string
  shippingMethodCode: string
  total: string
  customerSnapshot: { name?: string; email?: string } | null
  guestEmail: string | null
  shippingAddress: { city?: string; country?: string } | null
  trackingNumber: string | null
  createdAt: string
}

const filters = reactive({ status: '', payment: '', search: '', page: 1 })

const { data, refresh, status: loadState } = await useFetch<{
  orders: AdminOrder[]
  total: number
  totalPages: number
}>('/api/admin/orders', {
  query: computed(() => ({
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.payment ? { payment: filters.payment } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    page: filters.page,
    perPage: 25,
  })),
})

const busy = ref<string | null>(null)
const error = ref<string | null>(null)

async function patch(orderNumber: string, body: Record<string, unknown>): Promise<void> {
  busy.value = orderNumber
  error.value = null
  try {
    await $fetch<unknown>(`/api/admin/orders/${orderNumber}`, { method: 'PATCH', body })
    await refresh()
  } catch (err: unknown) {
    const data = (err as { data?: { messageKey?: string } })?.data
    error.value = data?.messageKey ? t(data.messageKey) : t('errors.internal')
  } finally {
    busy.value = null
  }
}

/** What this order can become next, mirroring the server's transition table. */
function nextStatuses(order: AdminOrder): string[] {
  switch (order.status) {
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

// Online methods settle through their provider; only genuinely-cash orders
// may be hand-marked. 'paypal' is the temporary bridge (server/payments/paypal.ts).
const canMarkCash = (order: AdminOrder) =>
  order.status === 'awaiting_payment' && !['stripe', 'paypal'].includes(order.paymentMethod)

function statusTone(status: string): string {
  if (status === 'cancelled') return 'bg-danger-subtle text-danger'
  if (status === 'delivered') return 'bg-success-subtle text-success'
  if (status === 'awaiting_payment') return 'bg-warning-subtle text-warning'
  return 'bg-accent-subtle text-accent'
}

const exportUrl = computed(() => {
  const query = new URLSearchParams({ limit: '1000' })
  if (filters.status) query.set('status', filters.status)
  return `/api/admin/orders/export?${query}`
})

useSeoMeta({ title: () => t('admin.orders'), robots: 'noindex' })
</script>

<template>
  <div class="container-page">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="font-display text-2xl font-extrabold text-content-strong">{{ $t('admin.orders') }}</h1>
      <a :href="exportUrl" class="btn-secondary">{{ $t('admin.export_csv') }}</a>
    </div>

    <div class="mt-6 flex flex-wrap gap-3">
      <input
        v-model="filters.search"
        type="search"
        class="field w-auto flex-1 min-w-52"
        :placeholder="$t('admin.search_orders')"
        @change="filters.page = 1"
      />
      <select v-model="filters.status" class="field w-auto" @change="filters.page = 1">
        <option value="">{{ $t('admin.all_statuses') }}</option>
        <option v-for="s in ['awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']" :key="s" :value="s">
          {{ $t(`order_status.${s}`) }}
        </option>
      </select>
      <select v-model="filters.payment" class="field w-auto" @change="filters.page = 1">
        <option value="">{{ $t('admin.all_payments') }}</option>
        <option value="stripe">{{ $t('checkout.pay_online') }}</option>
        <option value="paypal">PayPal</option>
        <option value="cod">{{ $t('checkout.pay_cash') }}</option>
        <option value="in_store">{{ $t('checkout.pay_in_store') }}</option>
      </select>
    </div>

    <p v-if="error" role="alert" class="mt-4 text-sm text-danger">{{ error }}</p>
    <p v-if="loadState === 'pending'" class="mt-6 text-content-muted">{{ $t('common.loading') }}</p>

    <p v-else-if="!data?.orders?.length" class="mt-6 text-content-muted">{{ $t('admin.no_orders') }}</p>

    <ul v-else class="mt-6 space-y-3">
      <li v-for="order in data.orders" :key="order.orderNumber" class="card p-4">
        <div class="flex flex-wrap items-center gap-3">
          <NuxtLink
            :to="useLocalePath()(`/admin/commandes/${order.orderNumber}`)"
            class="font-mono font-bold text-content-strong underline-offset-4 hover:underline"
          ><bdi dir="ltr">{{ order.orderNumber }}</bdi></NuxtLink>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="statusTone(order.status)">
            {{ $t(`order_status.${order.status}`) }}
          </span>
          <span class="text-sm text-content-muted">
            <bdi dir="ltr">{{ order.customerSnapshot?.email ?? order.guestEmail ?? '—' }}</bdi>
          </span>
          <span v-if="order.shippingAddress?.city" class="text-sm text-content-muted">
            {{ order.shippingAddress.city }}, {{ order.shippingAddress.country }}
          </span>
          <!--
            A pickup carries no city, so without this the row showed nothing at
            all about where the order goes — and the queue could not be read as
            "these ship, these are collected" at a glance.
          -->
          <span
            v-else-if="order.shippingMethodCode === 'pickup'"
            class="rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-warning"
          >
            {{ $t('admin.pickup') }}
          </span>
          <span class="ms-auto font-bold text-content-strong">{{ formatDecimal(order.total) }}</span>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <!-- Cash is asserted deliberately, and only where a provider is not
               the one who decides. -->
          <button
            v-if="canMarkCash(order)"
            type="button"
            class="btn-primary h-9 px-3 text-xs"
            :disabled="busy === order.orderNumber"
            @click="patch(order.orderNumber, { markCashReceived: true })"
          >
            {{ $t('admin.mark_cash_received') }}
          </button>

          <button
            v-for="next in nextStatuses(order)"
            :key="next"
            type="button"
            class="btn-secondary h-9 px-3 text-xs"
            :disabled="busy === order.orderNumber"
            @click="patch(order.orderNumber, { status: next })"
          >
            {{ $t(`order_status.${next}`) }}
          </button>

          <input
            v-if="['processing', 'shipped'].includes(order.status)"
            :value="order.trackingNumber ?? ''"
            type="text"
            class="field h-9 w-48 text-xs"
            :placeholder="$t('admin.tracking_number')"
            @change="patch(order.orderNumber, { trackingNumber: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </li>
    </ul>

    <nav v-if="data && data.totalPages > 1" class="mt-8 flex justify-center gap-2">
      <button type="button" class="btn-secondary" :disabled="filters.page <= 1" @click="filters.page--">
        {{ $t('common.previous') }}
      </button>
      <span class="flex items-center px-3 text-sm text-content-muted">
        {{ filters.page }} / {{ data.totalPages }}
      </span>
      <button
        type="button"
        class="btn-secondary"
        :disabled="filters.page >= data.totalPages"
        @click="filters.page++"
      >
        {{ $t('common.next') }}
      </button>
    </nav>
  </div>
</template>
