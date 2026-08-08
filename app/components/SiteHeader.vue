<script setup lang="ts">
import { LOCALES } from '~~/shared/locales'

/**
 * The header.
 *
 * There is no search here. The comment that used to sit in this spot described
 * one "in its own row on small screens", and an audit found the sentence but
 * not the control — so it is written down as absent rather than described as
 * present.
 *
 * The row is deliberately short on a phone: at 320px the wordmark plus the
 * controls overflowed the viewport on every page, in every language. Language,
 * wishlist and account live in the menu below that width and in the row from md
 * up.
 *
 * The basket count is client-only: it comes from localStorage, so rendering it
 * on the server would guarantee a hydration mismatch.
 */
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { locale } = useI18n()
const cart = useCart()

onMounted(cart.restore)

const menuOpen = ref(false)
const languageOpen = ref(false)
const languageRoot = ref<HTMLElement | null>(null)

/**
 * A popover that only closes by clicking the button that opened it is a trap
 * for anyone using a keyboard, and a surprise for everyone else. Escape closes
 * it and returns focus; a click anywhere outside dismisses it.
 */
function closeLanguage(returnFocus = false): void {
  if (!languageOpen.value) return
  languageOpen.value = false
  if (returnFocus) {
    languageRoot.value?.querySelector<HTMLButtonElement>('button')?.focus()
  }
}

onMounted(() => {
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeLanguage(true)
      menuOpen.value = false
    }
  }
  const onPointer = (event: MouseEvent) => {
    if (languageOpen.value && !languageRoot.value?.contains(event.target as Node)) {
      closeLanguage()
    }
  }
  document.addEventListener('keydown', onKey)
  document.addEventListener('click', onPointer)
  onUnmounted(() => {
    document.removeEventListener('keydown', onKey)
    document.removeEventListener('click', onPointer)
  })
})

const navigation = computed(() => [
  { to: localePath('/produits'), label: 'nav.products' },
  // Someone who does not yet know which bike they want will not find the guide
  // in a footer. It earns its place beside the catalogue.
  { to: localePath('/guide'), label: 'nav.guide' },
  // The blog is where the marketing content lives; a content strategy whose
  // only door is a footer link is a warehouse without a shopfront.
  { to: localePath('/blog'), label: 'nav.blog' },
  { to: localePath('/a-propos'), label: 'nav.about' },
  { to: localePath('/contact'), label: 'nav.contact' },
])

// Close both menus on navigation, or they hang open over the new page.
const route = useRoute()
watch(() => route.fullPath, () => {
  menuOpen.value = false
  languageOpen.value = false
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-surface-border bg-surface-raised/95 backdrop-blur">
    <div class="container-page">
      <div class="flex h-16 items-center gap-4">
        <!-- The lockup reproduces public/brand/logo-primary.svg EXACTLY, in em
             units mirroring the generator's ratios: stag 1.5×fs on the optical
             centre, spark 0.8×fs grounded at the baseline, gaps 0.27/0.17fs
             (wider left because the 6° shear leans the ink left). If the
             generator's geometry changes, change this with it. -->
        <NuxtLink
          :to="localePath('/')"
          class="flex shrink-0 items-center font-display text-xl font-extrabold text-content-strong"
          style="gap: 0.3em"
        >
          <BrandMark class="w-auto text-gold-deep" style="height: 1.5em" />
          <span class="flex items-baseline" style="line-height: 1"
            >Vitesse<BrandBolt
              class="w-auto"
              style="height: 0.8em; margin: 0 0.17em -0.02em 0.27em; align-self: flex-end"
            /><span class="text-accent">Eco</span></span
          >
        </NuxtLink>

        <nav class="hidden md:flex md:items-center md:gap-6" :aria-label="$t('nav.primary')">
          <NuxtLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            class="text-sm font-medium text-content hover:text-content-strong"
          >
            {{ $t(item.label) }}
          </NuxtLink>
        </nav>

        <div class="ms-auto flex items-center gap-1">
          <!--
            At 320px this row plus the wordmark overflowed the viewport on every
            page, in every language. Language, wishlist and account live in the
            menu on a phone and in the row from md up, so the phone row is only
            basket + menu and there is space for the two entry points the shop
            never had.
          -->
          <div ref="languageRoot" class="relative hidden md:block">
            <button
              type="button"
              class="btn min-w-11 px-2 text-content"
              :aria-expanded="languageOpen"
              aria-haspopup="true"
              :aria-label="$t('nav.change_language')"
              @click="languageOpen = !languageOpen"
            >
              <span class="text-sm font-semibold uppercase">{{ locale }}</span>
            </button>
            <ul
              v-if="languageOpen"
              class="absolute end-0 z-50 mt-1 min-w-40 rounded-xl border border-surface-border bg-surface-raised py-1 shadow-lg"
            >
              <li v-for="entry in LOCALES" :key="entry.code">
                <NuxtLink
                  :to="switchLocalePath(entry.code)"
                  class="block px-4 py-2 text-sm text-content hover:bg-surface-sunken"
                  :lang="entry.hreflang"
                >
                  {{ entry.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <NuxtLink
            :to="localePath('/favoris')"
            class="btn hidden min-w-11 px-2 text-content md:inline-flex"
            :aria-label="$t('wishlist.title')"
          >
            <Icon name="ph:heart" class="h-5 w-5" />
          </NuxtLink>

          <NuxtLink
            :to="localePath('/compte')"
            class="btn hidden min-w-11 px-2 text-content md:inline-flex"
            :aria-label="$t('account.title')"
          >
            <Icon name="ph:user" class="h-5 w-5" />
          </NuxtLink>

          <NuxtLink :to="localePath('/panier')" class="btn relative min-w-11 px-2 text-content">
            <Icon name="ph:shopping-bag" class="h-5 w-5" />
            <ClientOnly>
              <span
                v-if="cart.count.value > 0"
                class="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-contrast"
              >
                {{ cart.count.value }}
              </span>
            </ClientOnly>
            <span class="sr-only">{{ $t('nav.cart') }}</span>
          </NuxtLink>

          <button
            type="button"
            class="btn min-w-11 px-2 text-content md:hidden"
            :aria-expanded="menuOpen"
            :aria-label="menuOpen ? $t('nav.close_menu') : $t('nav.open_menu')"
            @click="menuOpen = !menuOpen"
          >
            <Icon :name="menuOpen ? 'ph:x' : 'ph:list'" class="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav v-if="menuOpen" class="border-t border-surface-border py-2 md:hidden" :aria-label="$t('nav.primary')">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="block px-1 py-3 text-sm font-medium text-content"
        >
          {{ $t(item.label) }}
        </NuxtLink>

        <!-- The two destinations a phone visitor previously had no way to reach. -->
        <NuxtLink
          :to="localePath('/favoris')"
          class="flex items-center gap-2 px-1 py-3 text-sm font-medium text-content"
        >
          <Icon name="ph:heart" class="h-4 w-4" />
          {{ $t('wishlist.title') }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/compte')"
          class="flex items-center gap-2 px-1 py-3 text-sm font-medium text-content"
        >
          <Icon name="ph:user" class="h-4 w-4" />
          {{ $t('account.title') }}
        </NuxtLink>

        <div class="mt-2 border-t border-surface-border pt-3">
          <p class="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
            {{ $t('nav.change_language') }}
          </p>
          <div class="flex flex-wrap gap-1">
            <NuxtLink
              v-for="entry in LOCALES"
              :key="entry.code"
              :to="switchLocalePath(entry.code)"
              class="rounded-lg px-3 py-2 text-sm text-content hover:bg-surface-sunken"
              :class="entry.code === locale ? 'bg-accent-subtle font-semibold text-accent' : ''"
              :lang="entry.hreflang"
            >
              {{ entry.label }}
            </NuxtLink>
          </div>
        </div>
      </nav>
    </div>
  </header>
</template>
