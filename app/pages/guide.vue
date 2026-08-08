<script setup lang="ts">
import type { Paginated, ProductDetail, ProductSummary } from '~~/server/catalog/types'

/**
 * Which fatbike should I buy.
 *
 * Three questions, then a recommendation that carries its reason. The reason is
 * the whole point: a row of products with no explanation is a carousel, and a
 * first-time buyer has no way to tell a considered suggestion from a promoted
 * one. Every clause under a bike below comes from a field on that bike, so the
 * page cannot praise something the catalogue does not say.
 *
 * The answers live in the URL. A result can therefore be sent to whoever is
 * actually paying, and the back button walks back through the questions instead
 * of leaving the page.
 */
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const { locale, t } = useI18n()
const { formatCents } = useFormatPrice()

/**
 * One value, whatever shape the URL arrived in — a duplicated parameter
 * (?usage=a&usage=b) makes route.query an array, and calling a string method on
 * it is a 500 during server rendering. Same guard as the listing page.
 */
function one(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

const USAGE_OPTIONS = [
  { value: 'trajet', label: 'guide.usage_commute', hint: 'guide.usage_commute_hint' },
  { value: 'loisir', label: 'guide.usage_leisure', hint: 'guide.usage_leisure_hint' },
  { value: 'charge', label: 'guide.usage_cargo', hint: 'guide.usage_cargo_hint' },
] as const

/**
 * What we require of the battery, per answer.
 *
 * Two options, split at 50 km — the owner's own reading of the catalogue. The
 * long option asks for 65 rather than 51: someone who rides past fifty needs
 * headroom for the day they ride further, and a bike that matches their stated
 * distance exactly has none.
 */
const DISTANCE_OPTIONS = [
  { value: 'court', label: 'guide.distance_short', needKm: 50 },
  { value: 'long', label: 'guide.distance_long', needKm: 65 },
] as const

/**
 * Two options, split where the catalogue actually splits: 25 bikes sit under
 * 1 000 € and 34 at or above it. The previous brackets (1 500 / 2 500 / 3 500)
 * were invented — the 2 500 step added two bikes and the 3 500 step added
 * none, so two of three answers changed nothing a customer could see.
 *
 * Under 1 000 € is a ceiling. 1 000 € and above is a FLOOR — someone choosing
 * the upper range is asking for the bigger bikes, not for the cheap ones with
 * extra steps.
 */
const BUDGET_OPTIONS = [
  { value: 'moins1000', label: 'guide.budget_under_1000', ceiling: 100_000, floor: null },
  { value: 'plus1000', label: 'guide.budget_1000_plus', ceiling: null, floor: 100_000 },
] as const

function optionValue<T extends string>(raw: string, allowed: readonly { value: T }[]): T | '' {
  return allowed.some((option) => option.value === raw) ? (raw as T) : ''
}

/**
 * The URL is the state. Nothing is mirrored into a local ref, so back, forward
 * and a pasted link all restore the same page without a second source of truth
 * that could disagree with the address bar.
 */
const answers = computed(() => ({
  usage: optionValue(one(route.query.usage), USAGE_OPTIONS),
  distance: optionValue(one(route.query.distance), DISTANCE_OPTIONS),
  budget: optionValue(one(route.query.budget), BUDGET_OPTIONS),
}))

const complete = computed(() =>
  Boolean(answers.value.usage && answers.value.distance && answers.value.budget)
)

function select(question: 'usage' | 'distance' | 'budget', value: string): void {
  // Rebuilt from the validated answers rather than spread from route.query, so a
  // junk parameter someone appended is dropped instead of being carried forward.
  const next: Record<string, string> = {}
  for (const [key, current] of Object.entries(answers.value)) {
    if (current) next[key] = current
  }
  next[question] = value
  router.push({ query: next })
}

function restart(): void {
  router.push({ query: {} })
}

const needKm = computed(
  () => DISTANCE_OPTIONS.find((option) => option.value === answers.value.distance)?.needKm ?? null
)
const budgetOption = computed(() =>
  BUDGET_OPTIONS.find((entry) => entry.value === answers.value.budget)
)
const budgetCeiling = computed(() => (budgetOption.value ? budgetOption.value.ceiling : undefined))
const budgetFloor = computed(() => budgetOption.value?.floor ?? null)

// ── the catalogue ────────────────────────────────────────────────────────────

const PAGE_SIZE = 48
/** Enough pages to cover the bike range; a runaway catalogue must not fan out. */
const MAX_PAGES = 3
/** How many models we look at in detail. */
const CANDIDATE_LIMIT = 6
const SHOWN = 3

const { data: bikes } = await useAsyncData(
  'guide-bikes',
  async () => {
    const query = { locale: locale.value, productType: 'bike', sort: 'price_asc', perPage: PAGE_SIZE }
    const first = await $fetch<Paginated<ProductSummary>>('/api/catalog/products', { query })
    const extraPages = Math.min(first.totalPages, MAX_PAGES) - 1
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, extraPages) }, (_, index) =>
        $fetch<Paginated<ProductSummary>>('/api/catalog/products', {
          query: { ...query, page: index + 2 },
        })
      )
    )
    return [first, ...rest].flatMap((page) => page.items)
  },
  { default: () => [] as ProductSummary[], watch: [locale] }
)

interface ModelEntry {
  product: ProductSummary
  /** How many colours this model is sold in, the representative included. */
  colours: number
}

/**
 * One entry per model, not one per colour.
 *
 * Every colour is its own product here, so an unfiltered ranking answers "which
 * fatbike should I buy" with the same bike in black, red and blue. The colours
 * are counted and mentioned instead; choosing between them is not a decision
 * this page is for.
 */
const models = computed<ModelEntry[]>(() => {
  const families = new Map<string, ProductSummary[]>()
  for (const bike of bikes.value ?? []) {
    const key = bike.modelFamily ?? bike.id
    const group = families.get(key)
    if (group) group.push(bike)
    else families.set(key, [bike])
  }

  return [...families.values()]
    .map((group) => {
      // The colour a customer can actually have today represents the model.
      const representative = [...group].sort(
        (a, b) =>
          Number(b.available > 0) - Number(a.available > 0) || a.price - b.price
      )[0]
      return representative ? { product: representative, colours: group.length } : null
    })
    .filter((entry): entry is ModelEntry => entry !== null)
    .sort((a, b) => a.product.price - b.product.price)
})

const affordable = computed(() => {
  const ceiling = budgetCeiling.value
  const floor = budgetFloor.value
  let entries = models.value
  if (typeof ceiling === 'number') entries = entries.filter((entry) => entry.product.price <= ceiling)
  if (typeof floor === 'number') entries = entries.filter((entry) => entry.product.price >= floor)
  return entries
})

/**
 * An even spread across the price range rather than the cheapest few.
 *
 * Only these models get their specification sheet read, and reading the six
 * cheapest would mean the ranking below never sees a bike with a big battery —
 * the exact bike someone who rides 70 km a day came here for.
 */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items
  const step = (items.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, index) => items[Math.round(index * step)]!)
}

const shortlist = computed<ModelEntry[]>(() => {
  if (!complete.value) return []
  // Nothing within budget: the alternatives offered must be the cheapest models
  // we sell, not a sample of the whole range. "Nearest" has to mean nearest.
  if (affordable.value.length === 0) return models.value.slice(0, CANDIDATE_LIMIT)
  return spread(affordable.value, CANDIDATE_LIMIT)
})

const shortlistKey = computed(() => shortlist.value.map((entry) => entry.product.slug).join(','))

const { data: details } = await useAsyncData(
  'guide-details',
  async () => {
    const slugs = shortlist.value.map((entry) => entry.product.slug)
    if (slugs.length === 0) return []
    const fetched = await Promise.all(
      slugs.map((slug) =>
        // One retired slug must not blank the whole recommendation.
        $fetch<ProductDetail>(`/api/catalog/products/${slug}`, {
          query: { locale: locale.value },
        }).catch(() => null)
      )
    )
    return fetched.filter((item): item is ProductDetail => item !== null)
  },
  { default: () => [] as ProductDetail[], watch: [shortlistKey, locale] }
)

const detailById = computed(
  () => new Map((details.value ?? []).map((item) => [item.id, item]))
)

// ── the ranking ──────────────────────────────────────────────────────────────

/**
 * The kilometres we are willing to rely on.
 *
 * `range` is free text a manufacturer wrote — "45-60 km", "jusqu'à 70 km". When
 * it states a span we keep the LOW end, because the high one is measured on flat
 * ground, in the warm, with a light rider. A recommendation built on the
 * optimistic number is a recommendation that disappoints in February.
 *
 * A figure is only trusted when it is written next to "km"; otherwise the
 * amp-hours of the battery would be read as a distance.
 */
function conservativeRangeKm(text: string | null): number | null {
  if (!text) return null
  const withUnit = [...text.matchAll(/(\d{1,3})\s*km/gi)].map((match) => Number(match[1]))
  const numbers =
    withUnit.length > 0
      ? withUnit
      : [...text.matchAll(/\d{1,3}/g)]
          .map((match) => Number(match[0]))
          .filter((value) => value >= 15 && value <= 300)
  return numbers.length > 0 ? Math.min(...numbers) : null
}

interface Line {
  key: string
  params?: Record<string, string | number>
}

interface Recommendation {
  entry: ModelEntry
  score: number
  /** True only when nothing we know contradicts the answers given. */
  fits: boolean
  reasons: Line[]
  caveats: Line[]
  specs: Array<{ label: string; value: string }>
}

function assess(entry: ModelEntry): Recommendation {
  const detail = detailById.value.get(entry.product.id) ?? null
  const specifications = detail?.specifications ?? null
  const usage = answers.value.usage
  const need = needKm.value
  const rangeKm = conservativeRangeKm(specifications?.range ?? null)

  const reasons: Line[] = []
  const caveats: Line[] = []
  let score = 0
  let fits = true

  const range = specifications?.range ?? ''
  if (need !== null && rangeKm !== null) {
    if (rangeKm >= need) {
      score += 40
      reasons.push({ key: 'guide.why_range_fits', params: { range } })
    } else if (rangeKm >= need * 0.8) {
      // The needs above already carry headroom, so a fifth below one of them is
      // still a bike that does the journey — said out loud rather than hidden.
      score += 10
      caveats.push({ key: 'guide.caveat_range_close', params: { range } })
    } else {
      score -= 30
      fits = false
      caveats.push({ key: 'guide.caveat_range_short', params: { range } })
    }
  } else if (detail) {
    // No usable figure in the catalogue. Saying we cannot confirm it beats
    // inventing a match, and it is the one thing worth a phone call.
    caveats.push({ key: 'guide.caveat_range_unconfirmed' })
  }

  if (usage === 'charge') {
    const load = specifications?.maxLoad ?? null
    if (load !== null && load >= 150) {
      score += 25
      reasons.push({ key: 'guide.why_load', params: { load } })
    } else if (load !== null && load < 130) {
      score -= 10
      fits = false
      caveats.push({ key: 'guide.caveat_load', params: { load } })
    }
  }

  if (usage === 'loisir' && specifications?.suspension) {
    score += 20
    reasons.push({ key: 'guide.why_suspension', params: { suspension: specifications.suspension } })
  }

  const weight = specifications?.weight ?? null
  if (usage === 'trajet' && weight !== null) {
    if (weight <= 28) score += 12
    else if (weight >= 36) {
      score -= 8
      caveats.push({ key: 'guide.caveat_weight', params: { weight } })
    }
  }

  if (entry.product.available > 0) {
    score += 18
    reasons.push({ key: 'guide.why_in_stock' })
  } else {
    caveats.push({ key: 'guide.caveat_out_of_stock' })
  }

  // Only stated when a ceiling was actually given: "within your budget" is a
  // meaningless claim to someone who answered that budget is not the criterion.
  const ceiling = budgetCeiling.value
  if (typeof ceiling === 'number') {
    if (entry.product.price > ceiling) {
      fits = false
      caveats.push({ key: 'guide.caveat_over_budget' })
    } else {
      reasons.push({ key: 'guide.why_budget' })
    }
  }

  if (entry.colours > 1) {
    reasons.push({ key: 'guide.why_colours', params: { count: entry.colours } })
  }

  const specs: Array<{ label: string; value: string }> = []
  if (specifications?.range) specs.push({ label: t('guide.spec_range'), value: specifications.range })
  if (specifications?.battery) specs.push({ label: t('guide.spec_battery'), value: specifications.battery })
  if (specifications?.motor) specs.push({ label: t('guide.spec_motor'), value: specifications.motor })
  if (specifications?.maxSpeed) {
    specs.push({ label: t('guide.spec_max_speed'), value: `${specifications.maxSpeed} km/h` })
  }
  if (specifications?.maxLoad) {
    specs.push({ label: t('guide.spec_max_load'), value: `${specifications.maxLoad} kg` })
  }
  if (specifications?.weight) {
    specs.push({ label: t('guide.spec_weight'), value: `${specifications.weight} kg` })
  }

  return { entry, score, fits, reasons, caveats, specs }
}

const assessed = computed<Recommendation[]>(() =>
  shortlist.value
    .map(assess)
    // Best first; when two bikes score the same the cheaper one wins, because a
    // tie broken towards the more expensive model is a tie broken for us.
    .sort((a, b) => b.score - a.score || a.entry.product.price - b.entry.product.price)
)

const matching = computed(() => assessed.value.filter((item) => item.fits))

/**
 * When nothing satisfies all three answers we still show the closest models —
 * with what is wrong with each stated on the card. An empty page tells a visitor
 * nothing, and sends them to look elsewhere.
 */
const nothingMatches = computed(() => complete.value && matching.value.length === 0)

const recommendations = computed(() =>
  (matching.value.length > 0 ? matching.value : assessed.value).slice(0, SHOWN)
)

useSeoMeta({
  title: () => t('guide.title'),
  description: () => t('guide.description'),
  // The page someone reaches by searching "which fatbike should I buy". The
  // answered variants are query strings and canonicalise back here on their own.
  robots: 'index, follow',
})
</script>

<template>
  <div class="container-page py-16">
    <header class="max-w-3xl">
      <h1 class="font-display text-3xl font-extrabold text-content-strong sm:text-4xl">
        {{ $t('guide.title') }}
      </h1>
      <p class="mt-4 text-lg text-content">{{ $t('guide.lead') }}</p>
    </header>

    <div class="mt-12 max-w-3xl space-y-8">
      <!-- The hint is tied to the group with aria-describedby: a legend is
           announced when focus enters the group, a loose paragraph beside it is
           not, and the hint is the half that says which answer to pick. -->
      <fieldset aria-describedby="guide-usage-hint">
        <legend class="font-display text-xl font-bold text-content-strong">
          {{ $t('guide.q_usage') }}
        </legend>
        <p id="guide-usage-hint" class="mt-1 text-sm text-content-muted">{{ $t('guide.q_usage_hint') }}</p>

        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <label v-for="option in USAGE_OPTIONS" :key="option.value" class="block cursor-pointer">
            <!-- The native radio is kept and only hidden. It is what makes the
                 group arrow-navigable and announced as a radio group, and the
                 card below reads its state through `peer-checked` — so the thing
                 that looks selected and the thing that IS selected are the same
                 element, and cannot fall out of step. -->
            <input
              type="radio"
              name="guide-usage"
              class="peer sr-only"
              :value="option.value"
              :checked="answers.usage === option.value"
              @change="select('usage', option.value)"
            />
            <span
              class="card flex h-full flex-col gap-1 p-4 transition-colors hover:border-accent peer-checked:border-accent peer-checked:bg-accent-subtle peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
            >
              <span class="font-medium text-content-strong">{{ $t(option.label) }}</span>
              <span class="text-sm text-content-muted">{{ $t(option.hint) }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset v-if="answers.usage" aria-describedby="guide-distance-hint">
        <legend class="font-display text-xl font-bold text-content-strong">
          {{ $t('guide.q_distance') }}
        </legend>
        <p id="guide-distance-hint" class="mt-1 text-sm text-content-muted">
          {{ $t('guide.q_distance_hint') }}
        </p>

        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <label v-for="option in DISTANCE_OPTIONS" :key="option.value" class="block cursor-pointer">
            <input
              type="radio"
              name="guide-distance"
              class="peer sr-only"
              :value="option.value"
              :checked="answers.distance === option.value"
              @change="select('distance', option.value)"
            />
            <span
              class="card flex h-full items-center p-4 font-medium text-content-strong transition-colors hover:border-accent peer-checked:border-accent peer-checked:bg-accent-subtle peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
            >
              {{ $t(option.label) }}
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset v-if="answers.distance" aria-describedby="guide-budget-hint">
        <legend class="font-display text-xl font-bold text-content-strong">
          {{ $t('guide.q_budget') }}
        </legend>
        <p id="guide-budget-hint" class="mt-1 text-sm text-content-muted">
          {{ $t('guide.q_budget_hint') }}
        </p>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label v-for="option in BUDGET_OPTIONS" :key="option.value" class="block cursor-pointer">
            <input
              type="radio"
              name="guide-budget"
              class="peer sr-only"
              :value="option.value"
              :checked="answers.budget === option.value"
              @change="select('budget', option.value)"
            />
            <span
              class="card flex h-full items-center p-4 font-medium text-content-strong transition-colors hover:border-accent peer-checked:border-accent peer-checked:bg-accent-subtle peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
            >
              {{ $t(option.label) }}
            </span>
          </label>
        </div>
      </fieldset>
    </div>

    <!-- Said on the page rather than left to the buyer to discover: a
         speed-limited pedal-assist bike is a bicycle in France, and a fat tyre
         changes nothing about that test. The wording is the one on the FAQ, so
         the two pages cannot drift into saying different things. -->
    <aside class="card mt-12 max-w-3xl p-6">
      <h2 class="font-display text-lg font-bold text-content-strong">{{ $t('faq.q_legal') }}</h2>
      <p class="mt-3 text-content">{{ $t('faq.a_legal') }}</p>
      <NuxtLink :to="localePath('/faq')" class="mt-4 inline-block text-sm font-medium text-accent hover:underline">
        {{ $t('faq.title') }}
      </NuxtLink>
    </aside>

    <p v-if="!complete" class="mt-10 max-w-3xl text-content-muted">
      {{ $t('guide.incomplete') }}
    </p>

    <section v-else class="mt-14">
      <p v-if="models.length === 0" class="max-w-3xl text-content-muted">
        {{ $t('guide.catalogue_unavailable') }}
      </p>

      <template v-else>
        <div class="max-w-3xl">
          <h2 class="font-display text-2xl font-bold text-content-strong">
            {{ nothingMatches ? $t('guide.no_match_title') : $t('guide.results_title') }}
          </h2>
          <p class="mt-3 text-content">
            {{ nothingMatches ? $t('guide.no_match_body') : $t('guide.results_intro') }}
          </p>
        </div>

        <ul class="mt-8 space-y-6">
          <li v-for="item in recommendations" :key="item.entry.product.id" class="card p-5 sm:p-6">
            <div class="flex flex-col gap-6 sm:flex-row">
              <NuxtLink
                :to="localePath(`/produits/${item.entry.product.slug}`)"
                class="shrink-0 overflow-hidden rounded-xl bg-surface-sunken"
              >
                <NuxtImg
                  v-if="item.entry.product.image"
                  :src="item.entry.product.image.url"
                  :alt="item.entry.product.image.alt"
                  width="240"
                  height="240"
                  loading="lazy"
                  class="h-48 w-full object-cover sm:h-40 sm:w-40"
                />
              </NuxtLink>

              <div class="min-w-0 flex-1">
                <p v-if="item.entry.product.brand" class="text-sm text-content-muted">
                  {{ item.entry.product.brand.name }}
                </p>
                <h3 class="font-display text-xl font-bold text-content-strong">
                  <NuxtLink :to="localePath(`/produits/${item.entry.product.slug}`)" class="hover:text-accent">
                    {{ item.entry.product.name }}
                  </NuxtLink>
                </h3>

                <p class="mt-2 flex items-baseline gap-3">
                  <span class="text-2xl font-bold text-accent">
                    {{ formatCents(item.entry.product.price) }}
                  </span>
                  <span v-if="item.entry.product.compareAtPrice" class="text-sm text-content-muted line-through">
                    {{ formatCents(item.entry.product.compareAtPrice) }}
                  </span>
                </p>

                <h4 class="mt-5 text-sm font-semibold uppercase tracking-wide text-content-muted">
                  {{ $t('guide.why_title') }}
                </h4>
                <ul class="mt-2 space-y-1.5">
                  <li
                    v-for="reason in item.reasons"
                    :key="reason.key"
                    class="flex gap-2 text-sm text-content"
                  >
                    <Icon name="ph:check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{{ $t(reason.key, reason.params || {}) }}</span>
                  </li>
                </ul>

                <!-- What is wrong with it, on the same card as what is right.
                     A caveat kept for the delivery conversation is a caveat the
                     customer finds out about after paying. -->
                <ul v-if="item.caveats.length" class="mt-3 space-y-1.5">
                  <li
                    v-for="caveat in item.caveats"
                    :key="caveat.key"
                    class="flex gap-2 text-sm text-content"
                  >
                    <Icon name="ph:warning-circle" class="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>{{ $t(caveat.key, caveat.params || {}) }}</span>
                  </li>
                </ul>

                <dl v-if="item.specs.length" class="mt-5 grid gap-x-6 gap-y-2 border-t border-surface-border pt-4 text-sm sm:grid-cols-2">
                  <div v-for="spec in item.specs" :key="spec.label" class="flex justify-between gap-3">
                    <dt class="text-content-muted">{{ spec.label }}</dt>
                    <dd class="text-right text-content-strong">{{ spec.value }}</dd>
                  </div>
                </dl>

                <NuxtLink
                  :to="localePath(`/produits/${item.entry.product.slug}`)"
                  class="btn-primary mt-5"
                >
                  {{ $t('guide.view_product') }}
                </NuxtLink>
              </div>
            </div>
          </li>
        </ul>

        <p class="mt-8 max-w-3xl text-sm text-content-muted">{{ $t('guide.method_note') }}</p>

        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink :to="localePath('/produits')" class="btn-secondary">{{ $t('guide.see_all') }}</NuxtLink>
          <button type="button" class="btn-secondary" @click="restart">{{ $t('guide.restart') }}</button>
        </div>
      </template>
    </section>

    <section class="card mt-14 max-w-3xl p-6 sm:p-8">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('guide.help_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('guide.help_body') }}</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <NuxtLink :to="localePath('/contact')" class="btn-primary">{{ $t('nav.contact') }}</NuxtLink>
        <ContactLink kind="whatsapp" class="btn-secondary">{{ $t('contact.whatsapp') }}</ContactLink>
      </div>
    </section>
  </div>
</template>
