<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-3xl">
      <div class="flex items-center justify-between mb-8">
        <h1 class="section-title">{{ $t('account.title') }}</h1>
        <button @click="handleLogout" class="text-text-secondary hover:text-red-400 transition-colors text-sm flex items-center gap-2">
          <Icon name="ph:sign-out" class="w-4 h-4" />
          {{ $t('nav.logout') }}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Profile -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="ph:user" class="w-5 h-5 text-accent" />
            {{ $t('account.profile') }}
          </h2>
          <div class="space-y-2 text-sm">
            <p class="text-text-secondary">{{ auth.user?.firstName }} {{ auth.user?.lastName }}</p>
            <p class="text-text-secondary">{{ auth.user?.email }}</p>
            <p v-if="auth.user?.phone" class="text-text-secondary">{{ auth.user?.phone }}</p>
            <p v-if="auth.user?.address" class="text-text-secondary">
              {{ auth.user?.address }}, {{ auth.user?.postalCode }} {{ auth.user?.city }}
            </p>
          </div>
        </div>

        <!-- Orders -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="ph:package" class="w-5 h-5 text-accent" />
            {{ $t('account.orders') }}
          </h2>
          <div v-if="!orders?.length" class="text-text-secondary text-sm">
            <p>{{ $t('account.no_orders') }}</p>
            <NuxtLink :to="localePath('/produits')" class="text-accent hover:underline mt-2 inline-block">
              {{ $t('cart.empty_cta') }}
            </NuxtLink>
          </div>
          <div v-else class="space-y-3">
            <div v-for="order in orders" :key="order.id" class="bg-dark-tertiary/30 rounded-lg p-3">
              <div class="flex justify-between text-sm">
                <span class="text-white font-medium">#{{ order.id.slice(0, 8) }}</span>
                <span class="text-accent">{{ order.total }}{{ $t('common.currency') }}</span>
              </div>
              <p class="text-text-secondary text-xs mt-1">{{ $t(`account.order_status.${order.status}`) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

definePageMeta({ middleware: 'auth' })
useHead({ title: `${t('account.title')} — Vitesse Eco` })

// Fetch orders (will be populated when orders exist)
const orders = ref<any[]>([])

async function handleLogout() {
  await auth.logout()
  navigateTo(localePath('/'))
}
</script>
