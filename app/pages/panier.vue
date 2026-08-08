<script setup lang="ts">
/**
 * The basket.
 *
 * Every figure on this page comes from the server. The client holds ids and
 * quantities and nothing else, so a basket restored from last week cannot show
 * a price that has since changed — it has no price to show until the server
 * supplies one.
 */
const cart = useCart()
const localePath = useLocalePath()
const { locale, t } = useI18n()
const { formatDecimal } = useFormatPrice()

interface PricedLine {
  productId: string
  slug: string
  name: string
  color: string | null
  image: string | null
  quantity: number
  unitPrice: string
  lineTotal: string
  available: number
}
interface Pricing {
  lines: PricedLine[]
  subtotal: string
  discount: string
  total: string
  promo: { code: string; applied: boolean; reason?: string } | null
}

const pricing = ref<Pricing | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  cart.restore()
  await refresh()
})

async function refresh(): Promise<void> {
  if (cart.isEmpty.value) {
    pricing.value = null
    return
  }
  pending.value = true
  error.value = null
  try {
    pricing.value = await $fetch<Pricing>('/api/cart/price', {
      method: 'POST',
      body: {
        cart: {
          lines: cart.lines.value,
          ...(cart.promoCode.value ? { promoCode: cart.promoCode.value } : {}),
        },
        locale: locale.value,
      },
    })
  } catch (err: unknown) {
    const data = (err as { data?: { messageKey?: string } })?.data
    error.value = data?.messageKey ? t(data.messageKey) : t('errors.internal')
    pricing.value = null
  } finally {
    pending.value = false
  }
}

async function setQuantity(line: { productId: string; quantity: number }, input: HTMLInputElement): Promise<void> {
  // A blank box is not a quantity of zero. Clearing the field and tabbing away
  // used to delete the line outright with no undo, because Number('') is 0 and
  // the store reads a non-positive quantity as "remove". Blank means the
  // customer is mid-edit, not that they want their basket emptied — so the box
  // goes back to what it was. The input is written directly because :value is
  // bound to a quantity that did not change, so Vue has nothing to re-render.
  const typed = input.value.trim()
  const quantity = Number(typed)
  if (!typed || !Number.isInteger(quantity) || quantity < 1) {
    input.value = String(line.quantity)
    return
  }
  cart.setQuantity(line.productId, quantity)
  await refresh()
}

async function remove(productId: string): Promise<void> {
  cart.remove(productId)
  await refresh()
}

const promoInput = ref('')

/**
 * A basket that cannot be fulfilled must not walk to the payment form.
 *
 * The shortfall was already shown on each line, and the button beside it was a
 * plain link that ignored it — so a customer could reach Stripe with two of a
 * bike the shop has one of, and the refusal would arrive after they had paid.
 */
const shortfall = computed(() =>
  (pricing.value?.lines ?? []).filter((line) => line.available < line.quantity)
)
async function applyPromo(): Promise<void> {
  cart.applyPromo(promoInput.value)
  await refresh()
}

useSeoMeta({ title: () => t('cart.title'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-10">
    <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('cart.title') }}</h1>

    <!-- The basket lives in localStorage, so the server cannot render it and
         any server-rendered guess would flash and then be replaced. -->
    <ClientOnly>
      <p v-if="pending && !pricing" class="mt-8 text-content-muted">{{ $t('common.loading') }}</p>

      <div v-else-if="cart.isEmpty.value" class="mt-8">
        <p class="text-content-muted">{{ $t('cart.empty') }}</p>
        <NuxtLink :to="localePath('/produits')" class="btn-primary mt-6">
          {{ $t('cart.browse') }}
        </NuxtLink>
      </div>

      <div v-else-if="pricing" class="mt-8 grid gap-8 lg:grid-cols-3">
        <ul class="space-y-4 lg:col-span-2">
          <li v-for="line in pricing.lines" :key="line.productId" class="card flex gap-4 p-4">
            <NuxtLink :to="localePath(`/produits/${line.slug}`)" class="shrink-0">
              <NuxtImg
                v-if="line.image"
                :src="line.image"
                :alt="line.name"
                width="96"
                height="96"
                class="h-24 w-24 rounded-lg object-cover"
              />
            </NuxtLink>

            <div class="min-w-0 flex-1">
              <NuxtLink :to="localePath(`/produits/${line.slug}`)" class="font-medium text-content-strong">
                {{ line.name }}
              </NuxtLink>
              <p v-if="line.color" class="text-sm text-content-muted">{{ line.color }}</p>
              <p class="mt-1 text-sm text-content-muted">{{ formatDecimal(line.unitPrice) }}</p>

              <p v-if="line.available < line.quantity" class="mt-1 text-sm text-danger">
                {{ line.available > 0
                  ? $t('cart.only_left', { count: line.available })
                  : $t('products.out_of_stock') }}
              </p>

              <div class="mt-3 flex items-center gap-3">
                <label class="flex items-center gap-2">
                  <span class="sr-only">{{ $t('product.quantity') }}</span>
                  <input
                    :value="line.quantity"
                    type="number"
                    min="1"
                    :max="Math.max(1, Math.min(10, line.available))"
                    class="field w-20"
                    @change="setQuantity(line, $event.target as HTMLInputElement)"
                  />
                </label>
                <button type="button" class="text-sm text-content-muted hover:text-danger" @click="remove(line.productId)">
                  {{ $t('cart.remove') }}
                </button>
              </div>
            </div>

            <p class="shrink-0 font-semibold text-content-strong">{{ formatDecimal(line.lineTotal) }}</p>
          </li>
        </ul>

        <aside class="card h-fit p-5">
          <h2 class="font-display font-bold text-content-strong">{{ $t('cart.summary') }}</h2>

          <dl class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-content-muted">{{ $t('cart.subtotal') }}</dt>
              <dd class="text-content-strong">{{ formatDecimal(pricing.subtotal) }}</dd>
            </div>
            <div v-if="pricing.discount !== '0.00'" class="flex justify-between">
              <dt class="text-content-muted">{{ $t('cart.discount') }}</dt>
              <dd class="text-success">−{{ formatDecimal(pricing.discount) }}</dd>
            </div>
            <div class="flex justify-between border-t border-surface-border pt-2 text-base font-bold">
              <dt class="text-content-strong">{{ $t('cart.total') }}</dt>
              <dd class="text-content-strong">{{ formatDecimal(pricing.total) }}</dd>
            </div>
          </dl>

          <p class="mt-2 text-xs text-content-muted">{{ $t('cart.shipping_at_checkout') }}</p>

          <div class="mt-5">
            <label class="text-sm text-content-muted" for="promo">{{ $t('cart.promo') }}</label>
            <div class="mt-1 flex gap-2">
              <input id="promo" v-model="promoInput" type="text" class="field" :placeholder="$t('cart.promo')" />
              <button type="button" class="btn-secondary" @click="applyPromo">{{ $t('cart.apply') }}</button>
            </div>
            <!-- A rejected code is stated. Silently ignoring one and charging
                 the higher total is how a customer is billed what they did not
                 agree to. -->
            <p v-if="pricing.promo && !pricing.promo.applied" class="mt-2 text-sm text-danger">
              {{ $t('cart.promo_rejected') }}
            </p>
            <p v-else-if="pricing.promo?.applied" class="mt-2 text-sm text-success">
              {{ $t('cart.promo_applied', { code: pricing.promo.code }) }}
            </p>
          </div>

          <p v-if="shortfall.length" role="alert" class="mt-6 text-sm text-danger">
            {{ $t('cart.fix_quantities') }}
          </p>
          <NuxtLink
            v-if="!shortfall.length"
            :to="localePath('/commande')"
            class="btn-primary mt-6 w-full"
          >
            {{ $t('cart.checkout') }}
          </NuxtLink>
          <span v-else class="btn-primary mt-2 w-full cursor-not-allowed opacity-50" aria-disabled="true">
            {{ $t('cart.checkout') }}
          </span>
        </aside>
      </div>

      <p v-else-if="error" class="mt-8 text-danger">{{ error }}</p>
    </ClientOnly>
  </div>
</template>
