<script setup lang="ts">
/**
 * Right of withdrawal.
 *
 * Directive 2011/83 asks for two things and is satisfied by neither alone: the
 * information about the right, and a model form the customer can actually use.
 * The form is therefore a real block in the page — printable and copyable —
 * rather than a PDF behind a link, because most people declare a withdrawal by
 * email and retyping a legal notice is where the order number gets lost.
 */
const localePath = useLocalePath()
const { locale, t } = useI18n()

// Dated so a reader can tell whether this text predates their order.
const { formatLongDate } = useFormatDate()
const updatedAt = computed(() => formatLongDate('2026-07-29T12:00:00Z'))

const conditionOk = [
  'withdrawal.condition_ok_1',
  'withdrawal.condition_ok_2',
  'withdrawal.condition_ok_3',
]

const conditionNotOk = [
  'withdrawal.condition_not_ok_1',
  'withdrawal.condition_not_ok_2',
  'withdrawal.condition_not_ok_3',
]

const exceptions = [
  'withdrawal.exceptions_custom',
  'withdrawal.exceptions_sealed',
  'withdrawal.exceptions_mixed',
  'withdrawal.exceptions_service',
]

const formFields = [
  'withdrawal.form_goods',
  'withdrawal.form_order_number',
  'withdrawal.form_ordered_on',
  'withdrawal.form_received_on',
  'withdrawal.form_consumer_name',
  'withdrawal.form_consumer_address',
  'withdrawal.form_date',
]

const copied = ref(false)
const copyFailed = ref(false)

/**
 * The copied version uses dot leaders rather than a colon: French puts a space
 * before a colon and English does not, and the label already carries whatever
 * punctuation its language wants.
 */
async function copyForm(): Promise<void> {
  const text = [
    t('withdrawal.form_to'),
    'VITESSE ECO SAS',
    '32 Rue du Faubourg du Pont Neuf',
    '86000 Poitiers, France',
    'contact@vitesse-eco.fr',
    '+33 7 45 83 00 49',
    '',
    t('withdrawal.form_statement'),
    '',
    ...formFields.map((key) => `${t(key)} ......................................`),
    `${t('withdrawal.form_signature')} ......................................`,
  ].join('\n')

  copied.value = false
  copyFailed.value = false
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 5000)
  } catch {
    // Clipboard access is refused in an insecure context and by some privacy
    // settings. The form is on screen either way, so the fallback is to say so
    // and let the visitor select it.
    copyFailed.value = true
  }
}

function printPage(): void {
  window.print()
}

/**
 * The site header and footer belong to the layout, so a page file cannot give
 * them a print: class. Registering the rule through useHead keeps it alive only
 * while this page is mounted, which is what stops a print sheet meant for a
 * legal form from following the visitor to the rest of the shop.
 */
useHead({
  style: [
    {
      media: 'print',
      textContent: 'header, footer { display: none !important } @page { margin: 1.5cm }',
    },
  ],
})

useSeoMeta({
  title: () => t('withdrawal.title'),
  description: () => t('withdrawal.meta_description'),
  robots: 'index, follow',
})
</script>

<template>
  <article class="container-page py-12">
    <h1 class="max-w-3xl font-display text-4xl font-extrabold leading-tight text-content-strong">
      {{ $t('withdrawal.title') }}
    </h1>
    <p class="mt-4 max-w-3xl text-lg text-content-muted">{{ $t('withdrawal.intro') }}</p>
    <p class="mt-3 text-sm text-content-muted">{{ $t('withdrawal.updated', { date: updatedAt }) }}</p>

    <!-- The three periods are what people actually come here to check, and they
         are the three they most often confuse with one another. -->
    <div class="mt-8 grid gap-4 sm:grid-cols-3 print:hidden">
      <div class="card p-5">
        <p class="font-display font-bold text-content-strong">{{ $t('withdrawal.glance_decide_title') }}</p>
        <p class="mt-2 text-sm text-content-muted">{{ $t('withdrawal.glance_decide_body') }}</p>
      </div>
      <div class="card p-5">
        <p class="font-display font-bold text-content-strong">{{ $t('withdrawal.glance_return_title') }}</p>
        <p class="mt-2 text-sm text-content-muted">{{ $t('withdrawal.glance_return_body') }}</p>
      </div>
      <div class="card p-5">
        <p class="font-display font-bold text-content-strong">{{ $t('withdrawal.glance_refund_title') }}</p>
        <p class="mt-2 text-sm text-content-muted">{{ $t('withdrawal.glance_refund_body') }}</p>
      </div>
    </div>

    <section id="beneficiaires" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.scope_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.scope_body') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.scope_in_store') }}</p>
      <p class="mt-3 text-content-muted">{{ $t('withdrawal.scope_pro') }}</p>
    </section>

    <section id="delai" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.period_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.period_body') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.period_multiple') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.period_weekend') }}</p>
    </section>

    <section id="notification" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.how_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.how_body') }}</p>

      <ul class="mt-4 space-y-2 text-content">
        <li>
          <span class="text-content-muted">{{ $t('withdrawal.how_by_email') }}</span>
          <a class="ms-1 text-accent hover:underline" href="mailto:contact@vitesse-eco.fr">contact@vitesse-eco.fr</a>
        </li>
        <li>
          <span class="text-content-muted">{{ $t('withdrawal.how_by_phone') }}</span>
          <a class="ms-1 text-accent hover:underline" href="tel:+33745830049">+33 7 45 83 00 49</a>
        </li>
        <li>
          <span class="text-content-muted">{{ $t('withdrawal.how_by_post') }}</span>
          <span class="ms-1">VITESSE ECO SAS, 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France</span>
        </li>
      </ul>

      <p class="mt-4 text-content">{{ $t('withdrawal.how_proof') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.how_ack') }}</p>
    </section>

    <section id="renvoi" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.return_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.return_body') }}</p>

      <div class="card mt-4 p-5">
        <p class="text-sm font-semibold text-content-strong">{{ $t('withdrawal.return_address') }}</p>
        <address class="mt-2 space-y-0.5 text-sm not-italic text-content-muted">
          <p>VITESSE ECO SAS</p>
          <p>32 Rue du Faubourg du Pont Neuf</p>
          <p>86000 Poitiers, France</p>
        </address>
      </div>

      <p class="mt-4 text-content">{{ $t('withdrawal.return_dropoff') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.return_packaging') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.return_battery') }}</p>
    </section>

    <section id="frais-de-retour" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.costs_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.costs_body') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.costs_estimate') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.costs_dropoff_free') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.costs_outbound') }}</p>
    </section>

    <section id="remboursement" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.refund_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.refund_body') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.refund_hold') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.refund_method') }}</p>
      <p class="mt-3 text-content">{{ $t('withdrawal.refund_cash') }}</p>
    </section>

    <section id="etat-du-bien" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.condition_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.condition_body') }}</p>

      <!-- "Handling beyond what is necessary" is the phrase the law uses and the
           phrase nobody can apply to their own bike. Examples on both sides are
           the only way this sentence means anything to a buyer. -->
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div class="card p-5">
          <p class="text-sm font-semibold text-success">{{ $t('withdrawal.condition_ok_title') }}</p>
          <ul class="mt-3 list-disc space-y-2 ps-5 text-sm text-content">
            <li v-for="key in conditionOk" :key="key">{{ $t(key) }}</li>
          </ul>
        </div>
        <div class="card p-5">
          <p class="text-sm font-semibold text-danger">{{ $t('withdrawal.condition_not_ok_title') }}</p>
          <ul class="mt-3 list-disc space-y-2 ps-5 text-sm text-content">
            <li v-for="key in conditionNotOk" :key="key">{{ $t(key) }}</li>
          </ul>
        </div>
      </div>

      <p class="mt-4 text-content">{{ $t('withdrawal.condition_deduction') }}</p>
    </section>

    <section id="exceptions" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.exceptions_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.exceptions_body') }}</p>
      <ul class="mt-4 list-disc space-y-2 ps-5 text-content">
        <li v-for="key in exceptions" :key="key">{{ $t(key) }}</li>
      </ul>
      <p class="mt-4 text-content">{{ $t('withdrawal.exceptions_note') }}</p>
    </section>

    <section id="garanties" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.guarantee_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.guarantee_body') }}</p>
      <NuxtLink :to="localePath('/cgv')" class="mt-4 inline-block text-accent hover:underline print:hidden">
        {{ $t('withdrawal.guarantee_link') }}
      </NuxtLink>
    </section>

    <section id="formulaire" class="mt-12 max-w-3xl scroll-mt-24">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.form_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.form_intro') }}</p>

      <div class="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <button type="button" class="btn-secondary" @click="printPage">{{ $t('withdrawal.form_print') }}</button>
        <button type="button" class="btn-secondary" @click="copyForm">{{ $t('withdrawal.form_copy') }}</button>
        <!-- Present from the start rather than inserted on success: a live region
             added to the DOM at the moment it changes is not reliably announced. -->
        <p
          class="text-sm"
          :class="copyFailed ? 'text-danger' : 'text-success'"
          role="status"
          aria-live="polite"
        >
          <span v-if="copied">{{ $t('withdrawal.form_copied') }}</span>
          <span v-else-if="copyFailed">{{ $t('withdrawal.form_copy_failed') }}</span>
        </p>
      </div>

      <div class="card mt-4 p-6 print:break-inside-avoid print:rounded-none">
        <p class="text-sm text-content-muted">{{ $t('withdrawal.form_to') }}</p>
        <address class="mt-2 space-y-0.5 not-italic text-content-strong">
          <p class="font-semibold">VITESSE ECO SAS</p>
          <p>32 Rue du Faubourg du Pont Neuf</p>
          <p>86000 Poitiers, France</p>
          <p>contact@vitesse-eco.fr</p>
          <p>+33 7 45 83 00 49</p>
        </address>

        <p class="mt-6 text-content">{{ $t('withdrawal.form_statement') }}</p>

        <dl class="mt-6 space-y-6">
          <div v-for="field in formFields" :key="field">
            <dt class="text-sm text-content-muted">{{ $t(field) }}</dt>
            <dd class="mt-1 h-8 border-b border-dashed border-surface-border" />
          </div>
          <div>
            <dt class="text-sm text-content-muted">
              {{ $t('withdrawal.form_signature') }}
              <span class="text-xs">({{ $t('withdrawal.form_signature_note') }})</span>
            </dt>
            <dd class="mt-1 h-16 border-b border-dashed border-surface-border" />
          </div>
        </dl>
      </div>
    </section>

    <section class="mt-12 max-w-3xl print:hidden">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('withdrawal.help_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('withdrawal.help_body') }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <a class="btn-primary" href="mailto:contact@vitesse-eco.fr">contact@vitesse-eco.fr</a>
        <a class="btn-secondary" href="https://wa.me/33745830049" rel="noopener">WhatsApp</a>
      </div>
    </section>
  </article>
</template>
