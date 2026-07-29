<script setup lang="ts">
/**
 * The admin shell.
 *
 * Deliberately plain: this is a working tool used every day, not a storefront.
 * The queue counters sit in the navigation because "what needs me now" is the
 * question the owner opens this panel to answer.
 */
const localePath = useLocalePath()
const route = useRoute()

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

        <NuxtLink :to="localePath('/')" class="ms-auto text-sm text-content-muted hover:text-content-strong">
          {{ $t('admin.back_to_shop') }}
        </NuxtLink>
      </div>
    </header>

    <main id="main" class="flex-1 py-8">
      <slot />
    </main>
  </div>
</template>
