<script setup lang="ts">
import { LOCALES } from '~~/shared/locales'

/**
 * The admin shell.
 *
 * Deliberately plain: this is a working tool used every day, not a storefront.
 * The queue counters sit in the navigation because "what needs me now" is the
 * question the owner opens this panel to answer.
 *
 * The language control is not decoration. This layout replaces SiteHeader, which
 * owns the only other switcher in the app, and every link below routes through
 * `localePath` — locale-preserving, never locale-changing. Without a switcher
 * here the panel is reachable only by typing `/admin`, and under
 * `prefix_except_default` that URL *is* the French one, so the whole panel was
 * French-only however many languages it had been translated into.
 */
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { locale } = useI18n()
const route = useRoute()

const languageOpen = ref(false)

// Close on route change: the switcher navigates, and a menu left hanging over
// the new page reads as a broken control.
watch(() => route.fullPath, () => { languageOpen.value = false })

const { data: dashboard } = await useFetch<{
  queue: {
    toProcess: number
    toShip: number
    cashAwaitingCollection: number
    unreadMessages: number
  }
}>('/api/admin/dashboard', { query: { period: '7d' } })

const links = computed(() => [
  { to: '/admin', label: 'admin.overview', badge: 0 },
  { to: '/admin/commandes', label: 'admin.orders', badge: dashboard.value?.queue.toProcess ?? 0 },
  { to: '/admin/stock', label: 'admin.stock', badge: 0 },
  { to: '/admin/messages', label: 'admin.messages', badge: dashboard.value?.queue.unreadMessages ?? 0 },
])

const isActive = (to: string) => route.path === localePath(to)
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-surface-sunken">
    <header class="border-b border-surface-border bg-surface-raised">
      <div class="container-page flex h-14 items-center gap-6">
        <NuxtLink :to="localePath('/admin')" class="font-display font-extrabold text-content-strong">
          {{ $t('admin.title') }}
        </NuxtLink>

        <nav class="flex items-center gap-1 overflow-x-auto" :aria-label="$t('admin.title')">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="localePath(link.to)"
            class="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium"
            :class="isActive(link.to) ? 'bg-accent-subtle text-accent' : 'text-content hover:bg-surface-sunken'"
          >
            {{ $t(link.label) }}
            <span
              v-if="link.badge > 0"
              class="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-contrast"
            >{{ link.badge }}</span>
          </NuxtLink>
        </nav>

        <div class="ms-auto flex items-center gap-4">
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

          <NuxtLink :to="localePath('/')" class="text-sm text-content-muted hover:text-content-strong">
            {{ $t('admin.back_to_shop') }}
          </NuxtLink>
        </div>
      </div>
    </header>

    <main id="main" class="flex-1 py-8">
      <slot />
    </main>
  </div>
</template>
