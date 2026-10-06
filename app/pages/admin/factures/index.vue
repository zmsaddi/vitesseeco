<script setup lang="ts">
/**
 * Invoices for Payment Link sales — any link.
 *
 * These sales never became orders, so the order screens cannot see them. The
 * page lists what Stripe says was paid through a link and issues the invoice
 * once the item has been handed over — from a phone or tablet, at the counter,
 * because that is where the frame number is read off.
 *
 * The customer signs on a screen of their own, in their own language, showing
 * their purchase and what they confirm — never the list, which holds every other
 * buyer's name, email and phone. While the device is in their hands the list is
 * not rendered at all, and when they finish it shows "hand the device back"
 * until the seller long-presses to resume. Getting back to the list is the
 * seller's act alone:
 *
 *   - a reload, a pull-down or this address typed again draws the hand-back
 *     screen: "in the customer's hands" is a cookie the server reads, and the
 *     list is not even fetched while it is set;
 *   - the back gesture and the history menu keep the customer's screen. The
 *     screen adds a history entry of vue-router's own, so the router can put the
 *     address back — a raw entry corrupted its state, and the next link in the
 *     panel then sent the tablet to "https://vitesse-eco.frundefined/";
 *   - the seller's resume steps back over that entry, so Back never gathers
 *     presses that do nothing.
 *
 * What one page cannot close is the rest of the browser: another tab, another
 * admin address typed into the bar, both behind a live admin session. The
 * device is handed over under Guided Access (iPadOS) or screen pinning
 * (Android) for that.
 *
 * Name and address are pre-filled from checkout when the link collected them;
 * the first buyers paid before it did, so every field stays editable.
 */
import {
  SIGNING_TEXT,
  acknowledgementLines,
  isReceiptLanguage,
  languageFor,
  type ReceiptLanguage,
} from '~~/shared/receiptLanguage'
import { HANDOVER_LIMITS, isCountryCode, isHandoverDay, isHandoverText, parisDay } from '~~/shared/handoverForm'
import { getLocale, isLocaleCode } from '~~/shared/locales'
import type { RouteLocationNormalized } from 'vue-router'
import { apiError } from '~/utils/apiError'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t, locale } = useI18n()
const { formatCents } = useFormatPrice()
const { formatDateTime } = useFormatDate()
const route = useRoute()
const router = useRouter()

interface IssuedInvoice {
  id: string
  number: string
  hostedUrl: string | null
  message: { subject: string; body: string }
}

interface IssueResult extends IssuedInvoice {
  resumed: boolean
  frameNumber: string
  deliveredOn: string
  customerName: string
  total: number
  differences: string[]
  differs: boolean
}

interface PendingInvoice {
  id: string
  number: string
  frameNumber: string
  deliveredOn: string
  customerName: string | null
  total: number
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
  pendingAttempt: boolean
  /** A numbered invoice an interrupted attempt left: finished as it stands, nothing typed or signed. */
  pendingInvoice: PendingInvoice | null
  /** Before an invoice: why none can be issued. After: money went back, and the invoice needs a credit note. */
  blocked: 'refunded' | 'disputed' | 'stripe_invoice' | null
  stripeInvoiceNumber: string | null
}

interface Draft {
  frameNumber: string
  deliveredOn: string
  /** Set once staff edit the date, or the customer signs for it; an untouched date follows "today". */
  dateTouched: boolean
  name: string
  line1: string
  postalCode: string
  city: string
  country: string
  deliveryFeeCollected: boolean
  signature: string
  /** What the customer saw when they signed. Change any of it and the signature no longer stands. */
  signedFor: string
}

interface ListResponse {
  items: LinkSale[]
  unreadable: number
}

// ── Whose hands the device is in ──────────────────────────────────────────────

/**
 * Set while a customer holds the device, to the language their screen speaks.
 * A cookie rather than page memory, because the server must know it too: a
 * reload rendered from a fresh page drew the whole buyer list.
 */
const handedOver = useCookie<string | null>('vs_handed_over', {
  default: () => null,
  sameSite: 'strict',
  path: '/',
  maxAge: 86_400,
})
const handedOverLanguage = (): ReceiptLanguage | null => (isReceiptLanguage(handedOver.value) ? handedOver.value : null)

/** Marks the history entry the customer's screen adds: `?ecran=client`. */
const SCREEN = 'ecran'
const CUSTOMER = 'client'

const { data, refresh, status: loadState, error: loadError } = await useFetch<ListResponse>('/api/admin/link-sales', {
  // While a customer holds the device the list is not fetched at all — so it is
  // in neither the page nor the payload a reload embeds in it.
  immediate: !handedOverLanguage(),
})

// The last list that loaded. A refresh that fails must not wipe the page — the
// sale just invoiced, and the error that explains a failed issue, live here.
const shown = ref<ListResponse | null>(data.value ?? null)
watch(data, (value) => {
  if (value) shown.value = value
})

/** Invoices issued from this page, by sale — shown whatever the list does next. */
const issuedNow = reactive<Record<string, IssuedInvoice>>({})
const invoiceOf = (sale: LinkSale): IssuedInvoice | null => issuedNow[sale.sessionId] ?? sale.invoice

/** Today in the shop's zone, as the date input wants it — read when used, not once. */
const todayInParis = (): string => parisDay(new Date())
/** The day the money arrived, as the server dates it: the earliest possible handover. */
const paidDay = (sale: LinkSale): string => parisDay(new Date(sale.paidAt))
/** "2026-09-29" written the French way, "29/09/2026". */
const dayLabel = (isoDay: string): string => isoDay.split('-').reverse().join('/')

const today = ref(todayInParis())
function refreshToday(): void {
  today.value = todayInParis()
  // A tablet left on this page overnight: untouched dates follow the calendar.
  // A signed date is touched — the customer signed for that day.
  for (const draft of Object.values(drafts)) if (!draft.dateTouched) draft.deliveredOn = today.value
}

const drafts = reactive<Record<string, Draft>>({})
watchEffect(() => {
  for (const sale of shown.value?.items ?? []) {
    if (drafts[sale.sessionId]) continue
    drafts[sale.sessionId] = {
      frameNumber: '',
      deliveredOn: today.value,
      dateTouched: false,
      name: sale.billing.name ?? '',
      // A delivery address typed at checkout is the best guess for billing.
      line1: sale.billing.line1 ?? sale.deliveryAddress ?? '',
      postalCode: sale.billing.postalCode ?? '',
      city: sale.billing.city ?? '',
      // Unknown stays empty: a guessed country is a wrong invoice.
      country: sale.billing.country ?? '',
      deliveryFeeCollected: sale.fulfilment === 'delivery' && sale.deliveryFee !== null,
      signature: '',
      signedFor: '',
    }
  }
})

const issuing = ref<string | null>(null)
const error = ref<{ sessionId: string; message: string } | null>(null)
const notice = ref<{ sessionId: string; message: string; warning: boolean } | null>(null)

/** What the signature vouches for. */
function signedFields(draft: Draft): string {
  return JSON.stringify([draft.frameNumber.trim(), draft.deliveredOn, draft.name.trim(), draft.country.trim().toUpperCase()])
}
function signatureStands(draft: Draft): boolean {
  return Boolean(draft.signature) && draft.signedFor === signedFields(draft)
}
/**
 * The four fields the customer signs for, each as the server will accept it.
 * Checked before the device is handed over: a value refused after the signature
 * could only be corrected by voiding it, and the customer has often left by then.
 */
function readyToSign(sale: LinkSale, draft: Draft): boolean {
  return (
    isHandoverText(draft.frameNumber, HANDOVER_LIMITS.frameNumber) &&
    isHandoverDay(draft.deliveredOn, paidDay(sale), todayInParis()) &&
    isHandoverText(draft.name, HANDOVER_LIMITS.name) &&
    isCountryCode(draft.country)
  )
}
/** Why a filled-in form cannot be signed yet, when the reason is not plain to see. */
function signingProblem(sale: LinkSale, draft: Draft): 'date' | 'country' | null {
  if (!draft.deliveredOn || !draft.country.trim()) return null
  if (!isHandoverDay(draft.deliveredOn, paidDay(sale), todayInParis())) return 'date'
  if (!isCountryCode(draft.country)) return 'country'
  return null
}
function isComplete(sale: LinkSale, draft: Draft): boolean {
  return (
    signatureStands(draft) &&
    readyToSign(sale, draft) &&
    isHandoverText(draft.line1, HANDOVER_LIMITS.line1) &&
    isHandoverText(draft.postalCode, HANDOVER_LIMITS.postalCode) &&
    isHandoverText(draft.city, HANDOVER_LIMITS.city)
  )
}

function canIssue(sale: LinkSale): boolean {
  // A delivery sale whose link settings could not be read waits: issuing it
  // without the fee would be guessing.
  return !(sale.fulfilment === 'delivery' && sale.feeUnknown)
}

// ── The customer's own screen ─────────────────────────────────────────────────

type Mode = 'idle' | 'signing' | 'handback'
const mode = ref<Mode>(handedOverLanguage() ? 'handback' : 'idle')
/** Read fresh after an await: the customer may have handed the device back meanwhile. */
const inCustomerHands = (): boolean => mode.value !== 'idle'
const signingSale = ref<LinkSale | null>(null)
const pendingSignature = ref('')
const signingHeading = ref<HTMLElement | null>(null)
const handBackHeading = ref<HTMLElement | null>(null)

const signingDraft = computed(() => (signingSale.value ? drafts[signingSale.value.sessionId] : undefined))
// After a reload only the cookie still knows who holds the device.
const customerLanguage = computed<ReceiptLanguage>(() =>
  signingDraft.value ? languageFor(signingDraft.value.country) : (handedOverLanguage() ?? 'fr')
)
const customerText = computed(() => SIGNING_TEXT[customerLanguage.value])
const acknowledgement = computed(() => acknowledgementLines(customerLanguage.value))
/** The seller's own control keeps the panel's direction inside the customer's left-to-right screen. */
const adminDir = computed(() => (isLocaleCode(locale.value) ? getLocale(locale.value).dir : 'ltr'))

// Whoever holds the device, the screen they read has the focus.
watch(mode, async (now) => {
  if (now === 'idle') return
  await nextTick()
  ;(now === 'signing' ? signingHeading.value : handBackHeading.value)?.focus()
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && mode.value === 'signing') mode.value = 'handback'
}

/** Resolves once what is in the DOM now has been painted: the frame after the next. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** Where the seller was in the list, to land them back on the same sale. */
let listScroll = 0

async function openSigning(sale: LinkSale): Promise<void> {
  refreshToday()
  const draft = drafts[sale.sessionId]
  if (!draft || !readyToSign(sale, draft)) return
  listScroll = window.scrollY
  pendingSignature.value = ''
  signingSale.value = sale
  mode.value = 'signing'
  // From here a reload — the toolbar button, a pull-down — draws the
  // customer's screen, never the list.
  handedOver.value = customerLanguage.value
  await nextTick()
  // Only now the history entry the back gesture will pop. iOS keeps a picture
  // of the page being left at the moment an entry is added, and slides that
  // picture in under a back swipe: it must be the customer's screen, not the
  // list. `force`: the address may already carry the marker, if the seller
  // went Forward into an old entry.
  await nextPaint()
  if (inCustomerHands()) await router.push({ query: { ...route.query, [SCREEN]: CUSTOMER }, force: true })
}

function confirmSignature(): void {
  const draft = signingDraft.value
  if (!draft || !pendingSignature.value) return
  draft.signature = pendingSignature.value
  draft.signedFor = signedFields(draft)
  // The customer signed for this day. Left to follow the calendar, the date
  // moved overnight and voided a signature whose customer had gone home.
  draft.dateTouched = true
  mode.value = 'handback'
}

/** True while the seller's own resume steps back over the customer's entry. */
let resuming = false

/**
 * Step back over the entry openSigning added, so a visit leaves no dead Back
 * press — when vue-router's own record says the entry before it is this page
 * without the marker. Opened on that address directly, there is nothing of
 * ours to step back to, and the marker is replaced away instead.
 */
async function leaveCustomerEntry(): Promise<void> {
  const query = { ...route.query }
  delete query[SCREEN]
  const plain = router.resolve({ path: route.path, query, hash: route.hash })
  if ((history.state as { back?: unknown } | null)?.back !== plain.fullPath) {
    await router.replace(plain)
    return
  }
  await new Promise<void>((resolve) => {
    let fallback: ReturnType<typeof setTimeout> | undefined
    const stop = router.afterEach(() => {
      stop()
      clearTimeout(fallback)
      resolve()
    })
    fallback = setTimeout(() => {
      stop()
      resolve()
    }, 2000)
    router.back()
  })
}

async function resume(): Promise<void> {
  handedOver.value = null
  if (route.query[SCREEN] === CUSTOMER) {
    resuming = true
    try {
      await leaveCustomerEntry()
    } finally {
      resuming = false
    }
  }
  mode.value = 'idle'
  signingSale.value = null
  // Reloaded in the customer's hands: nothing was fetched, and it is safe now.
  if (!shown.value) await refresh()
  // The list was not rendered while the customer held the device, so the page
  // had collapsed to the top; the seller lands back on the sale they were on.
  await nextTick()
  window.scrollTo({ top: listScroll, behavior: 'instant' })
}

// Staff resume by holding, not tapping: a customer's stray tap must not do it.
let holdTimer: ReturnType<typeof setTimeout> | null = null
function startHold(): void {
  // A held key repeats its keydown. Restarting the timer on each one meant a
  // seller holding Enter could never resume.
  if (holdTimer) return
  holdTimer = setTimeout(() => {
    holdTimer = null
    void resume()
  }, 1200)
}
function stopHold(): void {
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = null
}

onMounted(() => {
  document.addEventListener('visibilitychange', refreshToday)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', refreshToday)
  window.removeEventListener('keydown', onKeydown)
  stopHold()
})
// Back, Forward or a jump through the history menu while the customer holds the
// device: refused, vue-router puts the address back, and the customer is shown
// the hand-back screen. Their own entry is the one step allowed.
onBeforeRouteUpdate((to: RouteLocationNormalized) => {
  if (mode.value === 'idle' || resuming || to.query[SCREEN] === CUSTOMER) return true
  mode.value = 'handback'
  return false
})
onBeforeRouteLeave(() => {
  if (mode.value === 'idle') return true
  mode.value = 'handback'
  return false
})

// ── Issuing ───────────────────────────────────────────────────────────────────

function failure(sale: LinkSale, err: unknown): void {
  const payload = apiError(err)
  error.value = {
    sessionId: sale.sessionId,
    message: payload?.messageKey ? t(payload.messageKey) : t('errors.internal'),
  }
}

async function issue(sale: LinkSale): Promise<void> {
  const draft = drafts[sale.sessionId]
  if (!draft || !isComplete(sale, draft) || issuing.value || !canIssue(sale)) return
  if (!window.confirm(t('admin.confirm_issue', { frame: draft.frameNumber.trim() }))) return
  issuing.value = sale.sessionId
  error.value = null
  notice.value = null
  try {
    const result = await $fetch<{ invoice: IssueResult }>('/api/admin/link-sales/invoice', {
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
    issuedNow[sale.sessionId] = result.invoice
    if (result.invoice.resumed) {
      notice.value = {
        sessionId: sale.sessionId,
        warning: result.invoice.differs,
        // What the finished invoice states, so it can be compared with what was typed.
        message: result.invoice.differs
          ? t('admin.invoice_resumed_differs', {
              frame: result.invoice.frameNumber,
              date: dayLabel(result.invoice.deliveredOn),
              name: result.invoice.customerName,
              total: formatCents(result.invoice.total),
            })
          : t('admin.invoice_resumed'),
      }
    }
  } catch (err: unknown) {
    failure(sale, err)
  } finally {
    // Refreshed even after a failure: the invoice may exist although the
    // response was lost, and the list shows what Stripe actually holds.
    await refresh()
    issuing.value = null
  }
}

/** Settle the number an interrupted attempt left: no form, no signature, nothing new numbered. */
async function finish(sale: LinkSale): Promise<void> {
  if (issuing.value) return
  issuing.value = sale.sessionId
  error.value = null
  notice.value = null
  try {
    const result = await $fetch<{ invoice: IssueResult }>('/api/admin/link-sales/finish', {
      method: 'POST',
      body: { sessionId: sale.sessionId },
    })
    issuedNow[sale.sessionId] = result.invoice
    notice.value = { sessionId: sale.sessionId, warning: false, message: t('admin.invoice_resumed') }
  } catch (err: unknown) {
    failure(sale, err)
  } finally {
    await refresh()
    issuing.value = null
  }
}

function mailto(sale: LinkSale): string {
  const message = invoiceOf(sale)!.message
  return `mailto:${encodeURIComponent(sale.email ?? '')}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`
}

function whatsapp(sale: LinkSale): string {
  const digits = (sale.phone ?? '').replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(invoiceOf(sale)!.message.body)}`
}

useSeoMeta({ title: () => t('admin.invoices'), robots: 'noindex' })
</script>

<template>
  <div class="container-page">
    <!-- Not rendered at all while the device is in the customer's hands. -->
    <template v-if="mode === 'idle'">
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
          <div v-if="invoiceOf(sale)" class="mt-4 flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-accent-subtle px-3 py-1 text-sm font-semibold text-accent">
              {{ $t('admin.invoiced', { number: invoiceOf(sale)!.number }) }}
            </span>
            <a :href="`/api/admin/link-sales/invoice-pdf?invoice=${invoiceOf(sale)!.id}`" target="_blank" rel="noopener" class="btn-secondary h-10 px-4 text-sm">
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
            <!-- Money that went back after the number was given: the invoice now needs a credit note. -->
            <p v-if="sale.blocked === 'refunded' || sale.blocked === 'disputed'" class="w-full text-sm text-danger" role="status">
              {{ sale.blocked === 'disputed' ? $t('admin.reversed_disputed') : $t('admin.reversed_refunded') }}
            </p>
            <p
              v-if="notice?.sessionId === sale.sessionId"
              class="w-full text-sm"
              :class="notice.warning ? 'text-danger' : 'text-content-muted'"
              role="status"
            >
              {{ notice.message }}
            </p>
          </div>

          <!-- An interrupted attempt already numbered it: settling that number is all that is left. -->
          <div v-else-if="sale.pendingInvoice" class="mt-4 grid gap-3">
            <p class="text-sm text-content" role="status">
              {{
                $t('admin.pending_numbered', {
                  number: sale.pendingInvoice.number,
                  frame: sale.pendingInvoice.frameNumber || '—',
                  date: dayLabel(sale.pendingInvoice.deliveredOn),
                })
              }}
            </p>
            <p v-if="sale.blocked === 'refunded' || sale.blocked === 'disputed'" class="text-sm text-danger" role="status">
              {{ sale.blocked === 'disputed' ? $t('admin.reversed_disputed') : $t('admin.reversed_refunded') }}
            </p>
            <p v-if="error?.sessionId === sale.sessionId" class="text-sm text-danger" role="alert">{{ error.message }}</p>
            <div>
              <button type="button" class="btn-primary h-11 w-full px-5 sm:w-auto" :disabled="issuing !== null" @click="finish(sale)">
                {{ issuing === sale.sessionId ? $t('admin.issuing') : $t('admin.finish_invoice', { number: sale.pendingInvoice.number }) }}
              </button>
            </div>
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
            <p v-if="sale.pendingAttempt" class="text-sm text-content-muted sm:col-span-2" role="status">
              {{ $t('admin.pending_attempt') }}
            </p>
            <label class="text-sm">
              <span class="text-content-muted">{{ $t('admin.frame_number') }}</span>
              <input
                v-model="drafts[sale.sessionId]!.frameNumber"
                class="field mt-1 w-full"
                required
                :maxlength="HANDOVER_LIMITS.frameNumber"
                autocapitalize="characters"
                autocomplete="off"
              >
            </label>
            <label class="text-sm">
              <span class="text-content-muted">{{ $t('admin.delivered_on') }}</span>
              <input
                v-model="drafts[sale.sessionId]!.deliveredOn"
                type="date"
                class="field mt-1 w-full"
                required
                :min="paidDay(sale)"
                :max="today"
                @input="drafts[sale.sessionId]!.dateTouched = true"
              >
            </label>
            <label class="text-sm sm:col-span-2">
              <span class="text-content-muted">{{ $t('admin.billing_name') }}</span>
              <input v-model="drafts[sale.sessionId]!.name" class="field mt-1 w-full" required :maxlength="HANDOVER_LIMITS.name" autocomplete="off">
            </label>
            <label class="text-sm sm:col-span-2">
              <span class="text-content-muted">{{ $t('admin.billing_street') }}</span>
              <input v-model="drafts[sale.sessionId]!.line1" class="field mt-1 w-full" required :maxlength="HANDOVER_LIMITS.line1" autocomplete="off">
            </label>
            <label class="text-sm">
              <span class="text-content-muted">{{ $t('admin.billing_postal') }}</span>
              <input
                v-model="drafts[sale.sessionId]!.postalCode"
                class="field mt-1 w-full"
                required
                :maxlength="HANDOVER_LIMITS.postalCode"
                autocomplete="off"
              >
            </label>
            <label class="text-sm">
              <span class="text-content-muted">{{ $t('admin.billing_city') }}</span>
              <input v-model="drafts[sale.sessionId]!.city" class="field mt-1 w-full" required :maxlength="HANDOVER_LIMITS.city" autocomplete="off">
            </label>
            <label class="text-sm">
              <span class="text-content-muted">{{ $t('admin.billing_country') }}</span>
              <input
                v-model="drafts[sale.sessionId]!.country"
                class="field mt-1 w-full uppercase"
                required
                minlength="2"
                maxlength="2"
                pattern="[A-Za-z]{2}"
                autocomplete="off"
              >
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
            <div v-if="sale.fulfilment === 'delivery' && sale.feeUnknown" class="flex flex-wrap items-center gap-3 sm:col-span-2" role="status">
              <p class="text-sm text-danger">{{ $t('admin.fee_unknown') }}</p>
              <button type="button" class="btn-secondary h-10 px-4 text-sm" @click="refresh()">{{ $t('admin.retry') }}</button>
            </div>

            <p v-if="signingProblem(sale, drafts[sale.sessionId]!)" class="text-sm text-danger sm:col-span-2" role="status">
              {{ signingProblem(sale, drafts[sale.sessionId]!) === 'date' ? $t('admin.invoice_date_invalid') : $t('admin.country_invalid') }}
            </p>
            <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button
                type="button"
                class="btn-secondary h-11 px-4"
                :disabled="!readyToSign(sale, drafts[sale.sessionId]!) || issuing === sale.sessionId"
                @click="openSigning(sale)"
              >
                {{ signatureStands(drafts[sale.sessionId]!) ? $t('admin.signature_again') : $t('admin.take_signature') }}
              </button>
              <span v-if="signatureStands(drafts[sale.sessionId]!)" class="text-sm font-semibold text-accent">
                {{ $t('admin.signature_taken') }}
              </span>
              <span v-else-if="drafts[sale.sessionId]!.signature" class="text-sm text-danger">
                {{ $t('admin.signature_stale') }}
              </span>
            </div>

            <p v-if="error?.sessionId === sale.sessionId" class="text-sm text-danger sm:col-span-2" role="alert">
              {{ error.message }}
            </p>

            <div class="sm:col-span-2">
              <button
                type="submit"
                class="btn-primary h-11 w-full px-5 sm:w-auto"
                :disabled="!isComplete(sale, drafts[sale.sessionId]!) || issuing !== null || !canIssue(sale)"
              >
                {{ issuing === sale.sessionId ? $t('admin.issuing') : $t('admin.issue_invoice') }}
              </button>
            </div>
          </form>
        </li>
      </ul>
    </template>

    <!-- The screen the customer holds: their purchase, their words, nothing else.
         Left to right whatever the panel's language — every customer language is. -->
    <div
      v-if="mode !== 'idle'"
      class="fixed inset-0 z-50 overflow-y-auto overscroll-none bg-surface-raised"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-heading"
      :lang="customerLanguage"
      dir="ltr"
    >
      <div v-if="mode === 'signing' && signingSale && signingDraft" class="mx-auto flex min-h-full max-w-xl flex-col gap-4 p-5">
        <h2 id="customer-heading" ref="signingHeading" tabindex="-1" class="font-display text-xl font-extrabold text-content-strong">
          {{ signingSale.productName }}
        </h2>
        <p class="text-sm text-content-muted">
          <span class="font-semibold text-content-strong">{{ signingDraft.name }}</span>
          · {{ signingDraft.frameNumber }}
          · {{ dayLabel(signingDraft.deliveredOn) }}
        </p>
        <div class="grid gap-2 text-content">
          <p v-for="(sentence, index) in acknowledgement" :key="index">{{ sentence }}</p>
        </div>
        <SignaturePad
          v-model="pendingSignature"
          :label="customerText.signature"
          :hint="customerText.hint"
          :clear-label="customerText.clear"
        />
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-primary h-11 px-5" :disabled="!pendingSignature" @click="confirmSignature">
            {{ customerText.confirm }}
          </button>
          <button type="button" class="btn-secondary h-11 px-5" @click="mode = 'handback'">{{ customerText.cancel }}</button>
        </div>
      </div>

      <div v-else class="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-8 p-5 text-center">
        <p id="customer-heading" ref="handBackHeading" tabindex="-1" class="font-display text-2xl font-extrabold text-content-strong">
          {{ customerText.handBack }}
        </p>
        <button
          type="button"
          class="btn-secondary h-11 select-none px-5 text-sm"
          :lang="$i18n.locale"
          :dir="adminDir"
          @pointerdown="startHold"
          @pointerup="stopHold"
          @pointerleave="stopHold"
          @pointercancel="stopHold"
          @keydown.enter.prevent="startHold"
          @keyup.enter="stopHold"
          @keydown.space.prevent="startHold"
          @keyup.space="stopHold"
          @contextmenu.prevent
        >
          {{ $t('admin.hand_back_hold') }}
        </button>
      </div>
    </div>
  </div>
</template>
