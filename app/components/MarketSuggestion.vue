<script setup lang="ts">
import { LOCALES, isLocaleCode, type LocaleCode } from '~~/shared/locales'
import { getMarket, marketForLocale } from '~~/shared/markets'

/**
 * "There is a version of this shop priced for your country."
 *
 * This is the only place a visitor's location influences anything they see, and
 * it influences one thing: whether this strip appears. It never navigates for
 * them. Sending someone to a different country version because of their IP
 * address is what EU Regulation 2018/302 prohibits, and it is also how a crawler
 * ends up indexing a page nobody asked for.
 *
 * Dismissal is remembered, because a banner that returns on every page is not a
 * suggestion, it is nagging.
 */
const DISMISS_KEY = 'vs_market_suggestion'

const { locale } = useI18n()
const switchLocalePath = useSwitchLocalePath()

// Read on the server, where the middleware left it, and carried to the client in
// the payload — so the strip is in the first paint rather than appearing a
// moment later and pushing the page down.
const suggestion = useState<{ locale: LocaleCode; market: string } | null>(
  'market-suggestion',
  () => {
    const context = useRequestEvent()?.context
    const suggested = context?.suggestedLocale
    const market = context?.suggestedMarket
    if (!isLocaleCode(suggested) || !market) return null
    return { locale: suggested, market }
  }
)

const dismissed = ref(true)
onMounted(() => {
  dismissed.value = localStorage.getItem(DISMISS_KEY) === '1'
})

function dismiss(): void {
  dismissed.value = true
  localStorage.setItem(DISMISS_KEY, '1')
}

const visible = computed(() => Boolean(suggestion.value) && !dismissed.value)

/** Endonym, so a Dutch visitor reads "Nederlands" and not "néerlandais". */
const suggestedLabel = computed(
  () => LOCALES.find((entry) => entry.code === suggestion.value?.locale)?.label ?? ''
)

const priceDiffers = computed(() => {
  const market = getMarket(suggestion.value?.market)
  return Boolean(market) && market!.country !== marketForLocale(locale.value as LocaleCode).country
})

const target = computed(() =>
  suggestion.value ? switchLocalePath(suggestion.value.locale) : undefined
)
</script>

<template>
  <div
    v-if="visible && target"
    class="border-b border-surface-border bg-surface-sunken"
    role="region"
    :aria-label="$t('market.suggestion_label')"
  >
    <div class="container-page flex flex-wrap items-center gap-3 py-2.5 text-sm">
      <p class="flex-1 text-content">
        {{ $t('market.suggestion', { language: suggestedLabel }) }}
        <span v-if="priceDiffers" class="text-content-muted">
          {{ $t('market.suggestion_prices') }}
        </span>
      </p>

      <!-- A link, not a redirect: the visitor decides, and a crawler following
           it lands somewhere it can index rather than being bounced. -->
      <NuxtLink :to="target" class="btn-primary h-9 px-3 text-xs" @click="dismiss">
        {{ $t('market.suggestion_go', { language: suggestedLabel }) }}
      </NuxtLink>

      <button
        type="button"
        class="rounded-lg p-1.5 text-content-muted transition hover:text-content-strong"
        :aria-label="$t('common.close')"
        @click="dismiss"
      >
        <Icon name="ph:x" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
