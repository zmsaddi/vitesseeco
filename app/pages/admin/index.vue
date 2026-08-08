<script setup lang="ts">
/**
 * Admin overview.
 *
 * The queue comes first because it is what needs a person today; the period
 * figures below it are for looking back. Revenue counts paid orders only —
 * counting placed ones flatters the number with baskets abandoned at payment,
 * and the gap between the two is the figure actually worth watching.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const { formatDecimal, formatPercent } = useFormatPrice()
const period = ref<'24h' | '7d' | '30d' | '90d'>('7d')

interface Dashboard {
  placed: number
  paid: number
  cancelled: number
  awaitingPayment: number
  revenue: string
  conversion: number
  averageOrder: string
  topProducts: Array<{ name: string; units: number; revenue: string }>
  queue: { toProcess: number; toShip: number; cashAwaitingCollection: number }
}

const { data, refresh } = await useFetch<Dashboard>('/api/admin/dashboard', {
  query: computed(() => ({ period: period.value })),
})

watch(period, () => refresh())

useSeoMeta({ title: () => t('admin.overview'), robots: 'noindex' })
</script>

<template>
  <div class="container-page">
    <h1 class="font-display text-2xl font-extrabold text-content-strong">{{ $t('admin.overview') }}</h1>

    <section v-if="data" class="mt-6">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
        {{ $t('admin.needs_you') }}
      </h2>
      <div class="mt-3 grid gap-4 sm:grid-cols-3">
        <div class="card p-5">
          <p class="text-3xl font-extrabold text-content-strong">{{ data.queue.toProcess }}</p>
          <p class="mt-1 text-sm text-content-muted">{{ $t('admin.to_process') }}</p>
        </div>
        <div class="card p-5">
          <p class="text-3xl font-extrabold text-content-strong">{{ data.queue.toShip }}</p>
          <p class="mt-1 text-sm text-content-muted">{{ $t('admin.to_ship') }}</p>
        </div>
        <div class="card p-5">
          <p class="text-3xl font-extrabold text-content-strong">{{ data.queue.cashAwaitingCollection }}</p>
          <p class="mt-1 text-sm text-content-muted">{{ $t('admin.cash_pending') }}</p>
        </div>
      </div>
    </section>

    <section v-if="data" class="mt-10">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
          {{ $t('admin.performance') }}
        </h2>
        <label>
          <span class="sr-only">{{ $t('admin.period') }}</span>
          <select v-model="period" class="field w-auto">
            <option value="24h">{{ $t('admin.period_24h') }}</option>
            <option value="7d">{{ $t('admin.period_7d') }}</option>
            <option value="30d">{{ $t('admin.period_30d') }}</option>
            <option value="90d">{{ $t('admin.period_90d') }}</option>
          </select>
        </label>
      </div>

      <div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card p-5">
          <p class="text-2xl font-extrabold text-content-strong">{{ formatDecimal(data.revenue) }}</p>
          <p class="mt-1 text-sm text-content-muted">{{ $t('admin.revenue_paid') }}</p>
        </div>
        <div class="card p-5">
          <p class="text-2xl font-extrabold text-content-strong">{{ data.paid }}</p>
          <p class="mt-1 text-sm text-content-muted">{{ $t('admin.orders_paid') }}</p>
        </div>
        <div class="card p-5">
          <p class="text-2xl font-extrabold text-content-strong">{{ formatPercent(data.conversion) }}</p>
          <!-- Placed versus paid. The difference is baskets lost at payment. -->
          <p class="mt-1 text-sm text-content-muted">{{ $t('admin.conversion') }}</p>
        </div>
        <div class="card p-5">
          <p class="text-2xl font-extrabold text-content-strong">{{ formatDecimal(data.averageOrder) }}</p>
          <p class="mt-1 text-sm text-content-muted">{{ $t('admin.average_order') }}</p>
        </div>
      </div>
    </section>

    <section v-if="data?.topProducts?.length" class="mt-10">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
        {{ $t('admin.top_products') }}
      </h2>
      <ul class="card mt-3 divide-y divide-surface-border">
        <li
          v-for="product in data.topProducts"
          :key="product.name"
          class="flex items-center justify-between gap-4 p-4"
        >
          <span class="min-w-0 flex-1 truncate text-content-strong">{{ product.name }}</span>
          <span class="text-sm text-content-muted">× {{ product.units }}</span>
          <span class="font-semibold text-content-strong">{{ formatDecimal(product.revenue) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
