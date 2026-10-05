<script setup lang="ts">
/**
 * Invoices for Payment Link sales — any link.
 *
 * These sales never became orders, so the order screens cannot see them. The
 * page lists what Stripe says was paid through a link and issues the invoice
 * once the item has been handed over — from a phone or tablet, at the counter,
 * because that is where the frame number is read off.
 *
 * The customer signs on a screen of their own. The tablet passed across the
 * counter must show THEIR purchase and what they are confirming, in their
 * language — never the list, which holds every other buyer's name, email and
 * phone number.
 *
 * Name and address are pre-filled from checkout when the link collected them;
 * the first buyers paid before it did, so every field stays editable.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const { formatCents } = useFormatPrice()
const { formatDateTime } = useFormatDate()

interface IssuedInvoice {
  id: string
  number: string
  hostedUrl: string | null
  message: { subject: string; body: string }
}

interface LinkSale {
  sessionId: string
  paidAt: string
  amountTotal: number
  productName: string
  email: string | null
  phone: string | null
  fulfilment: 'pickup' | 'delivery' | null
  deliveryAddress: string | null
  promotionCode: string | null
  paymentMethod: string
  billing: { name?: string; line1?: string; postalCode?: string; city?: string; country?: string }
  invoice: IssuedInvoice | null
  handoverFileId: string | null
  /** Cents, from the link's own metadata; null when it offers no paid delivery. */
  deliveryFee: number | null
  feeUnknown: boolean
  acknowledgement: string[]
  blocked: 'refunded' | 'disputed' | 'stripe_invoice' | null
  stripeInvoiceNumber: string | null
}

interface Draft {
  frameNumber: string
  deliveredOn: string
  name: string
  line1: string
  postalCode: string
  city: string
  country: string
  deliveryFeeCollected: boolean
  signature: string
}

interface ListResponse {
  items: LinkSale[]
  unreadable: number
}

const { data, refresh, status: loadState, error: loadError } = await useFetch<ListResponse>('/api/admin/link-sales')

// The last list that loaded. A refresh that fails must not wipe the page — the
// sale just invoiced, and the error that explains a failed issue, live here.
const shown = ref<ListResponse | null>(data.value ?? null)
watch(data, (value) => {
  if (value) shown.value = value
})

/** Today in the shop's zone, as the date input wants it — read when used, not once. */
function todayInParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}
const today = ref(todayInParis())
function refreshToday(): void {
  today.value = todayInParis()
}
onMounted(() => document.addEventListener('visibilitychange', refreshToday))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', refreshToday))

const drafts = reactive<Record<string, Draft>>({})
watchEffect(() => {
  for (const sale of shown.value?.items ?? []) {
    if (drafts[sale.sessionId]) continue
    drafts[sale.sessionId] = {
      frameNumber: '',
      deliveredOn: today.value,
      name: sale.billing.name ?? '',
      // A delivery address typed at checkout is the best guess for billing.
      line1: sale.billing.line1 ?? sale.deliveryAddress ?? '',
      postalCode: sale.billing.postalCode ?? '',
      city: sale.billing.city ?? '',
      // Unknown stays empty: a guessed country is a wrong invoice.
      country: sale.billing.country ?? '',
      deliveryFeeCollected: sale.fulfilment === 'delivery' && sale.deliveryFee !== null,
      signature: '',
    }
  }
})

const issuing = ref<string | null>(null)
const error = ref<{ sessionId: string; message: string } | null>(null)
const notice = ref<{ sessionId: string; message: string } | null>(null)

function isComplete(draft: Draft): boolean {
  return [draft.signature, draft.frameNumber, draft.deliveredOn, draft.name, draft.line1, draft.postalCode, draft.city, draft.country]
    .every((value) => value.trim().length > 0)
}

function canIssue(sale: LinkSale): boolean {
  // A delivery sale whose link settings could not be read waits: issuing it
  // without the fee would be guessing.
  return !(sale.fulfilment === 'delivery' && sale.feeUnknown)
}

// ── The customer's own signing screen ─────────────────────────────────────────

const signing = ref<LinkSale | null>(null)
const pendingSignature = ref('')

function openSigning(sale: LinkSale): void {
  pendingSignature.value = ''
  signing.value = sale
}

function confirmSignature(): void {
  if (!signing.value || !pendingSignature.value) return
  drafts[signing.value.sessionId]!.signature = pendingSignature.value
  signing.value = null
}

// ── Issuing ───────────────────────────────────────────────────────────────────

async function issue(sale: LinkSale): Promise<void> {
  const draft = drafts[sale.sessionId]
  if (!draft || !isComplete(draft) || issuing.value || !canIssue(sale)) return
  refreshToday()
  if (draft.deliveredOn > today.value) draft.deliveredOn = today.value
  if (!window.confirm(t('admin.confirm_issue', { frame: draft.frameNumber.trim() }))) return
  issuing.value = sale.sessionId
  error.value = null
  notice.value = null
  try {
    const result = await $fetch<{ invoice: IssuedInvoice & { resumed: boolean } }>('/api/admin/link-sales/invoice', {
      method: 'POST',
      body: {
        sessionId: sale.sessionId,
        frameNumber: draft.frameNumber,
        deliveredOn: draft.deliveredOn,
        billing: {
          name: draft.name,
          line1: draft.line1,
          postalCode: draft.postalCode,
          city: draft.city,
          country: draft.country,
        },
        deliveryFeeCollected: sale.fulfilment === 'delivery' && sale.deliveryFee !== null && draft.deliveryFeeCollected,
        signature: draft.signature,
      },
    })
    // Shown at once, whatever the refresh below does.
    sale.invoice = result.invoice
    if (result.invoice.resumed) notice.value = { sessionId: sale.sessionId, message: t('admin.invoice_resumed') }
  } catch (err: unknown) {
    const payload = (err as { data?: { messageKey?: string } })?.data
    error.value = {
      sessionId: sale.sessionId,
      message: payload?.messageKey ? t(payload.messageKey) : t('errors.internal'),
    }
  } finally {
    // Refreshed even after a failure: the invoice may exist although the
    // response was lost, and the list shows what Stripe actually holds.
    await refresh()
    issuing.value = null
  }
}

function mailto(sale: LinkSale): string {
  const message = sale.invoice!.message
  return `mailto:${encodeURIComponent(sale.email ?? '')}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`
}

function whatsapp(sale: LinkSale): string {
  const digits = (sale.phone ?? '').replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(sale.invoice!.message.body)}`
}

useSeoMeta({ title: () => t('admin.invoices'), robots: 'noindex' })
</script>

<template>
  <div class="container-page">
    <h1 class="font-display text-2xl font-extrabold text-content-strong">{{ $t('admin.invoices') }}</h1>
    <p class="mt-2 max-w-prose text-sm text-content-muted">{{ $t('admin.invoices_intro') }}</p>

    <div v-if="loadError" class="card mt-6 flex flex-wrap items-center justify-between gap-3 p-4" role="alert">
      <p class="text-sm text-danger">{{ $t('admin.list_failed') }}</p>
      <button type="button" class="btn-secondary h-10 px-4 text-sm" @click="refresh()">{{ $t('admin.retry') }}</button>
    </div>
    <p v-if="shown?.unreadable" class="mt-4 text-sm text-content-muted">
      {{ $t('admin.some_unreadable', { count: shown.unreadable }) }}
    </p>

    <p v-if="loadState === 'success' && !shown?.items.length" class="card mt-6 p-6 text-content-muted">
      {{ $t('admin.no_link_sales') }}
    </p>

    <ul class="mt-6 grid gap-4">
      <li v-for="sale in shown?.items ?? []" :key="sale.sessionId" class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-content-strong">{{ sale.productName }}</p>
            <p class="mt-1 text-sm text-content-muted">
              {{ formatDateTime(sale.paidAt) }} · {{ sale.paymentMethod }}
              <span v-if="sale.promotionCode"> · {{ sale.promotionCode }}</span>
            </p>
          </div>
          <p class="text-lg font-extrabold text-content-strong">{{ formatCents(sale.amountTotal) }}</p>
        </div>

        <dl class="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt class="inline text-content-muted">{{ $t('admin.customer') }}:</dt>
            <dd class="inline text-content">{{ sale.billing.name || '—' }} · {{ sale.email || '—' }} · {{ sale.phone || '—' }}</dd>
          </div>
          <div>
            <dt class="inline text-content-muted">
              {{ sale.fulfilment === 'delivery' ? $t('admin.home_delivery') : $t('admin.pickup') }}
            </dt>
            <dd v-if="sale.fulfilment === 'delivery'" class="inline text-content">: {{ sale.deliveryAddress || '—' }}</dd>
          </div>
        </dl>

        <!-- Issued: the document and two ways to hand it over. -->
        <div v-if="sale.invoice" class="mt-4 flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-accent-subtle px-3 py-1 text-sm font-semibold text-accent">
            {{ $t('admin.invoiced', { number: sale.invoice.number }) }}
          </span>
          <a :href="`/api/admin/link-sales/invoice-pdf?invoice=${sale.invoice.id}`" target="_blank" rel="noopener" class="btn-secondary h-10 px-4 text-sm">
            {{ $t('admin.download_pdf') }}
          </a>
          <a
            v-if="sale.handoverFileId"
            :href="`/api/admin/link-sales/handover?file=${sale.handoverFileId}`"
            target="_blank"
            rel="noopener"
            class="btn-secondary h-10 px-4 text-sm"
          >
            {{ $t('admin.download_handover') }}
          </a>
          <a v-if="sale.email" :href="mailto(sale)" class="btn-secondary h-10 px-4 text-sm">{{ $t('admin.send_email') }}</a>
          <a v-if="sale.phone" :href="whatsapp(sale)" target="_blank" rel="noopener" class="btn-secondary h-10 px-4 text-sm">
            {{ $t('admin.send_whatsapp') }}
          </a>
          <p v-if="notice?.sessionId === sale.sessionId" class="w-full text-sm text-content-muted" role="status">{{ notice.message }}</p>
        </div>

        <!-- Cannot be invoiced here, and why. -->
        <p v-else-if="sale.blocked" class="mt-4 text-sm text-danger" role="status">
          {{
            sale.blocked === 'stripe_invoice'
              ? $t('admin.blocked_stripe_invoice', { number: sale.stripeInvoiceNumber ?? '—' })
              : sale.blocked === 'disputed'
                ? $t('admin.blocked_disputed')
                : $t('admin.blocked_refunded')
          }}
        </p>

        <!-- Not yet: the handover form. -->
        <form v-else-if="drafts[sale.sessionId]" class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="issue(sale)">
          <label class="text-sm">
            <span class="text-content-muted">{{ $t('admin.frame_number') }}</span>
            <input v-model="drafts[sale.sessionId]!.frameNumber" class="field mt-1 w-full" required autocapitalize="characters" autocomplete="off">
          </label>
          <label class="text-sm">
            <span class="text-content-muted">{{ $t('admin.delivered_on') }}</span>
            <input v-model="drafts[sale.sessionId]!.deliveredOn" type="date" class="field mt-1 w-full" required :max="today">
          </label>
          <label class="text-sm sm:col-span-2">
            <span class="text-content-muted">{{ $t('admin.billing_name') }}</span>
            <input v-model="drafts[sale.sessionId]!.name" class="field mt-1 w-full" required autocomplete="off">
          </label>
          <label class="text-sm sm:col-span-2">
            <span class="text-content-muted">{{ $t('admin.billing_street') }}</span>
            <input v-model="drafts[sale.sessionId]!.line1" class="field mt-1 w-full" required autocomplete="off">
          </label>
          <label class="text-sm">
            <span class="text-content-muted">{{ $t('admin.billing_postal') }}</span>
            <input v-model="drafts[sale.sessionId]!.postalCode" class="field mt-1 w-full" required autocomplete="off">
          </label>
          <label class="text-sm">
            <span class="text-content-muted">{{ $t('admin.billing_city') }}</span>
            <input v-model="drafts[sale.sessionId]!.city" class="field mt-1 w-full" required autocomplete="off">
          </label>
          <label class="text-sm">
            <span class="text-content-muted">{{ $t('admin.billing_country') }}</span>
            <input v-model="drafts[sale.sessionId]!.country" class="field mt-1 w-full uppercase" required maxlength="2" autocomplete="off">
          </label>
          <!-- Only a link that states its fee offers the box, and the amount shown
               is the link's: the browser never names a sum. -->
          <label
            v-if="sale.fulfilment === 'delivery' && sale.deliveryFee !== null"
            class="flex min-h-11 items-center gap-2 self-end text-sm"
          >
            <input v-model="drafts[sale.sessionId]!.deliveryFeeCollected" type="checkbox" class="size-5">
            <span>{{ $t('admin.delivery_fee_collected', { amount: formatCents(sale.deliveryFee) }) }}</span>
          </label>
          <p v-if="sale.fulfilment === 'delivery' && sale.feeUnknown" class="text-sm text-danger sm:col-span-2" role="status">
            {{ $t('admin.fee_unknown') }}
          </p>

          <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="button" class="btn-secondary h-11 px-4" @click="openSigning(sale)">
              {{ drafts[sale.sessionId]!.signature ? $t('admin.signature_again') : $t('admin.take_signature') }}
            </button>
            <span v-if="drafts[sale.sessionId]!.signature" class="text-sm font-semibold text-accent">
              {{ $t('admin.signature_taken') }}
            </span>
          </div>

          <p v-if="error?.sessionId === sale.sessionId" class="text-sm text-danger sm:col-span-2" role="alert">
            {{ error.message }}
          </p>

          <div class="sm:col-span-2">
            <button
              type="submit"
              class="btn-primary h-11 w-full px-5 sm:w-auto"
              :disabled="!isComplete(drafts[sale.sessionId]!) || issuing !== null || !canIssue(sale)"
            >
              {{ issuing === sale.sessionId ? $t('admin.issuing') : $t('admin.issue_invoice') }}
            </button>
          </div>
        </form>
      </li>
    </ul>

    <!-- The screen the customer holds: their purchase, their words, nothing else. -->
    <div
      v-if="signing"
      class="fixed inset-0 z-50 overflow-y-auto bg-surface-raised"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('admin.signature')"
    >
      <div class="mx-auto flex min-h-full max-w-xl flex-col gap-4 p-5">
        <p class="font-display text-xl font-extrabold text-content-strong">{{ signing.productName }}</p>
        <p class="text-sm text-content-muted">
          {{ $t('admin.frame_number') }}: <span class="font-semibold text-content-strong">{{ drafts[signing.sessionId]?.frameNumber || '—' }}</span>
          · {{ (drafts[signing.sessionId]?.deliveredOn ?? '').split('-').reverse().join('/') }}
        </p>
        <div class="grid gap-2 text-content">
          <p v-for="(sentence, index) in signing.acknowledgement" :key="index">{{ sentence }}</p>
        </div>
        <SignaturePad
          v-model="pendingSignature"
          :label="$t('admin.signature')"
          :hint="$t('admin.signature_hint')"
          :clear-label="$t('admin.clear_signature')"
        />
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-primary h-11 px-5" :disabled="!pendingSignature" @click="confirmSignature">
            {{ $t('admin.signature_confirm') }}
          </button>
          <button type="button" class="btn-secondary h-11 px-5" @click="signing = null">{{ $t('admin.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
