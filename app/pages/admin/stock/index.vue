<script setup lang="ts">
/**
 * Catalogue: price and stock in one place.
 *
 * Each field saves on blur, on its own, so a mistyped price cannot take a stock
 * correction down with it. Nothing saves while you are still typing — a
 * keystroke-by-keystroke save would write 9, then 95, then 950.
 *
 * Stock is set as an absolute count, never a delta: two people counting the same
 * rack must not compound each other's edit. Live reservations are left alone, so
 * a checkout in flight keeps its hold.
 *
 * Picking a market adds that market's price beside the base one. A market price
 * shown in plain text is the catalogue-wide rule doing its work and will follow
 * the base price; once it is typed in it is pinned, and re-pricing everything
 * else later leaves it where it is. The 🔗 button gives it back to the rule.
 */
import { parseAmountInput } from '~~/shared/money'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
// The two bare "€" glyphs beside the price inputs stay: an input holds the raw
// editable number, and formatting a value someone is about to type over would
// fight them. Only rendered text goes through the formatter.
const { formatDecimal } = useFormatPrice()

interface MarketPrice {
  country: string
  price: number
  isOverride: boolean
  vatNeutral: number
}

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
  market: MarketPrice | null
}

const search = ref('')
const lowStockOnly = ref(false)
const market = ref('')

const { data, refresh, status: loadState } = await useFetch<{
  items: CatalogueRow[]
  total: number
  markets: string[]
}>('/api/admin/products', {
  query: computed(() => ({
    ...(search.value ? { search: search.value } : {}),
    ...(lowStockOnly.value ? { lowStockOnly: true } : {}),
    ...(market.value ? { market: market.value } : {}),
  })),
})

const saving = ref<string | null>(null)
const saved = ref<string | null>(null)
const error = ref<string | null>(null)

function flashSaved(key: string): void {
  saved.value = key
  setTimeout(() => {
    if (saved.value === key) saved.value = null
  }, 2000)
}

/** One place to talk to the server, so every edit reports failure the same way. */
async function save(key: string, request: () => Promise<unknown>): Promise<void> {
  saving.value = key
  error.value = null
  try {
    await request()
    flashSaved(key)
  } catch (err: unknown) {
    const payload = (err as { data?: { messageKey?: string } })?.data
    error.value = payload?.messageKey ? t(payload.messageKey) : t('errors.internal')
  } finally {
    saving.value = null
    // Refreshed even after a failure, so the table shows what is actually
    // stored rather than what was typed.
    await refresh()
  }
}

function savePrice(row: CatalogueRow, raw: string): void {
  const price = parseAmountInput(raw)
  if (price === null || price <= 0 || price === row.price) return
  void save(`${row.id}:price`, () =>
    $fetch<unknown>(`/api/admin/products/${row.id}`, { method: 'PATCH', body: { price } })
  )
}

function saveMarketPrice(row: CatalogueRow, raw: string): void {
  if (!row.market) return
  const price = parseAmountInput(raw)
  if (price === null || price <= 0 || price === row.market.price) return
  void save(`${row.id}:market`, () =>
    $fetch<unknown>(`/api/admin/products/${row.id}`, {
      method: 'PATCH',
      body: { marketPrice: { country: row.market!.country, price } },
    })
  )
}

/** Hand the market price back to the catalogue-wide rule. */
function clearMarketPrice(row: CatalogueRow): void {
  if (!row.market) return
  void save(`${row.id}:market`, () =>
    $fetch<unknown>(`/api/admin/products/${row.id}`, {
      method: 'PATCH',
      body: { marketPrice: { country: row.market!.country, price: null } },
    })
  )
}

function saveStock(row: CatalogueRow, raw: string): void {
  // Zero IS a meaningful stock level, so only a blank cell is ignored here.
  const onHand = parseAmountInput(raw)
  if (onHand === null || !Number.isInteger(onHand) || onHand < 0 || onHand === row.onHand) return
  void save(`${row.id}:stock`, () =>
    $fetch<unknown>('/api/admin/stock', { method: 'PATCH', body: { productId: row.id, onHand } })
  )
}

function toggleAvailability(row: CatalogueRow): void {
  void save(`${row.id}:available`, () =>
    $fetch<unknown>(`/api/admin/products/${row.id}`, {
      method: 'PATCH',
      body: { isAvailable: !row.isAvailable },
    })
  )
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
      <select v-model="market" class="field w-auto" :aria-label="$t('admin.market')">
        <option value="">{{ $t('admin.base_price_only') }}</option>
        <option v-for="code in data?.markets ?? []" :key="code" :value="code">
          {{ $t(`markets.${code}`) }}
        </option>
      </select>
      <label class="flex min-h-11 items-center gap-2 text-sm text-content">
        <input v-model="lowStockOnly" type="checkbox" class="accent-accent" />
        {{ $t('admin.low_stock_only') }}
      </label>
    </div>

    <p v-if="market" class="mt-3 text-sm text-content-muted">{{ $t('admin.market_price_hint') }}</p>

    <p v-if="error" role="alert" class="mt-4 text-sm text-danger">{{ error }}</p>
    <p v-if="loadState === 'pending'" class="mt-6 text-content-muted">{{ $t('common.loading') }}</p>

    <div v-else-if="data?.items?.length" class="mt-6 overflow-x-auto">
      <table class="w-full min-w-[52rem] border-separate border-spacing-y-2">
        <thead>
          <tr class="text-start text-xs uppercase tracking-wide text-content-muted">
            <th class="px-3 text-start font-semibold">{{ $t('admin.product') }}</th>
            <th class="px-3 text-start font-semibold">{{ $t('admin.price') }}</th>
            <th v-if="market" class="px-3 text-start font-semibold">{{ $t(`markets.${market}`) }}</th>
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
                  min="0.01"
                  step="0.01"
                  required
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

            <td v-if="market && row.market" class="border-y border-surface-border p-3">
              <div class="flex items-center gap-2">
                <input
                  :value="row.market.price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  class="field h-10 w-28"
                  :class="row.market.isOverride ? 'font-semibold' : 'text-content-muted'"
                  :title="`${$t('admin.vat_neutral')}: ${formatDecimal(row.market.vatNeutral)}`"
                  :disabled="saving === `${row.id}:market`"
                  @blur="saveMarketPrice(row, ($event.target as HTMLInputElement).value)"
                  @keyup.enter="($event.target as HTMLInputElement).blur()"
                />
                <span class="text-sm text-content-muted">€</span>
                <button
                  v-if="row.market.isOverride"
                  type="button"
                  class="text-content-muted transition hover:text-accent"
                  :title="$t('admin.follow_rule')"
                  :disabled="saving === `${row.id}:market`"
                  @click="clearMarketPrice(row)"
                >
                  <Icon name="ph:link-simple" class="h-5 w-5" />
                </button>
                <Icon
                  v-if="saved === `${row.id}:market`"
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
