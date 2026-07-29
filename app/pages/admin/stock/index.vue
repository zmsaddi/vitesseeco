<script setup lang="ts">
/**
 * Catalogue: price and stock in one place.
 *
 * Each field saves on blur, on its own, so a mistyped price cannot take a
 * stock correction down with it. Nothing saves while you are still typing —
 * a keystroke-by-keystroke save would write 9, then 95, then 950.
 *
 * Stock is set as an absolute count, never a delta: two people counting the
 * same rack must not compound each other's edit. Live reservations are left
 * alone, so a checkout in flight keeps its hold.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()

interface CatalogueRow {
  id: string
  slug: string
  name: string
  color: string | null
  image: string | null
  price: number
  compareAtPrice: number | null
  isAvailable: boolean
  onHand: number
  reserved: number
  available: number
}

const search = ref('')
const lowStockOnly = ref(false)

const { data, refresh, status: loadState } = await useFetch<{ items: CatalogueRow[]; total: number }>(
  '/api/admin/products',
  {
    query: computed(() => ({
      ...(search.value ? { search: search.value } : {}),
      ...(lowStockOnly.value ? { lowStockOnly: true } : {}),
    })),
  }
)

const saving = ref<string | null>(null)
const saved = ref<string | null>(null)
const error = ref<string | null>(null)

function flashSaved(key: string): void {
  saved.value = key
  setTimeout(() => {
    if (saved.value === key) saved.value = null
  }, 2000)
}

async function savePrice(row: CatalogueRow, raw: string): Promise<void> {
  const price = Number(raw)
  if (!Number.isFinite(price) || price < 0 || price === row.price) return

  saving.value = `${row.id}:price`
  error.value = null
  try {
    await $fetch(`/api/admin/products/${row.id}`, { method: 'PATCH', body: { price } })
    flashSaved(`${row.id}:price`)
    await refresh()
  } catch (err: unknown) {
    const payload = (err as { data?: { messageKey?: string } })?.data
    error.value = payload?.messageKey ? t(payload.messageKey) : t('errors.internal')
    await refresh()
  } finally {
    saving.value = null
  }
}

async function saveStock(row: CatalogueRow, raw: string): Promise<void> {
  const onHand = Number(raw)
  if (!Number.isInteger(onHand) || onHand < 0 || onHand === row.onHand) return

  saving.value = `${row.id}:stock`
  error.value = null
  try {
    await $fetch('/api/admin/stock', {
      method: 'PATCH',
      body: { productId: row.id, onHand },
    })
    flashSaved(`${row.id}:stock`)
    await refresh()
  } catch (err: unknown) {
    const payload = (err as { data?: { messageKey?: string } })?.data
    error.value = payload?.messageKey ? t(payload.messageKey) : t('errors.internal')
    await refresh()
  } finally {
    saving.value = null
  }
}

async function toggleAvailability(row: CatalogueRow): Promise<void> {
  saving.value = `${row.id}:available`
  try {
    await $fetch(`/api/admin/products/${row.id}`, {
      method: 'PATCH',
      body: { isAvailable: !row.isAvailable },
    })
    await refresh()
  } finally {
    saving.value = null
  }
}

useSeoMeta({ title: () => t('admin.catalogue'), robots: 'noindex' })
</script>

<template>
  <div class="container-page">
    <h1 class="font-display text-2xl font-extrabold text-content-strong">{{ $t('admin.catalogue') }}</h1>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        class="field w-auto flex-1 min-w-52"
        :placeholder="$t('admin.search_products')"
      />
      <label class="flex min-h-11 items-center gap-2 text-sm text-content">
        <input v-model="lowStockOnly" type="checkbox" class="accent-accent" />
        {{ $t('admin.low_stock_only') }}
      </label>
    </div>

    <p v-if="error" role="alert" class="mt-4 text-sm text-danger">{{ error }}</p>
    <p v-if="loadState === 'pending'" class="mt-6 text-content-muted">{{ $t('common.loading') }}</p>

    <div v-else-if="data?.items?.length" class="mt-6 overflow-x-auto">
      <table class="w-full min-w-[46rem] border-separate border-spacing-y-2">
        <thead>
          <tr class="text-start text-xs uppercase tracking-wide text-content-muted">
            <th class="px-3 text-start font-semibold">{{ $t('admin.product') }}</th>
            <th class="px-3 text-start font-semibold">{{ $t('admin.price') }}</th>
            <th class="px-3 text-start font-semibold">{{ $t('admin.on_hand') }}</th>
            <th class="px-3 text-start font-semibold">{{ $t('admin.reserved') }}</th>
            <th class="px-3 text-start font-semibold">{{ $t('admin.sellable') }}</th>
            <th class="px-3 text-start font-semibold">{{ $t('admin.published') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.items" :key="row.id" class="bg-surface-raised">
            <td class="rounded-s-xl border-y border-s border-surface-border p-3">
              <div class="flex items-center gap-3">
                <NuxtImg
                  v-if="row.image"
                  :src="row.image"
                  :alt="row.name"
                  width="40"
                  height="40"
                  class="h-10 w-10 rounded-lg object-cover"
                />
                <div class="min-w-0">
                  <p class="truncate font-medium text-content-strong">{{ row.name }}</p>
                  <p v-if="row.color" class="text-xs text-content-muted">{{ row.color }}</p>
                </div>
              </div>
            </td>

            <td class="border-y border-surface-border p-3">
              <div class="flex items-center gap-2">
                <!-- Saved on blur, not on keystroke: typing 950 would otherwise
                     write 9, then 95, then 950. -->
                <input
                  :value="row.price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="field h-10 w-28"
                  :disabled="saving === `${row.id}:price`"
                  @blur="savePrice(row, ($event.target as HTMLInputElement).value)"
                  @keyup.enter="($event.target as HTMLInputElement).blur()"
                />
                <span class="text-sm text-content-muted">€</span>
                <Icon
                  v-if="saved === `${row.id}:price`"
                  name="ph:check-circle-fill"
                  class="h-5 w-5 text-success"
                />
              </div>
            </td>

            <td class="border-y border-surface-border p-3">
              <div class="flex items-center gap-2">
                <input
                  :value="row.onHand"
                  type="number"
                  min="0"
                  step="1"
                  class="field h-10 w-24"
                  :disabled="saving === `${row.id}:stock`"
                  @blur="saveStock(row, ($event.target as HTMLInputElement).value)"
                  @keyup.enter="($event.target as HTMLInputElement).blur()"
                />
                <Icon
                  v-if="saved === `${row.id}:stock`"
                  name="ph:check-circle-fill"
                  class="h-5 w-5 text-success"
                />
              </div>
            </td>

            <td class="border-y border-surface-border p-3 text-content-muted">{{ row.reserved }}</td>

            <td class="border-y border-surface-border p-3">
              <span
                class="rounded-full px-2.5 py-0.5 text-sm font-semibold"
                :class="row.available > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'"
              >{{ row.available }}</span>
            </td>

            <td class="rounded-e-xl border-y border-e border-surface-border p-3">
              <button
                type="button"
                class="btn-secondary h-9 px-3 text-xs"
                :disabled="saving === `${row.id}:available`"
                @click="toggleAvailability(row)"
              >
                {{ row.isAvailable ? $t('admin.published_yes') : $t('admin.published_no') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="mt-6 text-content-muted">{{ $t('admin.no_products') }}</p>
  </div>
</template>
