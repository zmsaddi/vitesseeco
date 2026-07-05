<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 class="text-2xl font-display font-bold">Commandes</h1>
      <div class="relative w-full sm:w-72">
        <Icon name="heroicons:magnifying-glass" class="w-5 h-5 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none" />
        <input
          v-model="searchInput"
          type="search"
          placeholder="N° commande, nom ou email…"
          class="w-full bg-surface border border-surface-2 rounded-lg ps-10 pe-3 py-2.5 text-sm placeholder:text-on-surface-muted focus:outline-none focus:border-accent"
          aria-label="Rechercher une commande"
        >
      </div>
    </div>

    <!-- Status filter chips -->
    <div class="flex flex-wrap gap-2 mb-6">
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
        {{ chip.label }}
        <span v-if="counts[chip.value === '' ? 'all' : chip.value]" class="ms-1 text-xs opacity-75">
          {{ counts[chip.value === '' ? 'all' : chip.value] }}
        </span>
      </button>
    </div>

    <!-- Table -->
    <div class="bg-surface border border-surface-2 rounded-xl overflow-hidden">
      <div v-if="pending" class="p-6 space-y-3">
        <div v-for="i in 5" :key="i" class="h-12 bg-surface-2 rounded animate-pulse" />
      </div>

      <div v-else-if="!rows.length" class="p-12 text-center text-on-surface-muted">
        <Icon name="heroicons:inbox" class="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p v-if="searchInput || status">Aucune commande ne correspond à ces critères.</p>
        <p v-else>Aucune commande pour le moment.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-start text-on-surface-muted border-b border-surface-2">
              <th class="text-start font-medium px-4 py-3">Commande</th>
              <th class="text-start font-medium px-4 py-3">Client</th>
              <th class="text-start font-medium px-4 py-3 hidden lg:table-cell">Date</th>
              <th class="text-start font-medium px-4 py-3 hidden sm:table-cell">Articles</th>
              <th class="text-start font-medium px-4 py-3">Total</th>
              <th class="text-start font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in rows"
              :key="order.orderNumber ?? ''"
              class="border-b border-surface-2 last:border-0 hover:bg-surface-2/50 cursor-pointer transition-colors duration-200"
              @click="navigateTo(`/admin/commandes/${order.orderNumber}`)"
            >
              <td class="px-4 py-3.5">
                <NuxtLink :to="`/admin/commandes/${order.orderNumber}`" class="font-mono font-semibold text-accent" @click.stop>
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
        Précédent
      </button>
      <span class="text-on-surface-muted">Page {{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        class="rounded-lg border border-surface-2 bg-surface px-4 py-2 disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="page++"
      >
        Suivant
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STATUS_LABELS, STATUS_CLASSES } from '~/utils/adminOrderStatus'

definePageMeta({ middleware: 'admin', layout: 'admin' })
useHead({ title: 'Commandes — Admin Vitesse Eco' })

const page = ref(1)
const status = ref('')
const search = ref('')
const searchInput = ref('')

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

const query = computed(() => ({
  page: page.value,
  ...(status.value ? { status: status.value } : {}),
  ...(search.value ? { q: search.value } : {}),
}))

const { data, pending } = await useFetch('/api/admin/orders', { query })

const rows = computed(() => data.value?.orders ?? [])
const totalPages = computed(() => data.value?.totalPages ?? 1)
const counts = computed<Record<string, number>>(() => data.value?.counts ?? {})

const statusChips = [
  { value: '', label: 'Toutes' },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'paid', label: STATUS_LABELS.paid },
  { value: 'processing', label: STATUS_LABELS.processing },
  { value: 'shipped', label: STATUS_LABELS.shipped },
  { value: 'delivered', label: STATUS_LABELS.delivered },
  { value: 'cancelled', label: STATUS_LABELS.cancelled },
]

const statusLabel = (s: string) => STATUS_LABELS[s] ?? s
const statusClass = (s: string) => STATUS_CLASSES[s] ?? 'bg-surface-2 text-on-surface-muted'

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatPrice(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}
</script>
