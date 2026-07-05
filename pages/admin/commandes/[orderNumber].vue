<template>
  <div v-if="order">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3 mb-1">
      <NuxtLink :to="localePath('/admin/commandes')" class="text-on-surface-muted hover:text-on-surface" :aria-label="$t('admin.detail_back')">
        <Icon name="heroicons:arrow-left" class="w-5 h-5 rtl:-scale-x-100" />
      </NuxtLink>
      <h1 class="text-2xl font-display font-bold font-mono">{{ order.orderNumber }}</h1>
      <span class="inline-block rounded-full px-3 py-1 text-sm font-medium" :class="statusClass(order.status)">
        {{ statusLabel(order.status) }}
      </span>
    </div>
    <p class="text-sm text-on-surface-muted mb-6 ms-8">
      {{ $t('admin.placed_on', { date: formatDate(order.createdAt) }) }}
      <span v-if="order.paymentMethod"> · {{ $t('admin.payment') }} : {{ paymentLabel(order.paymentMethod) }}</span>
      <span v-if="order.shippingMethod"> · {{ $t('admin.shipping') }} : {{ order.shippingMethod }}</span>
    </p>

    <!-- Status actions -->
    <div v-if="nextStatuses.length" class="bg-surface border border-surface-2 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
      <span class="text-sm text-on-surface-muted me-1">{{ $t('admin.set_status') }}</span>
      <button
        v-for="s in nextStatuses"
        :key="s"
        type="button"
        class="rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-200 disabled:opacity-50"
        :class="s === 'cancelled'
          ? 'bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20'
          : 'bg-accent text-primary hover:bg-accent/90'"
        :disabled="saving"
        @click="changeStatus(s)"
      >
        {{ statusLabel(s) }}
      </button>
    </div>

    <div class="grid lg:grid-cols-3 gap-6">
      <!-- Items + totals -->
      <div class="lg:col-span-2 space-y-6">
        <section class="bg-surface border border-surface-2 rounded-xl overflow-hidden">
          <h2 class="px-4 pt-4 pb-2 font-semibold">{{ $t('admin.items') }}</h2>
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="(item, i) in items" :key="i" class="border-t border-surface-2">
                <td class="px-4 py-3">
                  <div class="font-medium">{{ item.productName || item.name || item.sku }}</div>
                  <div class="text-xs text-on-surface-muted">
                    <span v-if="item.color">{{ item.color }} · </span>
                    <span v-if="item.sku">SKU {{ item.sku }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-on-surface-muted whitespace-nowrap">× {{ item.quantity }}</td>
                <td class="px-4 py-3 text-end font-medium whitespace-nowrap">{{ formatPrice((item.price || 0) * (item.quantity || 1)) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="border-t border-surface-2 px-4 py-3 text-sm space-y-1.5">
            <div class="flex justify-between text-on-surface-muted"><span>{{ $t('admin.subtotal') }}</span><span>{{ formatPrice(order.subtotal) }}</span></div>
            <div class="flex justify-between text-on-surface-muted"><span>{{ $t('admin.shipping') }}</span><span>{{ formatPrice(order.shippingCost) }}</span></div>
            <div v-if="order.discount > 0" class="flex justify-between text-on-surface-muted">
              <span>{{ $t('admin.discount') }}<template v-if="order.promoCode"> ({{ order.promoCode }})</template></span>
              <span>−{{ formatPrice(order.discount) }}</span>
            </div>
            <div class="flex justify-between font-bold text-base pt-1.5 border-t border-surface-2"><span>{{ $t('admin.total') }}</span><span>{{ formatPrice(order.total) }}</span></div>
          </div>
        </section>

        <!-- Tracking -->
        <section class="bg-surface border border-surface-2 rounded-xl p-4">
          <h2 class="font-semibold mb-3">{{ $t('admin.tracking_title') }}</h2>
          <div class="flex gap-2">
            <input
              v-model="trackingInput"
              type="text"
              maxlength="100"
              :placeholder="$t('admin.tracking_placeholder')"
              class="flex-1 bg-bg border border-surface-2 rounded-lg px-3 py-2.5 text-sm placeholder:text-on-surface-muted focus:outline-none focus:border-accent"
            >
            <button
              type="button"
              class="rounded-lg bg-accent text-primary px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              :disabled="saving || trackingInput === (order.trackingNumber || '')"
              @click="saveTracking"
            >
              {{ $t('admin.save') }}
            </button>
          </div>
        </section>

        <!-- Internal notes -->
        <section class="bg-surface border border-surface-2 rounded-xl p-4">
          <h2 class="font-semibold mb-3">{{ $t('admin.notes_title') }}</h2>
          <textarea
            v-model="notesInput"
            rows="3"
            maxlength="2000"
            :placeholder="$t('admin.notes_placeholder')"
            class="w-full bg-bg border border-surface-2 rounded-lg px-3 py-2.5 text-sm placeholder:text-on-surface-muted focus:outline-none focus:border-accent resize-y"
          />
          <div class="flex justify-end mt-2">
            <button
              type="button"
              class="rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
              :disabled="saving || notesInput === (order.notes || '')"
              @click="saveNotes"
            >
              {{ $t('admin.save_notes') }}
            </button>
          </div>
        </section>
      </div>

      <!-- Customer + addresses -->
      <div class="space-y-6">
        <section class="bg-surface border border-surface-2 rounded-xl p-4">
          <h2 class="font-semibold mb-3">{{ $t('admin.customer') }}</h2>
          <div class="text-sm space-y-1">
            <div class="font-medium">{{ snapshot.name || '—' }}</div>
            <a v-if="snapshot.email" :href="`mailto:${snapshot.email}`" class="block text-accent break-all">{{ snapshot.email }}</a>
            <a v-if="snapshot.phone" :href="`tel:${snapshot.phone}`" class="block text-on-surface-muted">{{ snapshot.phone }}</a>
            <div class="text-xs text-on-surface-muted pt-1">
              {{ order.customerId ? $t('admin.account_customer') : $t('admin.guest_order') }}
            </div>
          </div>
        </section>

        <section v-if="order.shippingAddress" class="bg-surface border border-surface-2 rounded-xl p-4">
          <h2 class="font-semibold mb-3">{{ $t('admin.shipping_address') }}</h2>
          <AddressBlock :address="order.shippingAddress" />
        </section>

        <section v-if="order.billingAddress && !sameAddresses" class="bg-surface border border-surface-2 rounded-xl p-4">
          <h2 class="font-semibold mb-3">{{ $t('admin.billing_address') }}</h2>
          <AddressBlock :address="order.billingAddress" />
        </section>

        <section v-if="order.stripePaymentId" class="bg-surface border border-surface-2 rounded-xl p-4">
          <h2 class="font-semibold mb-3">{{ $t('admin.payment_ref') }}</h2>
          <div class="text-sm font-mono break-all text-on-surface-muted">{{ order.stripePaymentId }}</div>
        </section>
      </div>
    </div>
  </div>

  <div v-else class="p-12 text-center text-on-surface-muted">
    <div v-if="pending" class="space-y-3 max-w-lg mx-auto">
      <div v-for="i in 4" :key="i" class="h-12 bg-surface-2 rounded animate-pulse" />
    </div>
    <template v-else>
      <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 mx-auto mb-3 opacity-50" />
      <p>{{ $t('admin.not_found') }}</p>
      <NuxtLink :to="localePath('/admin/commandes')" class="text-accent underline mt-2 inline-block">{{ $t('admin.detail_back') }}</NuxtLink>
    </template>
  </div>
</template>

<script setup lang="ts">
import { STATUS_LABELS, STATUS_CLASSES, NEXT_STATUSES } from '~/utils/adminOrderStatus'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const orderNumber = route.params.orderNumber as string
useHead({ title: `${orderNumber} — Admin Vitesse Eco` })

const toast = useToast()
const saving = ref(false)

const { data: order, pending, refresh } = await useFetch(`/api/admin/orders/${orderNumber}`)

const items = computed<any[]>(() => (Array.isArray(order.value?.items) ? order.value.items : []))
const snapshot = computed<any>(() => order.value?.customerSnapshot || {})
const nextStatuses = computed(() => (order.value ? NEXT_STATUSES[order.value.status] ?? [] : []))
const sameAddresses = computed(
  () => JSON.stringify(order.value?.shippingAddress) === JSON.stringify(order.value?.billingAddress)
)

const trackingInput = ref('')
const notesInput = ref('')
watch(
  order,
  (o) => {
    trackingInput.value = o?.trackingNumber || ''
    notesInput.value = o?.notes || ''
  },
  { immediate: true }
)

async function patch(payload: Record<string, unknown>, successMessage: string) {
  saving.value = true
  try {
    await $fetch(`/api/admin/orders/${orderNumber}`, { method: 'PATCH', body: payload })
    await refresh()
    toast.success(successMessage)
  } catch (e: any) {
    toast.error(e?.data?.message || t('admin.update_failed'))
  } finally {
    saving.value = false
  }
}

function changeStatus(status: string) {
  if (status === 'cancelled' && !window.confirm(t('admin.cancel_confirm', { number: orderNumber }))) return
  patch({ status }, t('admin.status_updated', { status: statusLabel(status) }))
}

function saveTracking() {
  patch({ trackingNumber: trackingInput.value }, t('admin.tracking_saved'))
}

function saveNotes() {
  patch({ notes: notesInput.value }, t('admin.notes_saved'))
}

const statusLabel = (s: string) => (STATUS_LABELS[s] ? t(STATUS_LABELS[s]) : s)
const statusClass = (s: string) => STATUS_CLASSES[s] ?? 'bg-surface-2 text-on-surface-muted'

const PAYMENT_LABELS: Record<string, string> = {
  paypal: 'admin.payment_paypal',
  in_store: 'admin.payment_in_store',
  stripe: 'admin.payment_stripe',
}
const paymentLabel = (code: string) => (PAYMENT_LABELS[code] ? t(PAYMENT_LABELS[code]) : code)

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString(locale.value, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatPrice(n: number) {
  return (n ?? 0).toLocaleString(locale.value, { style: 'currency', currency: 'EUR' })
}
</script>
