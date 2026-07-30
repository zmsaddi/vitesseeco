<script setup lang="ts">
import { LOCALES } from '~~/shared/locales'

/**
 * The header.
 *
 * Search sits in its own row on small screens rather than behind a tap, because
 * a shop's search is not a secondary action. The basket count is client-only:
 * it comes from localStorage, so rendering it on the server would guarantee a
 * hydration mismatch.
 */
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { locale } = useI18n()
const cart = useCart()

onMounted(cart.restore)

const menuOpen = ref(false)
const languageOpen = ref(false)

const navigation = computed(() => [
  { to: localePath('/produits'), label: 'nav.products' },
  // Someone who does not yet know which bike they want will not find the guide
  // in a footer. It earns its place beside the catalogue.
  { to: localePath('/guide'), label: 'nav.guide' },
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
        <NuxtLink :to="localePath('/')" class="font-display text-lg font-extrabold text-content-strong">
          Vitesse<span class="text-accent">Eco</span>
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
          <div class="relative">
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
      </nav>
    </div>
  </header>
</template>
