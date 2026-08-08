<script setup lang="ts">
/**
 * Account home.
 *
 * A high-ticket shop with a warranty is a shop customers come back to months
 * later — so the order history is the point of this page, not a dashboard.
 */
definePageMeta({ middleware: 'auth' })

const localePath = useLocalePath()
const { t } = useI18n()

const { formatShortDate } = useFormatDate()
// Prices arrive as dot-decimal wire strings; rendering them raw shows a French
// customer '1498.00 €' where their own locale reads '1 498,00 €'.
const { formatDecimal } = useFormatPrice()
const { data: me } = await useFetch<{
  firstName: string
  lastName: string
  email: string
  isAdmin: boolean
} | null>('/api/auth/me')

interface OrderLine {
  name: string
  color: string | null
  image: string | null
  quantity: number
  lineTotal: string
}
interface Order {
  orderNumber: string
  status: string
  total: string
  trackingNumber: string | null
  carrier: string | null
  createdAt: string
  items: OrderLine[]
}

const { data: orders } = await useFetch<{ orders: Order[]; total: number }>('/api/account/orders', {
  query: { perPage: 10 },
})

/** Colour by meaning, so a cancelled order never reads as a successful one. */
function statusTone(status: string): string {
  if (status === 'cancelled') return 'bg-danger-subtle text-danger'
  if (status === 'delivered') return 'bg-success-subtle text-success'
  if (status === 'awaiting_payment') return 'bg-warning-subtle text-warning'
  return 'bg-accent-subtle text-accent'
}

async function signOut(): Promise<void> {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo(localePath('/'))
}

useSeoMeta({ title: () => t('account.title'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-10">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('account.title') }}</h1>
        <p v-if="me" class="mt-1 text-content-muted">{{ me.firstName }} {{ me.lastName }} · {{ me.email }}</p>
      </div>
      <div class="flex items-center gap-3">
        <!--
          The panel's only door. Typing "/admin" by hand always lands on the
          unprefixed — French — route, so the owner's language is lost before
          the page even loads. Arriving by a localePath link carries it in.
        -->
        <NuxtLink v-if="me?.isAdmin" :to="localePath('/admin')" class="btn-secondary">
          {{ $t('admin.title') }}
        </NuxtLink>
        <button type="button" class="btn-secondary" @click="signOut">{{ $t('account.sign_out') }}</button>
      </div>
    </div>

    <section class="mt-10">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('account.orders') }}</h2>

      <p v-if="!orders?.orders?.length" class="mt-4 text-content-muted">
        {{ $t('account.no_orders') }}
      </p>

      <ul v-else class="mt-4 space-y-4">
        <li v-for="order in orders.orders" :key="order.orderNumber" class="card p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-mono font-bold text-content-strong">{{ order.orderNumber }}</p>
              <p class="text-sm text-content-muted">
                {{ formatShortDate(order.createdAt) }}
              </p>
            </div>
            <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusTone(order.status)">
              {{ $t(`order_status.${order.status}`) }}
            </span>
          </div>

          <ul class="mt-4 space-y-2">
            <li v-for="(item, index) in order.items" :key="index" class="flex items-center gap-3 text-sm">
              <NuxtImg
                v-if="item.image"
                :src="item.image"
                :alt="item.name"
                width="48"
                height="48"
                class="h-12 w-12 rounded-lg object-cover"
              />
              <span class="flex-1 text-content">
                {{ item.name }}
                <span v-if="item.color" class="text-content-muted">· {{ item.color }}</span>
                <span class="text-content-muted"> × {{ item.quantity }}</span>
              </span>
              <span class="text-content-strong">{{ formatDecimal(item.lineTotal) }}</span>
            </li>
          </ul>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3">
            <p v-if="order.trackingNumber" class="text-sm text-content-muted">
              {{ $t('account.tracking') }}
              <span class="font-mono text-content-strong">{{ order.trackingNumber }}</span>
              <span v-if="order.carrier"> · {{ order.carrier }}</span>
            </p>
            <p class="ms-auto font-bold text-content-strong">{{ formatDecimal(order.total) }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section class="mt-12">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('account.addresses') }}</h2>
      <NuxtLink :to="localePath('/compte/adresses')" class="btn-secondary mt-4">
        {{ $t('account.manage_addresses') }}
      </NuxtLink>
    </section>
  </div>
</template>
