<template>
  <div class="min-h-screen bg-bg text-on-surface font-sans flex">
    <!-- Sidebar (desktop) -->
    <aside class="hidden md:flex w-60 shrink-0 flex-col bg-surface border-r border-surface-2 min-h-screen sticky top-0">
      <div class="px-5 py-5 border-b border-surface-2">
        <NuxtLink :to="localePath('/admin')" class="flex items-center gap-2">
          <span class="text-accent font-display font-bold text-lg">Vitesse Eco</span>
          <span class="text-xs uppercase tracking-widest text-on-surface-muted bg-surface-2 rounded px-1.5 py-0.5">Admin</span>
        </NuxtLink>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="localePath(item.to)"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200"
          :class="isActive(item) ? 'bg-accent/10 text-accent font-semibold' : 'text-on-surface-muted hover:bg-surface-2 hover:text-on-surface'"
        >
          <Icon :name="item.icon" class="w-5 h-5 shrink-0" />
          <span>{{ $t(item.label) }}</span>
        </NuxtLink>
      </nav>

      <div class="px-3 py-4 border-t border-surface-2 space-y-2">
        <div v-if="adminEmail" class="px-3 text-xs text-on-surface-muted truncate" :title="adminEmail">
          <Icon name="heroicons:user-circle" class="w-4 h-4 inline-block me-1 align-text-bottom" />
          {{ adminEmail }}
        </div>
        <label class="block px-3">
          <span class="sr-only">{{ $t('admin.language') }}</span>
          <select
            class="w-full bg-bg border border-surface-2 rounded-lg px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:border-accent"
            :value="locale"
            @change="switchLang(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="l in locales" :key="l.code" :value="l.code">{{ l.name }}</option>
          </select>
        </label>
        <NuxtLink :to="localePath('/')" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-on-surface-muted hover:bg-surface-2 hover:text-on-surface transition-colors duration-200">
          <Icon name="heroicons:arrow-uturn-left" class="w-5 h-5" />
          <span>{{ $t('admin.back_to_site') }}</span>
        </NuxtLink>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 min-w-0 flex flex-col">
      <!-- Top bar (mobile nav) -->
      <header class="md:hidden sticky top-0 z-header bg-surface border-b border-surface-2 px-4 py-3 flex items-center justify-between">
        <NuxtLink :to="localePath('/admin')" class="flex items-center gap-2">
          <span class="text-accent font-display font-bold">Vitesse Eco</span>
          <span class="text-[10px] uppercase tracking-widest text-on-surface-muted bg-surface-2 rounded px-1.5 py-0.5">Admin</span>
        </NuxtLink>
        <nav class="flex items-center gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="localePath(item.to)"
            class="rounded-lg p-2.5"
            :class="isActive(item) ? 'bg-accent/10 text-accent' : 'text-on-surface-muted'"
            :aria-label="$t(item.label)"
          >
            <Icon :name="item.icon" class="w-5 h-5" />
          </NuxtLink>
          <NuxtLink :to="localePath('/')" class="rounded-lg p-2.5 text-on-surface-muted" :aria-label="$t('admin.back_to_site')">
            <Icon name="heroicons:arrow-uturn-left" class="w-5 h-5" />
          </NuxtLink>
        </nav>
      </header>

      <main class="flex-1 px-4 md:px-8 py-6 max-w-6xl w-full mx-auto">
        <slot />
      </main>
    </div>

    <ClientOnly>
      <AppToast />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { locale, locales } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()

const navItems = [
  { to: '/admin', label: 'admin.nav_dashboard', icon: 'heroicons:chart-bar', exact: true },
  { to: '/admin/commandes', label: 'admin.nav_orders', icon: 'heroicons:shopping-bag', exact: false },
  { to: '/admin/stock', label: 'admin.nav_stock', icon: 'heroicons:cube', exact: false },
  { to: '/admin/messages', label: 'admin.nav_messages', icon: 'heroicons:envelope', exact: false },
]

// Nav targets are unlocalized paths; compare against the route path with any
// locale prefix stripped so active state works in every language.
const pathNoLocale = computed(() => {
  const stripped = route.path.replace(/^\/(en|es|nl|de|ar)(?=\/|$)/, '')
  return (stripped || '/').replace(/\/$/, '') || '/'
})

function isActive(item: { to: string; exact: boolean }) {
  return item.exact ? pathNoLocale.value === item.to : pathNoLocale.value.startsWith(item.to)
}

function switchLang(code: string) {
  const target = switchLocalePath(code as 'fr' | 'en' | 'es' | 'nl' | 'de' | 'ar')
  if (target) navigateTo(target)
}

const { data: adminInfo } = useFetch('/api/admin/me', { server: false })
const adminEmail = computed(() => adminInfo.value?.email ?? '')

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>
