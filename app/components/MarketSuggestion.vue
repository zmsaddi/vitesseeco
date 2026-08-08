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
 *
 * It is remembered in a COOKIE rather than in localStorage, and that is the
 * whole point of the storage choice. localStorage is invisible to the server,
 * so the strip could never be rendered in the first paint: the page arrived
 * without it, hydration decided it belonged, and everything below moved down.
 * Measured on the home page for a visitor in the Netherlands: a 0.0462 layout
 * shift of <main>, the largest single shift on the page, and it moved the
 * content under the reader's eyes a beat after they started reading. A cookie
 * travels with the request, so the server renders the right thing once.
 *
 * The middleware already sends `Vary: Accept-Language, Cookie`, so a shared
 * cache cannot serve a dismissed visitor's page to someone who has not
 * dismissed it. The old localStorage key is left where it is — inert, and not
 * worth code that runs on every page load to delete it once.
 */
const DISMISS_KEY = 'vs_market_suggestion'

/** Long enough to mean "remembered", short enough not to be permanent. */
const DISMISS_DAYS = 180

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

/**
 * Read as a number, not a string.
 *
 * useCookie parses through destr, so a cookie written as "1" comes back as the
 * NUMBER 1 — and `value !== '1'` is then true for a visitor who dismissed the
 * strip yesterday. It typed cleanly, it rendered without error, and the banner
 * simply came back forever. Caught by checking the server HTML with the cookie
 * set, which is the only place the difference is visible.
 */
const dismissed = useCookie<number | null>(DISMISS_KEY, {
  maxAge: DISMISS_DAYS * 24 * 60 * 60,
  sameSite: 'lax',
  path: '/',
})

function dismiss(): void {
  dismissed.value = 1
}

const visible = computed(() => Boolean(suggestion.value) && dismissed.value !== 1)

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
