<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 class="text-2xl font-display font-bold">{{ $t('admin.orders_title') }}</h1>
      <div class="relative w-full sm:w-72">
        <Icon name="heroicons:magnifying-glass" class="w-5 h-5 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none" />
        <input
          ref="searchEl"
          v-model="searchInput"
          type="search"
          :placeholder="$t('admin.search_placeholder')"
          class="w-full bg-surface border border-surface-2 rounded-lg ps-10 pe-3 py-2.5 text-sm placeholder:text-on-surface-muted focus:outline-none focus:border-accent"
          :aria-label="$t('admin.search_placeholder')"
        >
      </div>
    </div>

    <!-- Status filter chips -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="chip in statusChips"
        :key="chip.value"
        type="button"
        class="rounded-full px-3.5 py-1.5 text-sm border transition-colors duration-200"
        :class="status === chip.value
          ? 'bg-accent/10 border-accent text-accent font-semibold'
          : 'bg-surface border-surface-2 text-on-surface-muted hover:text-on-surface'"
        @click="setStatus(chip.value)"
      >
        {{ $t(chip.label) }}
        <span v-if="counts[chip.value === '' ? 'all' : chip.value]" class="ms-1 text-xs opacity-75">
          {{ counts[chip.value === '' ? 'all' : chip.value] }}
        </span>
      </button>
    </div>

    <!-- Advanced filters -->
    <div class="flex flex-wrap items-end gap-3 mb-6">
      <label class="text-xs text-on-surface-muted">
        {{ $t('admin.from') }}
        <input v-model="dateFrom" type="date" class="block mt-1 bg-surface border border-surface-2 rounded-lg px-2.5 py-2 text-sm text-on-surface focus:outline-none focus:border-accent" @change="page = 1">
      </label>
      <label class="text-xs text-on-surface-muted">
        {{ $t('admin.to') }}
        <input v-model="dateTo" type="date" class="block mt-1 bg-surface border border-surface-2 rounded-lg px-2.5 py-2 text-sm text-on-surface focus:outline-none focus:border-accent" @change="page = 1">
      </label>
      <label class="text-xs text-on-surface-muted">
        {{ $t('admin.payment') }}
        <select v-model="payment" class="block mt-1 bg-surface border border-surface-2 rounded-lg px-2.5 py-2 text-sm text-on-surface focus:outline-none focus:border-accent" @change="page = 1">
          <option value="">{{ $t('admin.payment_all') }}</option>
          <option value="paypal">{{ $t('admin.payment_paypal') }}</option>
          <option value="in_store">{{ $t('admin.payment_in_store') }}</option>
          <option value="stripe">{{ $t('admin.payment_stripe') }}</option>
          <option value="klarna">{{ $t('admin.payment_klarna') }}</option>
          <option value="cod">{{ $t('admin.payment_cod') }}</option>
        </select>
      </label>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="text-sm text-on-surface-muted underline underline-offset-2 pb-2.5"
        @click="resetFilters"
      >
        {{ $t('admin.reset') }}
      </button>
      <a
        :href="exportUrl"
        class="ms-auto inline-flex items-center gap-2 rounded-lg bg-surface border border-surface-2 px-3.5 py-2 text-sm font-medium hover:border-accent transition-colors duration-200"
      >
        <Icon name="heroicons:arrow-down-tray" class="w-4 h-4" />
        {{ $t('admin.export_csv') }}
      </a>
    </div>

    <!-- U-A2: bulk action bar — appears only with a selection -->
    <div
      v-if="selected.length"
      class="flex flex-wrap items-center gap-3 mb-4 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3"
    >
      <span class="text-sm font-medium">{{ $t('admin.selected_count', { count: selected.length }) }}</span>
      <select
        v-model="bulkStatus"
        class="bg-surface border border-surface-2 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-accent"
        :aria-label="$t('admin.bulk_status')"
      >
        <option value="" disabled>{{ $t('admin.bulk_status') }}</option>
        <option v-for="chip in statusChips.slice(1)" :key="chip.value" :value="chip.value">{{ $t(chip.label) }}</option>
      </select>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-accent text-primary px-4 py-2 text-sm font-semibold disabled:opacity-40"
        :disabled="!bulkStatus || applying"
        @click="applyBulk"
      >
        <Icon v-if="applying" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
        {{ $t('admin.apply') }}
      </button>
      <button
        type="button"
        class="text-sm text-on-surface-muted underline underline-offset-2 ms-auto"
        @click="clearSelection"
      >
        {{ $t('admin.clear_selection') }}
      </button>
    </div>

    <!-- Table -->
    <div class="bg-surface border border-surface-2 rounded-xl overflow-hidden">
      <div v-if="pending" class="p-6 space-y-3">
        <div v-for="i in 5" :key="i" class="h-12 bg-surface-2 rounded animate-pulse" />
      </div>

      <div v-else-if="!rows.length" class="p-12 text-center text-on-surface-muted">
        <Icon name="heroicons:inbox" class="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p v-if="hasActiveFilters">{{ $t('admin.empty_filtered') }}</p>
        <p v-else>{{ $t('admin.empty_orders') }}</p>
      </div>

      <!-- U-A2: vertical scroll container so the sticky header actually sticks -->
      <div v-else class="overflow-auto max-h-[65vh]">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10 bg-surface">
            <tr class="text-start text-on-surface-muted border-b border-surface-2">
              <th class="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :aria-label="$t('admin.clear_selection')"
                  class="accent-accent w-4 h-4 align-middle"
                  @change="toggleAll"
                >
              </th>
              <th class="text-start font-medium px-4 py-3">{{ $t('admin.th_order') }}</th>
              <th class="text-start font-medium px-4 py-3">{{ $t('admin.th_customer') }}</th>
              <th class="text-start font-medium px-4 py-3 hidden lg:table-cell">
                <button type="button" class="inline-flex items-center gap-1 hover:text-on-surface" @click="toggleSort('created')">
                  {{ $t('admin.th_date') }} <Icon :name="sortIcon('created')" class="w-3.5 h-3.5" />
                </button>
              </th>
              <th class="text-start font-medium px-4 py-3 hidden sm:table-cell">{{ $t('admin.th_items') }}</th>
              <th class="text-start font-medium px-4 py-3">
                <button type="button" class="inline-flex items-center gap-1 hover:text-on-surface" @click="toggleSort('total')">
                  {{ $t('admin.th_total') }} <Icon :name="sortIcon('total')" class="w-3.5 h-3.5" />
                </button>
              </th>
              <th class="text-start font-medium px-4 py-3">{{ $t('admin.th_status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in rows"
              :key="order.orderNumber ?? ''"
              class="border-b border-surface-2 last:border-0 hover:bg-surface-2/50 cursor-pointer transition-colors duration-200"
              @click="navigateTo(localePath(`/admin/commandes/${order.orderNumber}`))"
            >
              <td class="px-3 py-3.5 w-10" @click.stop>
                <input
                  type="checkbox"
                  :checked="selected.includes(order.orderNumber ?? '')"
                  :aria-label="order.orderNumber ?? ''"
                  class="accent-accent w-4 h-4 align-middle"
                  @change="toggleRow(order.orderNumber ?? '')"
                >
              </td>
              <td class="px-4 py-3.5">
                <NuxtLink :to="localePath(`/admin/commandes/${order.orderNumber}`)" class="font-mono font-semibold text-accent" @click.stop>
                  {{ order.orderNumber }}
                </NuxtLink>
              </td>
              <td class="px-4 py-3.5">
                <div class="font-medium">{{ order.customerName || '—' }}</div>
                <div class="text-xs text-on-surface-muted">{{ order.customerEmail }}</div>
              </td>
              <td class="px-4 py-3.5 text-on-surface-muted hidden lg:table-cell">{{ formatDate(order.createdAt) }}</td>
              <td class="px-4 py-3.5 hidden sm:table-cell">{{ order.itemsCount }}</td>
              <td class="px-4 py-3.5 font-semibold whitespace-nowrap">{{ formatPrice(order.total) }}</td>
              <td class="px-4 py-3.5">
                <span class="inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap" :class="statusClass(order.status)">
                  {{ statusLabel(order.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 text-sm">
      <button
        type="button"
        class="rounded-lg border border-surface-2 bg-surface px-4 py-2 disabled:opacity-40"
        :disabled="page <= 1"
        @click="page--"
      >
        {{ $t('admin.prev') }}
      </button>
      <span class="text-on-surface-muted">{{ $t('admin.page_of', { page, total: totalPages }) }}</span>
      <button
        type="button"
        class="rounded-lg border border-surface-2 bg-surface px-4 py-2 disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="page++"
      >
        {{ $t('admin.next') }}
      </button>
    </div>

    <!-- U-A2: keyboard shortcuts — desktop power users -->
    <p class="hidden md:block text-xs text-on-surface-muted mt-4">
      {{ $t('admin.shortcuts_hint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { STATUS_LABELS, STATUS_CLASSES } from '~/utils/adminOrderStatus'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { t, locale } = useI18n()
const { formatDateTime } = useFormatDate()
const localePath = useLocalePath()
useHead({ title: computed(() => `${t('admin.orders_title')} — Admin Vitesse Eco`) })

const route = useRoute()
const page = ref(1)
// Dashboard status chips deep-link here via /admin/commandes?status=<x>.
const status = ref(typeof route.query.status === 'string' ? route.query.status : '')
const search = ref('')
const searchInput = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const payment = ref('')
const sort = ref('created_desc')

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = val.trim()
    page.value = 1
  }, 300)
})

function setStatus(value: string) {
  status.value = value
  page.value = 1
}

const filterParams = computed(() => ({
  ...(status.value ? { status: status.value } : {}),
  ...(search.value ? { q: search.value } : {}),
  ...(dateFrom.value ? { dateFrom: dateFrom.value } : {}),
  ...(dateTo.value ? { dateTo: dateTo.value } : {}),
  ...(payment.value ? { payment: payment.value } : {}),
  ...(sort.value !== 'created_desc' ? { sort: sort.value } : {}),
}))

const query = computed(() => ({ page: page.value, ...filterParams.value }))

const { data, pending, refresh } = await useFetch('/api/admin/orders', { query })

// ── U-A2: bulk selection + status update ──────────────────────────────
const toast = useToast()
const searchEl = ref<HTMLInputElement>()
const selected = ref<string[]>([])
const bulkStatus = ref('')
const applying = ref(false)

// A new page or filter shows different rows — a stale selection would
// silently patch orders the admin no longer sees.
watch(query, () => { selected.value = [] })

const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((o: any) => selected.value.includes(o.orderNumber ?? ''))
)

function toggleRow(orderNumber: string) {
  if (!orderNumber) return
  selected.value = selected.value.includes(orderNumber)
    ? selected.value.filter((n) => n !== orderNumber)
    : [...selected.value, orderNumber]
}

function toggleAll() {
  selected.value = allSelected.value ? [] : rows.value.map((o: any) => o.orderNumber ?? '').filter(Boolean)
}

function clearSelection() {
  selected.value = []
  bulkStatus.value = ''
}

async function applyBulk() {
  if (!bulkStatus.value || !selected.value.length || applying.value) return
  // One click can rewrite a whole page of orders — name the count and the target first.
  const summary = `${t('admin.bulk_status')} : ${statusLabel(bulkStatus.value)} — ${t('admin.selected_count', { count: selected.value.length })}`
  if (!window.confirm(summary)) return
  applying.value = true
  let ok = 0
  let fail = 0
  for (const orderNumber of selected.value) {
    try {
      await $fetch(`/api/admin/orders/${orderNumber}`, { method: 'PATCH', body: { status: bulkStatus.value } })
      ok++
    } catch {
      fail++
    }
  }
  applying.value = false
  if (ok) toast.success(t('admin.bulk_done', { count: ok }))
  if (fail) toast.error(t('admin.bulk_failed', { count: fail }))
  clearSelection()
  await refresh()
}

// ── U-A2: keyboard shortcuts (/, N, P, Escape) ────────────────────────
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const typing = Boolean(
    target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)
  )
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'Escape') {
    if (typing) target?.blur()
    else if (selected.value.length) clearSelection()
    else resetFilters()
    return
  }
  if (typing) return
  if (e.key === '/') {
    e.preventDefault()
    searchEl.value?.focus()
  } else if (e.key.toLowerCase() === 'n' && page.value < totalPages.value) {
    page.value++
  } else if (e.key.toLowerCase() === 'p' && page.value > 1) {
    page.value--
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const hasActiveFilters = computed(
  () => Boolean(status.value || search.value || dateFrom.value || dateTo.value || payment.value)
)

const exportUrl = computed(() => {
  const params = new URLSearchParams(filterParams.value as Record<string, string>)
  const qs = params.toString()
  return `/api/admin/orders-export${qs ? `?${qs}` : ''}`
})

function resetFilters() {
  status.value = ''
  searchInput.value = ''
  search.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  payment.value = ''
  page.value = 1
}

function toggleSort(col: 'created' | 'total') {
  const desc = `${col}_desc`
  const asc = `${col}_asc`
  sort.value = sort.value === desc ? asc : desc
  page.value = 1
}

function sortIcon(col: 'created' | 'total') {
  if (sort.value === `${col}_asc`) return 'heroicons:chevron-up'
  if (sort.value === `${col}_desc`) return 'heroicons:chevron-down'
  return 'heroicons:chevron-up-down'
}

const rows = computed(() => data.value?.orders ?? [])
const totalPages = computed(() => data.value?.totalPages ?? 1)
const counts = computed<Record<string, number>>(() => data.value?.counts ?? {})

const statusChips = [
  { value: '', label: 'admin.chip_all' },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'paid', label: STATUS_LABELS.paid },
  { value: 'processing', label: STATUS_LABELS.processing },
  { value: 'shipped', label: STATUS_LABELS.shipped },
  { value: 'delivered', label: STATUS_LABELS.delivered },
  { value: 'cancelled', label: STATUS_LABELS.cancelled },
]

const statusLabel = (s: string) => (STATUS_LABELS[s] ? t(STATUS_LABELS[s]) : s)
const statusClass = (s: string) => STATUS_CLASSES[s] ?? 'bg-surface-2 text-on-surface-muted'

function formatDate(d: string | Date) {
  return formatDateTime(d)
}
function formatPrice(n: number) {
  return n.toLocaleString(locale.value, { style: 'currency', currency: 'EUR' })
}
</script>
