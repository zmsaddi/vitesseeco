<script setup lang="ts">
/**
 * One order, as the customer who placed it.
 *
 * The same order the admin page shows, minus everything that is none of the
 * customer's business and plus the one thing they actually come back for: the
 * ability to buy it again. Two years is a long warranty, so this page is opened
 * long after the sale — the timeline and the tracking number are what makes it
 * worth opening.
 *
 * Every figure here is a string the server computed. Nothing on this page does
 * arithmetic with money.
 */
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()
const cart = useCart()
const { formatLongDate, formatDateTime } = useFormatDate()
const { formatDecimal, formatPercent } = useFormatPrice()

const orderNumber = computed(() => String(route.params.orderNumber ?? ''))

interface Address {
  firstName: string | null
  lastName: string | null
  phone: string | null
  line1: string | null
  line2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
}

interface OrderItem {
  productId: string
  name: string
  color: string | null
  image: string | null
  quantity: number
  unitPrice: string
  lineTotal: string
  /** Null when the product is no longer published — there is nothing to link to. */
  slug: string | null
  /** Null when the catalogue could not be asked, which is not the same as zero. */
  available: number | null
}

interface CustomerOrder {
  orderNumber: string
  status: string
  paymentMethod: string
  shippingMethod: string
  subtotal: string
  discount: string
  shipping: string
  total: string
  vat: { ratePercent: number; amount: string }
  promoCode: string | null
  shippingAddress: Address | null
  trackingNumber: string | null
  carrier: string | null
  notes: string | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  items: OrderItem[]
}

// Stated explicitly: the route is wrapped by defineRoute, so its shape cannot be
// inferred through the wrapper.
const { data: order, status: loadState } = await useFetch<CustomerOrder>(
  () => `/api/account/orders/${orderNumber.value}`
)

/** Colour by meaning, so a cancelled order never reads as a successful one. */
function statusTone(status: string): string {
  if (status === 'cancelled') return 'bg-danger-subtle text-danger'
  if (status === 'delivered') return 'bg-success-subtle text-success'
  if (status === 'awaiting_payment') return 'bg-warning-subtle text-warning'
  return 'bg-accent-subtle text-accent'
}

/**
 * The timeline is built from the timestamps that are actually set, never from
 * the status: an order can be cancelled after payment, and a fixed list of
 * steps would either hide the refund or invent a delivery that never happened.
 */
const STEPS = [
  { key: 'placed', labelKey: 'order.step_placed' },
  { key: 'paid', labelKey: 'order_status.paid' },
  { key: 'shipped', labelKey: 'order_status.shipped' },
  { key: 'delivered', labelKey: 'order_status.delivered' },
  { key: 'cancelled', labelKey: 'order_status.cancelled' },
] as const

const timeline = computed(() => {
  const current = order.value
  if (!current) return []
  const at: Record<string, string | null> = {
    placed: current.createdAt,
    paid: current.paidAt,
    shipped: current.shippedAt,
    delivered: current.deliveredAt,
    cancelled: current.cancelledAt,
  }
  return STEPS.filter((step) => Boolean(at[step.key])).map((step) => ({
    key: step.key,
    labelKey: step.labelKey,
    at: at[step.key] as string,
  }))
})

/** The address as it goes on a label — one line per line, in postal order. */
const addressLines = computed<string[]>(() => {
  const address = order.value?.shippingAddress
  if (!address) return []
  return [
    [address.firstName, address.lastName].filter(Boolean).join(' '),
    address.line1,
    address.line2,
    [address.postalCode, address.city].filter(Boolean).join(' '),
    address.country,
  ].filter((line): line is string => Boolean(line && line.trim()))
})

/**
 * What reordering would actually put in the basket, and how that differs from
 * what is on this page.
 *
 * A basket that quietly differs from the order that was clicked is worse than
 * an explanation, so the difference is computed before anything is added and
 * the customer is told about it rather than discovering it at checkout.
 */
const reorderPlan = computed(() => {
  const lines: Array<{ productId: string; quantity: number }> = []
  const notes: Array<{ productId: string; name: string; label: string }> = []

  for (const item of order.value?.items ?? []) {
    // Unknown availability means the catalogue could not be asked, not that the
    // product is gone. Let it through: the basket reprices on the server and
    // will say so there.
    if (item.available === null) {
      lines.push({ productId: item.productId, quantity: item.quantity })
      continue
    }

    if (item.available <= 0) {
      notes.push({
        productId: item.productId,
        name: item.name,
        label: item.slug ? t('products.out_of_stock') : t('order.reorder_withdrawn'),
      })
      continue
    }

    const quantity = Math.min(item.quantity, item.available)
    lines.push({ productId: item.productId, quantity })
    if (quantity < item.quantity) {
      notes.push({
        productId: item.productId,
        name: item.name,
        label: t('cart.only_left', { count: item.available }),
      })
    }
  }

  return { lines, notes }
})

const explaining = ref(false)

async function startReorder(): Promise<void> {
  // First click explains, second click acts. When nothing has changed there is
  // nothing to explain and one click is the whole interaction.
  if (reorderPlan.value.notes.length > 0 && !explaining.value) {
    explaining.value = true
    return
  }
  if (reorderPlan.value.lines.length === 0) return

  for (const line of reorderPlan.value.lines) {
    cart.add(line.productId, line.quantity)
  }
  await navigateTo(localePath('/panier'))
}

useSeoMeta({ title: () => `${orderNumber.value} — ${t('account.orders')}`, robots: 'noindex' })
</script>

<template>
  <div class="container-page py-10">
    <NuxtLink :to="localePath('/compte')" class="text-sm text-content-muted hover:text-content-strong">
      <Icon name="ph:arrow-left" class="inline h-4 w-4 align-[-2px] rtl:rotate-180" />
      {{ $t('account.orders') }}
    </NuxtLink>

    <p v-if="loadState === 'pending'" class="mt-6 text-content-muted">{{ $t('common.loading') }}</p>
    <p v-else-if="!order" class="mt-6 text-content-muted">{{ $t('errors.not_found') }}</p>

    <template v-else>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <h1 class="font-mono text-2xl font-extrabold text-content-strong">
          <bdi dir="ltr">{{ order.orderNumber }}</bdi>
        </h1>
        <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusTone(order.status)">
          {{ $t(`order_status.${order.status}`) }}
        </span>
        <span class="ms-auto text-sm text-content-muted">{{ formatLongDate(order.createdAt) }}</span>
      </div>

      <div v-if="order.items.length" class="mt-6">
        <button v-if="!explaining" type="button" class="btn-primary" @click="startReorder">
          {{ $t('order.reorder') }}
        </button>

        <!-- Shown before the basket changes, never after. -->
        <div v-else role="status" class="card bg-warning-subtle p-4">
          <p class="font-semibold text-content-strong">{{ $t('order.reorder_changes') }}</p>
          <ul class="mt-2 space-y-1 text-sm">
            <li v-for="note in reorderPlan.notes" :key="note.productId" class="text-content">
              {{ note.name }} — <span class="text-content-muted">{{ note.label }}</span>
            </li>
          </ul>
          <button
            v-if="reorderPlan.lines.length"
            type="button"
            class="btn-primary mt-4"
            @click="startReorder"
          >
            {{ $t('order.reorder_confirm') }}
          </button>
          <p v-else class="mt-3 text-sm text-content-muted">{{ $t('order.reorder_none') }}</p>
        </div>
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-3">
        <section class="card p-5 lg:col-span-2">
          <h2 class="font-display font-bold text-content-strong">{{ $t('order.items') }}</h2>

          <ul class="mt-3 divide-y divide-surface-border">
            <li v-for="item in order.items" :key="item.productId" class="flex items-center gap-4 py-3">
              <!-- A withdrawn product has no page left to link to, so the
                   image stays an image rather than a link that 404s. -->
              <NuxtLink v-if="item.slug" :to="localePath(`/produits/${item.slug}`)" class="shrink-0">
                <NuxtImg
                  v-if="item.image"
                  :src="item.image"
                  :alt="item.name"
                  width="64"
                  height="64"
                  loading="lazy"
                  class="h-16 w-16 rounded-lg object-cover"
                />
              </NuxtLink>
              <NuxtImg
                v-else-if="item.image"
                :src="item.image"
                :alt="item.name"
                width="64"
                height="64"
                loading="lazy"
                class="h-16 w-16 shrink-0 rounded-lg object-cover"
              />

              <div class="min-w-0 flex-1">
                <NuxtLink
                  v-if="item.slug"
                  :to="localePath(`/produits/${item.slug}`)"
                  class="font-medium text-content-strong"
                >
                  {{ item.name }}
                </NuxtLink>
                <p v-else class="font-medium text-content-strong">{{ item.name }}</p>
                <p class="text-sm text-content-muted">
                  <span v-if="item.color">{{ item.color }} · </span>
                  <span>{{ formatDecimal(item.unitPrice) }} × {{ item.quantity }}</span>
                </p>
              </div>

              <span class="shrink-0 font-semibold text-content-strong">{{ formatDecimal(item.lineTotal) }}</span>
            </li>
          </ul>

          <dl class="mt-4 space-y-1 border-t border-surface-border pt-4 text-sm">
            <div class="flex justify-between">
              <dt class="text-content-muted">{{ $t('cart.subtotal') }}</dt>
              <dd class="text-content">{{ formatDecimal(order.subtotal) }}</dd>
            </div>
            <div v-if="order.discount !== '0.00'" class="flex justify-between">
              <dt class="text-content-muted">
                {{ $t('cart.discount') }}<span v-if="order.promoCode"> ({{ order.promoCode }})</span>
              </dt>
              <dd class="text-success">−{{ formatDecimal(order.discount) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-content-muted">{{ $t('checkout.shipping') }}</dt>
              <dd class="text-content">
                {{ order.shipping === '0.00' ? $t('checkout.free') : formatDecimal(order.shipping) }}
              </dd>
            </div>
            <div class="flex justify-between border-t border-surface-border pt-2 text-base font-bold">
              <dt class="text-content-strong">{{ $t('cart.total') }}</dt>
              <dd class="text-content-strong">{{ formatDecimal(order.total) }}</dd>
            </div>
            <div class="flex justify-between text-xs">
              <dt class="text-content-muted">
                {{ $t('order.vat_included') }} ({{ formatPercent(order.vat.ratePercent) }})
              </dt>
              <dd class="text-content-muted">{{ formatDecimal(order.vat.amount) }}</dd>
            </div>
          </dl>
        </section>

        <div class="space-y-6">
          <section class="card p-5">
            <h2 class="font-display font-bold text-content-strong">{{ $t('order.timeline') }}</h2>
            <ol class="mt-3 space-y-3">
              <li v-for="entry in timeline" :key="entry.key" class="flex items-start gap-3">
                <span
                  class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  :class="entry.key === 'cancelled' ? 'bg-danger' : 'bg-accent'"
                  aria-hidden="true"
                />
                <span class="flex-1">
                  <span class="block text-sm font-medium text-content-strong">{{ $t(entry.labelKey) }}</span>
                  <span class="block text-xs text-content-muted">{{ formatDateTime(entry.at) }}</span>
                </span>
              </li>
            </ol>
          </section>

          <section class="card p-5">
            <h2 class="font-display font-bold text-content-strong">{{ $t('order.delivery_address') }}</h2>
            <address v-if="addressLines.length" class="mt-2 not-italic leading-relaxed text-content">
              <span v-for="line in addressLines" :key="line" class="block">{{ line }}</span>
            </address>
            <p v-else class="mt-2 text-sm text-content-muted">{{ $t('order.pickup') }}</p>

            <p v-if="order.trackingNumber" class="mt-4 border-t border-surface-border pt-3 text-sm text-content-muted">
              {{ $t('account.tracking') }}
              <span class="font-mono text-content-strong"><bdi dir="ltr">{{ order.trackingNumber }}</bdi></span>
              <span v-if="order.carrier"> · {{ order.carrier }}</span>
            </p>
          </section>

          <section v-if="order.notes" class="card p-5">
            <h2 class="font-display font-bold text-content-strong">{{ $t('order.your_note') }}</h2>
            <p class="mt-2 whitespace-pre-wrap text-sm text-content">{{ order.notes }}</p>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
