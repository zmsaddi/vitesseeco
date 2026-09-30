<script setup lang="ts">
/**
 * Invoices for Payment Link sales.
 *
 * These sales never became orders, so the order screens cannot see them. The
 * page lists what Stripe says was paid through a link and issues the invoice
 * once the bike has been handed over — from a phone, at the counter, because
 * that is where the frame number is read off.
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
  pdfUrl: string | null
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

const { data, refresh, status: loadState } = await useFetch<{ items: LinkSale[] }>('/api/admin/link-sales')

// Today in the shop's zone, as the date input wants it (YYYY-MM-DD).
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())

const drafts = reactive<Record<string, Draft>>({})
watchEffect(() => {
  for (const sale of data.value?.items ?? []) {
    if (drafts[sale.sessionId]) continue
    drafts[sale.sessionId] = {
      frameNumber: '',
      deliveredOn: today,
      name: sale.billing.name ?? '',
      // A delivery address typed at checkout is the best guess for billing.
      line1: sale.billing.line1 ?? sale.deliveryAddress ?? '',
      postalCode: sale.billing.postalCode ?? '',
      city: sale.billing.city ?? '',
      country: sale.billing.country ?? 'AT',
      deliveryFeeCollected: sale.fulfilment === 'delivery',
      signature: '',
    }
  }
})

const issuing = ref<string | null>(null)
const error = ref<{ sessionId: string; message: string } | null>(null)

function isComplete(draft: Draft): boolean {
  return [draft.signature, draft.frameNumber, draft.deliveredOn, draft.name, draft.line1, draft.postalCode, draft.city, draft.country]
    .every((value) => value.trim().length > 0)
}

async function issue(sale: LinkSale): Promise<void> {
  const draft = drafts[sale.sessionId]
  if (!draft || !isComplete(draft) || issuing.value) return
  if (!window.confirm(t('admin.confirm_issue', { frame: draft.frameNumber.trim() }))) return
  issuing.value = sale.sessionId
  error.value = null
  try {
    await $fetch('/api/admin/link-sales/invoice', {
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
        deliveryFeeCollected: sale.fulfilment === 'delivery' && draft.deliveryFeeCollected,
        signature: draft.signature,
      },
    })
  } catch (err: unknown) {
    const payload = (err as { data?: { messageKey?: string } })?.data
    error.value = {
      sessionId: sale.sessionId,
      message: payload?.messageKey ? t(payload.messageKey) : t('errors.internal'),
    }
  } finally {
    issuing.value = null
    // Refreshed even after a failure: the invoice may exist although the
    // response was lost, and the list shows what Stripe actually holds.
    await refresh()
  }
}

function mailto(sale: LinkSale): string {
  const message = sale.invoice!.message
  return `mailto:${sale.email ?? ''}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`
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

    <p v-if="loadState === 'success' && !data?.items.length" class="card mt-6 p-6 text-content-muted">
      {{ $t('admin.no_link_sales') }}
    </p>

    <ul class="mt-6 grid gap-4">
      <li v-for="sale in data?.items ?? []" :key="sale.sessionId" class="card p-5">
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
          <a v-if="sale.invoice.pdfUrl" :href="sale.invoice.pdfUrl" target="_blank" rel="noopener" class="btn-secondary h-10 px-4 text-sm">
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
        </div>

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
            <input v-model="drafts[sale.sessionId]!.postalCode" class="field mt-1 w-full" required inputmode="numeric" autocomplete="off">
          </label>
          <label class="text-sm">
            <span class="text-content-muted">{{ $t('admin.billing_city') }}</span>
            <input v-model="drafts[sale.sessionId]!.city" class="field mt-1 w-full" required autocomplete="off">
          </label>
          <label class="text-sm">
            <span class="text-content-muted">{{ $t('admin.billing_country') }}</span>
            <input v-model="drafts[sale.sessionId]!.country" class="field mt-1 w-full uppercase" required maxlength="2" autocomplete="off">
          </label>
          <label v-if="sale.fulfilment === 'delivery'" class="flex min-h-11 items-center gap-2 self-end text-sm">
            <input v-model="drafts[sale.sessionId]!.deliveryFeeCollected" type="checkbox" class="size-5">
            <span>{{ $t('admin.delivery_fee_collected') }}</span>
          </label>

          <SignaturePad
            v-model="drafts[sale.sessionId]!.signature"
            class="sm:col-span-2"
            :label="$t('admin.signature')"
            :hint="$t('admin.signature_hint')"
            :clear-label="$t('admin.clear_signature')"
          />

          <p v-if="error?.sessionId === sale.sessionId" class="text-sm text-danger sm:col-span-2" role="alert">
            {{ error.message }}
          </p>

          <div class="sm:col-span-2">
            <button
              type="submit"
              class="btn-primary h-11 w-full px-5 sm:w-auto"
              :disabled="!isComplete(drafts[sale.sessionId]!) || issuing !== null"
            >
              {{ issuing === sale.sessionId ? $t('admin.issuing') : $t('admin.issue_invoice') }}
            </button>
          </div>
        </form>
      </li>
    </ul>
  </div>
</template>
