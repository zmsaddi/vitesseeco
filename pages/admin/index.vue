<template>
  <div>
    <h1 class="text-2xl font-display font-bold mb-6">Tableau de bord</h1>

    <div v-if="pending" class="grid sm:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="h-28 bg-surface-2 rounded-xl animate-pulse" />
    </div>

    <template v-else-if="stats">
      <!-- KPI tiles -->
      <div class="grid sm:grid-cols-3 gap-4 mb-8">
        <div v-for="tile in kpiTiles" :key="tile.label" class="bg-surface border border-surface-2 rounded-xl p-5">
          <div class="text-sm text-on-surface-muted mb-2">{{ tile.label }}</div>
          <div class="text-2xl font-bold">{{ formatPrice(tile.revenue) }}</div>
          <div class="text-sm text-on-surface-muted mt-1">
            {{ tile.orders }} commande{{ tile.orders > 1 ? 's' : '' }}
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-6 mb-8">
        <!-- Funnel -->
        <section class="bg-surface border border-surface-2 rounded-xl p-5">
          <h2 class="font-semibold mb-4">Entonnoir de conversion <span class="text-xs text-on-surface-muted font-normal">(30 jours)</span></h2>
          <div class="space-y-3">
            <div v-for="step in funnelSteps" :key="step.label">
              <div class="flex justify-between text-sm mb-1">
                <span>{{ step.label }}</span>
                <span class="font-semibold">{{ step.value }}</span>
              </div>
              <div class="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div class="h-full bg-accent rounded-full" :style="{ width: step.pct + '%' }" />
              </div>
            </div>
          </div>
          <p v-if="conversionRate !== null" class="text-sm text-on-surface-muted mt-4">
            Taux de conversion panier → commande : <span class="text-on-surface font-semibold">{{ conversionRate }}%</span>
          </p>
        </section>

        <!-- Status distribution -->
        <section class="bg-surface border border-surface-2 rounded-xl p-5">
          <h2 class="font-semibold mb-4">Commandes par statut</h2>
          <div class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="(label, key) in STATUS_LABELS"
              :key="key"
              :to="`/admin/commandes?status=${key}`"
              class="rounded-full px-3.5 py-1.5 text-sm border border-surface-2 hover:border-accent transition-colors duration-200"
              :class="STATUS_CLASSES[key]"
            >
              {{ label }} · {{ stats.statusCounts[key] ?? 0 }}
            </NuxtLink>
          </div>

          <h2 class="font-semibold mt-6 mb-3">Meilleures ventes <span class="text-xs text-on-surface-muted font-normal">(30 jours)</span></h2>
          <ol v-if="stats.topProducts.length" class="space-y-2 text-sm">
            <li v-for="(p, i) in stats.topProducts" :key="p.name" class="flex justify-between gap-3">
              <span class="truncate"><span class="text-on-surface-muted me-2">{{ i + 1 }}.</span>{{ p.name }}</span>
              <span class="font-semibold shrink-0">× {{ p.qty }}</span>
            </li>
          </ol>
          <p v-else class="text-sm text-on-surface-muted">Aucune vente sur la période.</p>
        </section>
      </div>

      <!-- Low stock alert -->
      <section v-if="stats.lowStock.length" class="bg-surface border border-warning/40 rounded-xl p-5 mb-8">
        <h2 class="font-semibold mb-3 flex items-center gap-2">
          <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-warning" />
          Stock faible
        </h2>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="item in stats.lowStock"
            :key="item.productId"
            to="/admin/stock"
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-mono hover:bg-surface-2/70"
            :class="item.stock === 0 ? 'text-danger' : 'text-warning'"
          >
            {{ item.sku || item.productId }} : {{ item.stock }}
          </NuxtLink>
        </div>
      </section>

      <!-- Recent orders -->
      <section class="bg-surface border border-surface-2 rounded-xl overflow-hidden">
        <div class="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 class="font-semibold">Dernières commandes</h2>
          <NuxtLink to="/admin/commandes" class="text-sm text-accent hover:underline">Tout voir →</NuxtLink>
        </div>
        <table v-if="stats.recentOrders.length" class="w-full text-sm">
          <tbody>
            <tr
              v-for="o in stats.recentOrders"
              :key="o.orderNumber ?? ''"
              class="border-t border-surface-2 hover:bg-surface-2/50 cursor-pointer"
              @click="navigateTo(`/admin/commandes/${o.orderNumber}`)"
            >
              <td class="px-5 py-3 font-mono font-semibold text-accent">{{ o.orderNumber }}</td>
              <td class="px-5 py-3">{{ o.customerName || '—' }}</td>
              <td class="px-5 py-3 text-on-surface-muted hidden sm:table-cell">{{ formatDate(o.createdAt) }}</td>
              <td class="px-5 py-3 font-semibold whitespace-nowrap">{{ formatPrice(o.total) }}</td>
              <td class="px-5 py-3">
                <span class="inline-block rounded-full px-2.5 py-1 text-xs font-medium" :class="STATUS_CLASSES[o.status]">
                  {{ STATUS_LABELS[o.status] ?? o.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="px-5 pb-5 text-sm text-on-surface-muted">Aucune commande pour le moment.</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { STATUS_LABELS, STATUS_CLASSES } from '~/utils/adminOrderStatus'

definePageMeta({ middleware: 'admin', layout: 'admin' })
useHead({ title: 'Tableau de bord — Admin Vitesse Eco' })

const { data: stats, pending } = await useFetch('/api/admin/stats')

const kpiTiles = computed(() => {
  if (!stats.value) return []
  const p = stats.value.periods
  return [
    { label: 'Dernières 24 h', ...p.h24 },
    { label: '7 derniers jours', ...p.d7 },
    { label: '30 derniers jours', ...p.d30 },
  ]
})

const funnelSteps = computed(() => {
  const f = stats.value?.funnel
  if (!f) return []
  const max = Math.max(f.addToCart, f.checkoutStarted, f.orderCreated, 1)
  return [
    { label: 'Ajouts au panier', value: f.addToCart, pct: Math.round((f.addToCart / max) * 100) },
    { label: 'Checkouts démarrés', value: f.checkoutStarted, pct: Math.round((f.checkoutStarted / max) * 100) },
    { label: 'Commandes créées', value: f.orderCreated, pct: Math.round((f.orderCreated / max) * 100) },
  ]
})

const conversionRate = computed(() => {
  const f = stats.value?.funnel
  if (!f || !f.addToCart) return null
  return Math.round((f.orderCreated / f.addToCart) * 100)
})

function formatPrice(n: number) {
  return (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>
