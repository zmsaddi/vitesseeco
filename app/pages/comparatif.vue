<script setup lang="ts">
import type { Paginated, ProductDetail, ProductImage, ProductSummary } from '~~/server/catalog/types'

/**
 * Bike comparison.
 *
 * Every colour is a separate product in this catalogue, so a table built
 * straight from the listing puts six near-identical rows side by side and
 * answers nothing. Models are grouped by `modelFamily` and compared one row per
 * model, with the colours shown as dots inside the row — the table then answers
 * the question a buyer actually has, which is how two bikes differ, not how two
 * paint jobs differ.
 *
 * The selection lives in the URL query, so a comparison can be sent to whoever
 * is being consulted before the money is spent.
 */
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const { locale, t } = useI18n()

/** Two is the least a comparison can be; past four the columns stop being readable. */
const MIN_MODELS = 2
const MAX_MODELS = 4

/**
 * The listing caps a page at 48 and the catalogue holds more bikes than that, so
 * the picker is built from several pages. The ceiling is a stop, not a target:
 * every page costs a round trip on the server render.
 */
const PER_PAGE = 48
const MAX_PAGES = 4

/** One value, whatever shape the URL arrived in — a repeated ?modeles= gives an array. */
function one(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

/**
 * Every bike, not the first page of them.
 *
 * Grouping by model only works over the whole set: stopping at page one would
 * drop models out of the picker with nothing on screen to say they exist.
 */
const { data: bikes, status: bikesStatus } = await useAsyncData(
  'compare-bikes',
  async () => {
    const collected: ProductSummary[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await $fetch<Paginated<ProductSummary>>('/api/catalog/products', {
        query: { locale: locale.value, productType: 'bike', perPage: PER_PAGE, page },
      })
      collected.push(...result.items)
      if (page >= result.totalPages) break
    }
    return collected
  },
  { default: (): ProductSummary[] => [], watch: [locale] }
)

interface ColourOption {
  slug: string
  label: string
  hex: string | null
  available: number
}

interface ModelGroup {
  /** The product page that stands for the model. */
  slug: string
  name: string
  brand: string | null
  image: ProductImage | null
  minPrice: number
  maxPrice: number
  /** Summed across the colours: the model is buyable while any colour is. */
  available: number
  colours: ColourOption[]
  /** The colour names in one string, for the dots' screen-reader equivalent. */
  colourNames: string
}

/**
 * "V20 Pro — Noir" names a colour; a row of the table names a model. Dropping
 * the colour suffix is what stops four columns from reading as the same bike
 * with different words after the dash.
 */
function modelName(product: ProductSummary): string {
  const colour = product.color
  if (!colour) return product.name
  if (!product.name.toLowerCase().endsWith(colour.toLowerCase())) return product.name
  const trimmed = product.name
    .slice(0, product.name.length - colour.length)
    .replace(/[\s–—-]+$/u, '')
  return trimmed || product.name
}

const groups = computed<ModelGroup[]>(() => {
  const families = new Map<string, ProductSummary[]>()
  for (const product of bikes.value) {
    // A bike with no family is a model of one, not a bike to leave out.
    const key = product.modelFamily || product.slug
    const bucket = families.get(key)
    if (bucket) bucket.push(product)
    else families.set(key, [product])
  }

  const built: ModelGroup[] = []
  for (const colours of families.values()) {
    // Alphabetical by slug, so every colour of a family agrees which page
    // represents it — the same rule the product page uses to pick its canonical,
    // which keeps a shared comparison pointing at the URL Google indexed.
    const sorted = [...colours].sort((a, b) => a.slug.localeCompare(b.slug))
    const lead = sorted[0]
    if (!lead) continue
    const prices = sorted.map((colour) => colour.price)
    built.push({
      slug: lead.slug,
      name: modelName(lead),
      brand: lead.brand?.name ?? null,
      image: sorted.find((colour) => colour.image)?.image ?? null,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      available: sorted.reduce((sum, colour) => sum + Math.max(0, colour.available), 0),
      colours: sorted.map((colour) => ({
        slug: colour.slug,
        label: colour.color ?? colour.name,
        hex: colour.colorHex,
        available: colour.available,
      })),
      colourNames: sorted.map((colour) => colour.color ?? colour.name).join(', '),
    })
  }
  return built.sort((a, b) => a.name.localeCompare(b.name))
})

/** Any colour slug resolves to its model, so a pasted product link still works. */
const groupBySlug = computed(() => {
  const index = new Map<string, ModelGroup>()
  for (const group of groups.value) {
    for (const colour of group.colours) index.set(colour.slug, group)
  }
  return index
})

const selected = computed<ModelGroup[]>(() => {
  const seen = new Set<string>()
  const chosen: ModelGroup[] = []
  for (const raw of one(route.query.modeles).split(',')) {
    const group = groupBySlug.value.get(raw.trim().toLowerCase())
    // A model withdrawn since the link was shared drops out quietly; the rest of
    // the comparison is still worth showing.
    if (!group || seen.has(group.slug)) continue
    seen.add(group.slug)
    chosen.push(group)
    if (chosen.length === MAX_MODELS) break
  }
  return chosen
})

const selectedSlugs = computed(() => selected.value.map((group) => group.slug))
const isFull = computed(() => selected.value.length >= MAX_MODELS)

function isSelected(group: ModelGroup): boolean {
  return selectedSlugs.value.includes(group.slug)
}

function writeSelection(slugs: string[]): void {
  router.push({ query: slugs.length ? { modeles: slugs.join(',') } : {} })
}

function toggle(group: ModelGroup): void {
  const current = [...selectedSlugs.value]
  const index = current.indexOf(group.slug)
  if (index >= 0) current.splice(index, 1)
  else if (current.length >= MAX_MODELS) return
  else current.push(group.slug)
  writeSelection(current)
}

/**
 * Specifications live on the detail document, not on the listing summary, so the
 * chosen models are fetched individually. Keyed on the joined slugs rather than
 * on the group objects: the groups are rebuilt whenever the catalogue refreshes,
 * and watching them would refetch the same four bikes for no reason.
 */
const comparisonKey = computed(() => selectedSlugs.value.join(','))

const { data: details, status: detailStatus } = await useAsyncData(
  'compare-details',
  async () => {
    const slugs = selectedSlugs.value
    if (slugs.length < MIN_MODELS) return []
    const fetched = await Promise.all(
      slugs.map((slug) =>
        $fetch<ProductDetail>(`/api/catalog/products/${slug}`, {
          query: { locale: locale.value },
        }).catch(() => null)
      )
    )
    return fetched.filter((detail): detail is ProductDetail => detail !== null)
  },
  { default: (): ProductDetail[] => [], watch: [comparisonKey, locale] }
)

interface Column {
  group: ModelGroup
  detail: ProductDetail
}

const columns = computed<Column[]>(() => {
  const bySlug = new Map(details.value.map((detail) => [detail.slug, detail]))
  const built: Column[] = []
  for (const group of selected.value) {
    const detail = bySlug.get(group.slug)
    if (detail) built.push({ group, detail })
  }
  return built
})

type SpecKey = 'motor' | 'battery' | 'range' | 'brakes' | 'max_speed' | 'weight' | 'tyres'
type Better = 'higher' | 'lower'

/**
 * "45 - 60 km" is one figure to compare, not two.
 *
 * The upper end is the number every brochure quotes, so taking the largest keeps
 * two bikes comparable even when one manufacturer writes a range and the other
 * writes a single value — otherwise the winner is decided by how the text was
 * typed rather than by how far the bike goes.
 */
function bestNumberIn(value: string | null): number | null {
  if (!value) return null
  const found = value.match(/\d+(?:[.,]\d+)?/g)
  if (!found) return null
  const numbers = found
    .map((entry) => Number.parseFloat(entry.replace(',', '.')))
    .filter((entry) => Number.isFinite(entry))
  return numbers.length ? Math.max(...numbers) : null
}

/**
 * Only two rows carry a verdict, and both are arithmetic: more kilometres on a
 * charge is more kilometres, and a lighter bike is easier to lift onto a rack.
 *
 * Motor wattage, battery capacity and top speed are deliberately left unmarked.
 * A bigger motor is not better on a bike that must stay inside the 250 W / 25
 * km/h pedelec limit to be ridden without registration or insurance, and a
 * bigger battery buys range with weight and price. Calling any of those "best"
 * would be selling, not comparing.
 */
interface SpecDefinition {
  key: SpecKey
  read: (detail: ProductDetail) => string | null
  score?: (detail: ProductDetail) => number | null
  better?: Better
}

const specDefinitions = computed<SpecDefinition[]>(() => [
  { key: 'motor', read: (detail) => detail.specifications.motor },
  { key: 'battery', read: (detail) => detail.specifications.battery },
  {
    key: 'range',
    read: (detail) => detail.specifications.range,
    score: (detail) => bestNumberIn(detail.specifications.range),
    better: 'higher',
  },
  { key: 'brakes', read: (detail) => detail.specifications.brakeType },
  {
    key: 'max_speed',
    read: (detail) =>
      detail.specifications.maxSpeed === null
        ? null
        : t('compare.unit_kmh', { value: detail.specifications.maxSpeed }),
  },
  {
    key: 'weight',
    read: (detail) =>
      detail.specifications.weight === null
        ? null
        : t('compare.unit_kg', { value: detail.specifications.weight }),
    score: (detail) => detail.specifications.weight,
    better: 'lower',
  },
  { key: 'tyres', read: (detail) => detail.specifications.tireSize },
])

/** Written as literal keys so the locale gate can see every one of them. */
const specLabels = computed<Record<SpecKey, string>>(() => ({
  motor: t('compare.spec_motor'),
  battery: t('compare.spec_battery'),
  range: t('compare.spec_range'),
  brakes: t('compare.spec_brakes'),
  max_speed: t('compare.spec_max_speed'),
  weight: t('compare.spec_weight'),
  tyres: t('compare.spec_tyres'),
}))

/**
 * Which columns win a row.
 *
 * Nothing is marked unless at least two models state a figure and they are not
 * all equal: a badge on every column is decoration, and a badge on the only
 * model that filled the field in is not a comparison.
 */
function bestPositions(scores: Array<number | null>, better: Better): Set<number> {
  const known = scores.filter((score): score is number => score !== null)
  if (known.length < MIN_MODELS) return new Set()
  const target = better === 'higher' ? Math.max(...known) : Math.min(...known)
  if (known.every((score) => score === target)) return new Set()
  const winners = new Set<number>()
  scores.forEach((score, index) => {
    if (score === target) winners.add(index)
  })
  return winners
}

interface SpecRow {
  key: SpecKey
  label: string
  hint: string | null
  cells: Array<{ value: string | null; best: boolean }>
}

const rows = computed<SpecRow[]>(() => {
  const built: SpecRow[] = []
  for (const spec of specDefinitions.value) {
    const values = columns.value.map((column) => spec.read(column.detail))
    // A row nobody filled in tells the buyer nothing; dropping it keeps the
    // table to the lines that actually separate these bikes.
    if (values.every((value) => !value)) continue

    const scores = columns.value.map((column) => (spec.score ? spec.score(column.detail) : null))
    const winners = spec.better ? bestPositions(scores, spec.better) : new Set<number>()

    built.push({
      key: spec.key,
      label: specLabels.value[spec.key],
      hint: spec.better
        ? spec.better === 'higher'
          ? t('compare.better_higher')
          : t('compare.better_lower')
        : null,
      cells: values.map((value, index) => ({ value, best: winners.has(index) })),
    })
  }
  return built
})

const filter = ref('')
const visibleGroups = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  if (!needle) return groups.value
  return groups.value.filter((group) =>
    `${group.name} ${group.brand ?? ''}`.toLowerCase().includes(needle)
  )
})

function euros(value: number): string {
  return (value / 100).toFixed(2)
}

useSeoMeta({
  title: () => t('compare.title'),
  description: () => t('compare.description'),
})
</script>

<template>
  <div class="container-page py-10">
    <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('compare.title') }}</h1>
    <p class="mt-3 max-w-2xl text-content-muted">{{ $t('compare.lead') }}</p>

    <section class="mt-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <label class="min-w-56 flex-1">
          <span class="sr-only">{{ $t('compare.search') }}</span>
          <input v-model="filter" type="search" class="field" :placeholder="$t('compare.search')" />
        </label>
        <div class="flex items-center gap-3">
          <p class="text-sm text-content-muted">
            {{ $t('compare.selected_count', { count: selected.length, max: MAX_MODELS }) }}
          </p>
          <button
            v-if="selected.length"
            type="button"
            class="btn-secondary"
            @click="writeSelection([])"
          >
            {{ $t('compare.clear') }}
          </button>
        </div>
      </div>

      <p v-if="isFull" class="mt-3 text-sm text-content-muted">{{ $t('compare.max_reached') }}</p>

      <p v-if="bikesStatus === 'pending'" class="mt-6 text-content-muted">{{ $t('common.loading') }}</p>
      <p v-else-if="!visibleGroups.length" class="mt-6 text-content-muted">
        {{ $t('products.no_results') }}
      </p>

      <ul v-else class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="group in visibleGroups" :key="group.slug">
          <button
            type="button"
            class="card flex w-full items-center gap-3 p-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="isSelected(group) ? 'border-accent bg-accent-subtle' : 'hover:bg-surface-sunken'"
            :aria-pressed="isSelected(group)"
            :disabled="!isSelected(group) && isFull"
            @click="toggle(group)"
          >
            <NuxtImg
              v-if="group.image"
              :src="group.image.url"
              :alt="group.image.alt"
              width="64"
              height="64"
              loading="lazy"
              class="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-content-strong">{{ group.name }}</span>
              <span v-if="group.brand" class="block truncate text-xs text-content-muted">
                {{ group.brand }}
              </span>
              <span class="mt-1 block text-sm font-semibold text-accent">
                {{ group.minPrice === group.maxPrice
                  ? `${euros(group.minPrice)} €`
                  : $t('compare.from_price', { price: euros(group.minPrice) }) }}
              </span>
              <!-- The dots are what turn six catalogue entries back into one
                   bike: the model is the choice, the colour comes after. -->
              <span class="mt-1.5 flex flex-wrap items-center gap-1">
                <span
                  v-for="colour in group.colours"
                  :key="colour.slug"
                  class="block h-3 w-3 rounded-full border border-surface-border"
                  :class="[colour.hex ? '' : 'bg-surface-sunken', colour.available > 0 ? '' : 'opacity-40']"
                  :style="colour.hex ? { backgroundColor: colour.hex } : undefined"
                  aria-hidden="true"
                />
                <span class="sr-only">{{ $t('compare.colour_list', { list: group.colourNames }) }}</span>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <p v-if="selected.length < MIN_MODELS" class="mt-10 text-content-muted">
      {{ $t('compare.need_two') }}
    </p>

    <p v-else-if="detailStatus === 'pending'" class="mt-10 text-content-muted">
      {{ $t('common.loading') }}
    </p>

    <section v-else-if="columns.length >= MIN_MODELS" class="mt-10">
      <!-- The table is wider than a phone and must scroll inside itself: a page
           that scrolls sideways takes the header and the buttons with it.
           Separated borders rather than collapsed ones, because a collapsed
           border belongs to the table and scrolls out from under the sticky
           first column, leaving the row lines broken. -->
      <div class="overflow-x-auto">
        <table class="w-full border-separate border-spacing-0 text-sm">
          <caption class="sr-only">{{ $t('compare.table_caption') }}</caption>

          <thead>
            <tr>
              <th scope="col" class="sticky start-0 z-10 w-40 bg-surface px-2 py-3 text-start align-bottom">
                <span class="text-xs font-semibold uppercase tracking-wide text-content-muted">
                  {{ $t('compare.specification') }}
                </span>
              </th>
              <th
                v-for="column in columns"
                :key="column.group.slug"
                scope="col"
                class="min-w-56 px-2 py-3 text-start align-bottom font-normal"
              >
                <NuxtImg
                  v-if="column.group.image"
                  :src="column.group.image.url"
                  :alt="column.group.image.alt"
                  width="240"
                  height="240"
                  class="aspect-square w-full rounded-xl bg-surface-sunken object-cover"
                />
                <p v-if="column.group.brand" class="mt-2 text-xs text-content-muted">
                  {{ column.group.brand }}
                </p>
                <p class="font-display text-base font-bold text-content-strong">{{ column.group.name }}</p>
                <p class="mt-1 font-semibold text-accent">
                  {{ column.group.minPrice === column.group.maxPrice
                    ? `${euros(column.group.minPrice)} €`
                    : $t('compare.from_price', { price: euros(column.group.minPrice) }) }}
                </p>
                <p class="mt-1 text-xs" :class="column.group.available > 0 ? 'text-success' : 'text-danger'">
                  {{ column.group.available > 0
                    ? $t('product.in_stock', { count: column.group.available })
                    : $t('products.out_of_stock') }}
                </p>

                <p class="mt-3 text-xs text-content-muted">{{ $t('compare.colours') }}</p>
                <ul class="mt-1 flex flex-wrap items-center gap-1.5">
                  <li v-for="colour in column.group.colours" :key="colour.slug">
                    <!-- Dimmed when that colour is sold out, so the dots say what
                         can be bought today rather than what was ever made. -->
                    <span
                      class="block h-4 w-4 rounded-full border border-surface-border"
                      :class="[colour.hex ? '' : 'bg-surface-sunken', colour.available > 0 ? '' : 'opacity-40']"
                      :style="colour.hex ? { backgroundColor: colour.hex } : undefined"
                      aria-hidden="true"
                    />
                    <span class="sr-only">
                      {{ colour.label }}
                      <template v-if="colour.available <= 0">— {{ $t('products.out_of_stock') }}</template>
                    </span>
                  </li>
                </ul>

                <div class="mt-3 flex flex-wrap gap-2">
                  <NuxtLink
                    :to="localePath(`/produits/${column.group.slug}`)"
                    class="btn-secondary px-3 text-xs"
                  >
                    {{ $t('compare.view_product') }}
                  </NuxtLink>
                  <button
                    type="button"
                    class="btn-secondary px-3 text-xs"
                    @click="toggle(column.group)"
                  >
                    {{ $t('compare.remove') }}
                  </button>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <th
                scope="row"
                class="sticky start-0 z-10 border-t border-surface-border bg-surface px-2 py-3 text-start align-top"
              >
                <span class="font-medium text-content-strong">{{ row.label }}</span>
                <span v-if="row.hint" class="mt-0.5 block text-xs font-normal text-content-muted">
                  {{ row.hint }}
                </span>
              </th>
              <td
                v-for="(cell, index) in row.cells"
                :key="index"
                class="border-t border-surface-border px-2 py-3 align-top"
              >
                <span
                  v-if="cell.value"
                  class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
                  :class="cell.best ? 'bg-success-subtle font-semibold text-success' : 'text-content'"
                >
                  <Icon v-if="cell.best" name="ph:check-circle" class="h-4 w-4 shrink-0" />
                  {{ cell.value }}
                  <span v-if="cell.best" class="sr-only">{{ $t('compare.best') }}</span>
                </span>
                <span v-else class="inline-block px-2 py-1 text-content-muted">
                  {{ $t('compare.unknown') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mt-6 max-w-3xl text-sm text-content-muted">{{ $t('compare.objective_note') }}</p>
      <p class="mt-2 max-w-3xl text-sm text-content-muted">{{ $t('compare.grouping_note') }}</p>
    </section>

    <!-- Reached when a shared link names models that no longer resolve, so the
         visitor is told rather than left watching a spinner that never ends. -->
    <p v-else class="mt-10 text-content-muted">{{ $t('compare.unavailable') }}</p>
  </div>
</template>
