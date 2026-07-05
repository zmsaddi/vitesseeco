<template>
  <div class="min-h-screen bg-bg text-on-surface font-sans flex">
    <!-- Sidebar (desktop) -->
    <aside class="hidden md:flex w-60 shrink-0 flex-col bg-surface border-r border-surface-2 min-h-screen sticky top-0">
      <div class="px-5 py-5 border-b border-surface-2">
        <NuxtLink to="/admin" class="flex items-center gap-2">
          <span class="text-accent font-display font-bold text-lg">Vitesse Eco</span>
          <span class="text-xs uppercase tracking-widest text-on-surface-muted bg-surface-2 rounded px-1.5 py-0.5">Admin</span>
        </NuxtLink>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.disabled ? '' : item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200"
          :class="[
            isActive(item.to) ? 'bg-accent/10 text-accent font-semibold' : 'text-on-surface-muted hover:bg-surface-2 hover:text-on-surface',
            item.disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
          ]"
        >
          <Icon :name="item.icon" class="w-5 h-5 shrink-0" />
          <span>{{ item.label }}</span>
          <span v-if="item.disabled" class="ms-auto text-[10px] uppercase text-on-surface-muted">bientôt</span>
        </NuxtLink>
      </nav>

      <div class="px-3 py-4 border-t border-surface-2 space-y-1">
        <NuxtLink to="/" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-on-surface-muted hover:bg-surface-2 hover:text-on-surface transition-colors duration-200">
          <Icon name="heroicons:arrow-uturn-left" class="w-5 h-5" />
          <span>Retour au site</span>
        </NuxtLink>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 min-w-0 flex flex-col">
      <!-- Top bar (mobile nav) -->
      <header class="md:hidden sticky top-0 z-header bg-surface border-b border-surface-2 px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/admin" class="flex items-center gap-2">
          <span class="text-accent font-display font-bold">Vitesse Eco</span>
          <span class="text-[10px] uppercase tracking-widest text-on-surface-muted bg-surface-2 rounded px-1.5 py-0.5">Admin</span>
        </NuxtLink>
        <nav class="flex items-center gap-1">
          <NuxtLink
            v-for="item in navItems.filter(i => !i.disabled)"
            :key="item.to"
            :to="item.to"
            class="rounded-lg p-2.5"
            :class="isActive(item.to) ? 'bg-accent/10 text-accent' : 'text-on-surface-muted'"
            :aria-label="item.label"
          >
            <Icon :name="item.icon" class="w-5 h-5" />
          </NuxtLink>
          <NuxtLink to="/" class="rounded-lg p-2.5 text-on-surface-muted" aria-label="Retour au site">
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

const navItems = [
  { to: '/admin/commandes', label: 'Commandes', icon: 'heroicons:shopping-bag', disabled: false },
  { to: '/admin/stock', label: 'Stock', icon: 'heroicons:cube', disabled: true },
  { to: '/admin/messages', label: 'Messages', icon: 'heroicons:envelope', disabled: true },
  { to: '/admin/tableau-de-bord', label: 'Tableau de bord', icon: 'heroicons:chart-bar', disabled: true },
]

function isActive(to: string) {
  return to && route.path.startsWith(to)
}

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>
