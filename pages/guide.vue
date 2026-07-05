<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <div class="mb-6">
        <Breadcrumbs :items="[
          { label: $t('nav.home'), to: localePath('/') },
          { label: $t('nav.guide') },
        ]" />
      </div>

      <!-- Hero -->
      <div class="text-center max-w-3xl mx-auto mb-10">
        <h1 class="font-display text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-3">{{ $t('guide.title') }}</h1>
        <p class="text-text-secondary text-base md:text-lg">{{ $t('guide.subtitle') }}</p>
      </div>

      <!-- Q1: usage -->
      <section class="mb-8">
        <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2.5">
          <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold shrink-0">1</span>
          {{ $t('guide.usage_question') }}
        </h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            v-for="u in usageOptions"
            :key="u.value"
            type="button"
            class="card p-4 text-start transition-all focus-ring"
            :class="usage === u.value ? 'border-accent bg-accent/5' : 'hover:border-accent/40'"
            :aria-pressed="usage === u.value"
            @click="usage = usage === u.value ? '' : u.value"
          >
            <span class="text-2xl block mb-2" aria-hidden="true">{{ u.icon }}</span>
            <span class="block text-white font-medium text-sm">{{ u.label }}</span>
            <span class="block text-text-secondary text-xs mt-1">{{ u.desc }}</span>
          </button>
        </div>
      </section>

      <!-- Q2: height -->
      <section class="mb-8">
        <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2.5">
          <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold shrink-0">2</span>
          {{ $t('guide.height_question') }}
        </h2>
        <div class="flex flex-wrap gap-3">
          <button
            v-for="h in heightOptions"
            :key="h.value"
            type="button"
            class="rounded-full px-5 py-2.5 text-sm font-medium border-2 transition-all focus-ring min-h-touch"
            :class="height === h.value ? 'bg-accent text-primary border-accent' : 'bg-dark-secondary text-text-secondary border-dark-tertiary hover:text-white hover:border-accent/40'"
            :aria-pressed="height === h.value"
            @click="height = height === h.value ? '' : h.value"
          >
            {{ h.label }}
          </button>
        </div>
      </section>

      <!-- Q3: range -->
      <section class="mb-10">
        <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2.5">
          <span class="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center text-accent text-sm font-bold shrink-0">3</span>
          {{ $t('guide.range_question') }}
        </h2>
        <div class="flex flex-wrap gap-3">
          <button
            v-for="r in rangeOptions"
            :key="r.value"
            type="button"
            class="rounded-full px-5 py-2.5 text-sm font-medium border-2 transition-all focus-ring min-h-touch"
            :class="rangeSel === r.value ? 'bg-accent text-primary border-accent' : 'bg-dark-secondary text-text-secondary border-dark-tertiary hover:text-white hover:border-accent/40'"
            :aria-pressed="rangeSel === r.value"
            @click="rangeSel = rangeSel === r.value ? '' : r.value"
          >
            🔋 {{ r.label }}
          </button>
        </div>
      </section>

      <!-- Results -->
      <section class="border-t border-dark-tertiary pt-10">
        <template v-if="started">
          <div class="text-center mb-8">
            <h2 class="section-title mb-2">{{ $t('guide.results_title') }}</h2>
            <p class="text-text-secondary">{{ $t('guide.results_subtitle', { count: recommendations.length }) }}</p>
          </div>

          <div v-if="!bikes" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div v-for="i in 4" :key="i" class="card animate-pulse">
              <div class="aspect-[4/3] bg-dark-tertiary" />
              <div class="p-4 space-y-3">
                <div class="h-4 bg-dark-tertiary rounded w-3/4" />
                <div class="h-5 bg-dark-tertiary rounded w-1/4" />
              </div>
            </div>
          </div>

          <div v-else-if="recommendations.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <NuxtLink v-for="p in recommendations" :key="p._id" :to="localePath(`/produits/${p.slug?.current}`)">
              <ProductCard :product="p" />
            </NuxtLink>
          </div>

          <div v-else class="card p-10 text-center">
            <Icon name="ph:bicycle" class="w-12 h-12 text-dark-tertiary mx-auto mb-4" />
            <p class="text-white font-medium mb-4">{{ $t('guide.no_results') }}</p>
            <button type="button" class="btn-outline px-6" @click="clearAll">{{ $t('guide.clear_filters') }}</button>
          </div>
        </template>

        <p v-else class="text-center text-text-secondary py-6 flex items-center justify-center gap-2">
          <Icon name="ph:arrow-up" class="w-4 h-4" /> {{ $t('guide.start_hint') }}
        </p>
      </section>

      <!-- Help CTA -->
      <section class="mt-14">
        <div class="card card-premium p-8 md:p-12 text-center max-w-2xl mx-auto">
          <Icon name="ph:headset" class="w-10 h-10 text-accent mx-auto mb-3" />
          <h2 class="font-display text-xl font-bold text-white mb-2">{{ $t('guide.need_help') }}</h2>
          <p class="text-text-secondary mb-6">{{ $t('guide.need_help_desc') }}</p>
          <div class="flex flex-wrap justify-center gap-3">
            <NuxtLink :to="localePath('/contact')" class="btn-primary px-6 py-3">{{ $t('nav.contact') }}</NuxtLink>
            <NuxtLink :to="localePath('/comparatif')" class="btn-outline px-6 py-3">{{ $t('compare.title') }}</NuxtLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Buying guide (U-P8) — recreated. Interactive 3-question selector over the
 * live bike catalog. Matching is deliberately forgiving: a product missing
 * the relevant spec is never excluded by that criterion.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()

useSeoMeta({
  title: () => `${t('guide.title')} — Vitesse Eco`,
  description: () => t('guide.subtitle'),
})

const usage = ref('')
const height = ref('')
const rangeSel = ref('')

const started = computed(() => Boolean(usage.value || height.value || rangeSel.value))
function clearAll() { usage.value = ''; height.value = ''; rangeSel.value = '' }

const usageOptions = computed(() => [
  { value: 'urban',    icon: '🏙️', label: t('guide.urban'),    desc: t('guide.urban_desc') },
  { value: 'offroad',  icon: '⛰️', label: t('guide.offroad'),  desc: t('guide.offroad_desc') },
  { value: 'foldable', icon: '📦', label: t('guide.foldable'), desc: t('guide.foldable_desc') },
  { value: 'lady',     icon: '🌸', label: t('guide.lady'),     desc: t('guide.lady_desc') },
])
const heightOptions = computed(() => [
  { value: 'short',  label: t('guide.height_short') },
  { value: 'medium', label: t('guide.height_medium') },
  { value: 'tall',   label: t('guide.height_tall') },
])
const rangeOptions = computed(() => [
  { value: 'short',  label: t('guide.range_short') },
  { value: 'medium', label: t('guide.range_medium') },
  { value: 'long',   label: t('guide.range_long') },
])

const bikesQuery = groq`*[_type == "product" && productType == "bike" && isAvailable == true && stock > 0] | order(sortOrder asc) {
  _id, name, slug, shortDescription, highlights, price, compareAtPrice, isOnSale, isNew,
  color, colorHex, stock, specifications, brand->{ name }, "images": images[]{asset}
}`
const { data: bikes } = useSanityFetch('guide-bikes', bikesQuery)

const USAGE_PATTERNS: Record<string, RegExp> = {
  urban: /urbain|ville|city|commut|urban|stad/i,
  offroad: /tout.terrain|terrain|montagne|trail|off.road|fat|aventure|gelände/i,
  foldable: /pliable|pliant|fold|compact|vouw|klapp/i,
  lady: /femme|lady|step|dame|bas|amovible/i,
}

function textOf(p: any): string {
  return [l(p.name), l(p.shortDescription), ...(p.highlights || []).map((h: any) => l(h))]
    .filter(Boolean)
    .join(' ')
}

function maxRangeKm(p: any): number | null {
  const raw = p.specifications?.range
  const s = typeof raw === 'object' ? l(raw) : raw
  if (!s) return null
  const nums = String(s).match(/\d+/g)?.map(Number) || []
  return nums.length ? Math.max(...nums) : null
}

function tireInches(p: any): number | null {
  const raw = p.specifications?.tireSize
  if (!raw) return null
  const n = parseFloat(String(raw))
  return Number.isFinite(n) ? n : null
}

const recommendations = computed(() => {
  const list = (bikes.value as any[]) || []
  return list.filter((p) => {
    if (usage.value && !USAGE_PATTERNS[usage.value].test(textOf(p))) return false
    if (height.value) {
      const tire = tireInches(p)
      if (tire !== null) {
        if (height.value === 'short' && tire > 24) return false
        if (height.value === 'tall' && tire < 24) return false
      }
    }
    if (rangeSel.value) {
      const km = maxRangeKm(p)
      if (km !== null) {
        if (rangeSel.value === 'short' && km < 30) return false
        if (rangeSel.value === 'medium' && km < 50) return false
        if (rangeSel.value === 'long' && km < 70) return false
      }
    }
    return true
  })
})
</script>
