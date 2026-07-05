<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4 mb-2">
      <h1 class="text-2xl font-display font-bold">{{ $t('admin.nav_stock') }}</h1>
      <div class="relative w-full sm:w-72">
        <Icon name="heroicons:magnifying-glass" class="w-5 h-5 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none" />
        <input
          v-model="search"
          type="search"
          :placeholder="$t('admin.stock_search')"
          class="w-full bg-surface border border-surface-2 rounded-lg ps-10 pe-3 py-2.5 text-sm placeholder:text-on-surface-muted focus:outline-none focus:border-accent"
          :aria-label="$t('admin.stock_search')"
        >
      </div>
    </div>
    <p class="text-sm text-on-surface-muted mb-6">
      {{ $t('admin.stock_hint') }}
    </p>

    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="f in filters"
        :key="f.value"
        type="button"
        class="rounded-full px-3.5 py-1.5 text-sm border transition-colors duration-200"
        :class="filter === f.value
          ? 'bg-accent/10 border-accent text-accent font-semibold'
          : 'bg-surface border-surface-2 text-on-surface-muted hover:text-on-surface'"
        @click="filter = f.value"
      >
        {{ $t(f.label) }}<span v-if="f.count !== null" class="ms-1 text-xs opacity-75">{{ f.count }}</span>
      </button>
    </div>

    <div class="bg-surface border border-surface-2 rounded-xl overflow-hidden">
      <div v-if="pending" class="p-6 space-y-3">
        <div v-for="i in 8" :key="i" class="h-10 bg-surface-2 rounded animate-pulse" />
      </div>

      <div v-else-if="!filtered.length" class="p-12 text-center text-on-surface-muted">
        <Icon name="heroicons:cube-transparent" class="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p>{{ $t('admin.stock_empty') }}</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-on-surface-muted border-b border-surface-2">
              <th class="text-start font-medium px-4 py-3">{{ $t('admin.th_product') }}</th>
              <th class="text-start font-medium px-4 py-3 hidden md:table-cell">SKU</th>
              <th class="text-start font-medium px-4 py-3 hidden sm:table-cell">{{ $t('admin.th_price') }}</th>
              <th class="text-start font-medium px-4 py-3 w-44">{{ $t('admin.th_stock') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filtered" :key="p.productId" class="border-b border-surface-2 last:border-0">
              <td class="px-4 py-3">
                <div class="font-medium" :class="{ 'opacity-50': !p.isAvailable }">{{ p.name }}</div>
                <div v-if="!p.isAvailable" class="text-xs text-on-surface-muted">{{ $t('admin.unavailable') }}</div>
              </td>
              <td class="px-4 py-3 font-mono text-on-surface-muted hidden md:table-cell">{{ p.sku }}</td>
              <td class="px-4 py-3 hidden sm:table-cell whitespace-nowrap">{{ p.price !== null ? formatPrice(p.price) : '—' }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="edits[p.productId]"
                    type="number"
                    min="0"
                    max="1000000"
                    class="w-20 bg-bg border rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:border-accent"
                    :class="stockInputClass(p)"
                    :aria-label="`Stock de ${p.name}`"
                  >
                  <button
                    v-if="isDirty(p)"
                    type="button"
                    class="rounded-lg bg-accent text-primary px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    :disabled="savingId === p.productId"
                    @click="save(p)"
                  >
                    {{ $t('admin.ok') }}
                  </button>
                  <span v-else-if="!p.tracked" class="text-[10px] uppercase text-on-surface-muted" :title="$t('admin.untracked_tip')">
                    {{ $t('admin.untracked_label') }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

const { t, locale } = useI18n()
useHead({ title: computed(() => `${t('admin.nav_stock')} — Admin Vitesse Eco`) })

const toast = useToast()
const { data, pending, refresh } = await useFetch('/api/admin/stock')

const search = ref('')
const filter = ref<'all' | 'low' | 'untracked'>('all')
const savingId = ref<string | null>(null)

/** Local edit buffer: productId → input value. Seeded from server data. */
const edits = reactive<Record<string, number>>({})

const products = computed<any[]>(() => data.value?.products ?? [])

watch(
  products,
  (list) => {
    for (const p of list) {
      if (!(p.productId in edits)) {
        // Untracked products default to the current Sanity value so "activate
        // tracking" is one click away without retyping.
        edits[p.productId] = p.stock ?? p.sanityStock ?? 0
      }
    }
  },
  { immediate: true }
)

const lowCount = computed(() => products.value.filter((p) => p.tracked && p.stock <= 3).length)
const untrackedCount = computed(() => products.value.filter((p) => !p.tracked).length)

const filters = computed(() => [
  { value: 'all' as const, label: 'admin.stock_all', count: products.value.length || null },
  { value: 'low' as const, label: 'admin.stock_low', count: lowCount.value || null },
  { value: 'untracked' as const, label: 'admin.stock_untracked', count: untrackedCount.value || null },
])

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return products.value.filter((p) => {
    if (filter.value === 'low' && !(p.tracked && p.stock <= 3)) return false
    if (filter.value === 'untracked' && p.tracked) return false
    if (q && !`${p.name} ${p.sku}`.toLowerCase().includes(q)) return false
    return true
  })
})

function isDirty(p: any) {
  const current = p.tracked ? p.stock : null
  return Number.isInteger(edits[p.productId]) && edits[p.productId] !== current
}

function stockInputClass(p: any) {
  const v = edits[p.productId]
  if (v === 0) return 'border-danger text-danger'
  if (v <= 3) return 'border-warning text-warning'
  return 'border-surface-2'
}

async function save(p: any) {
  const stock = edits[p.productId]
  if (!Number.isInteger(stock) || stock < 0) {
    toast.error(t('admin.invalid_stock'))
    return
  }
  savingId.value = p.productId
  try {
    await $fetch(`/api/admin/stock/${p.productId}`, { method: 'PATCH', body: { stock, sku: p.sku } })
    await refresh()
    toast.success(t('admin.stock_saved', { name: p.name, n: stock }))
  } catch (e: any) {
    toast.error(e?.data?.message || t('admin.update_failed'))
  } finally {
    savingId.value = null
  }
}

function formatPrice(n: number) {
  return n.toLocaleString(locale.value, { style: 'currency', currency: 'EUR' })
}
</script>
