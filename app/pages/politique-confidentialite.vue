<script setup lang="ts">
/**
 * Privacy policy.
 *
 * This describes what the code in this repository actually does — the columns of
 * server/db/schema.ts, the cookies set in server/security/session.ts, the two
 * localStorage keys the app writes. A policy that describes a generic shop is a
 * policy nobody can check, and the first thing a regulator does is check.
 *
 * The section list drives both the table of contents and the headings, so a
 * section can never exist without an anchor to reach it.
 */
const localePath = useLocalePath()
const { locale, t } = useI18n()

const LAST_UPDATED = '2026-07-29'
const { formatLongDate } = useFormatDate()
const updatedOn = computed(() => formatLongDate(`${LAST_UPDATED}T12:00:00Z`))

const sections = [
  { id: 'responsable', label: 'privacy.controller_title' },
  { id: 'donnees', label: 'privacy.data_title' },
  { id: 'finalites', label: 'privacy.purposes_title' },
  { id: 'paiement', label: 'privacy.payment_title' },
  { id: 'cookies', label: 'privacy.cookies_title' },
  { id: 'destinataires', label: 'privacy.recipients_title' },
  { id: 'transferts', label: 'privacy.transfers_title' },
  { id: 'securite', label: 'privacy.security_title' },
  { id: 'droits', label: 'privacy.rights_title' },
  { id: 'mineurs', label: 'privacy.minors_title' },
  { id: 'modifications', label: 'privacy.changes_title' },
]

/** What we hold, in the words of the tables that hold it. */
const categories = ['account', 'addresses', 'orders', 'session', 'messages', 'security', 'country']

/**
 * Each purpose carries its legal basis and its retention. The three strings are
 * derived from the id, so adding a purpose is one entry here rather than three
 * blocks of markup that can fall out of step with each other.
 */
const purposes = ['account', 'orders', 'messages', 'session', 'abuse', 'legal']

const cookies = [
  { name: 'vs_session', purpose: 'privacy.cookie_session', duration: 'privacy.cookie_session_duration' },
  { name: 'vs_has_session', purpose: 'privacy.cookie_hint', duration: 'privacy.cookie_hint_duration' },
]

const storage = [
  { name: 'vitesse.cart.v1', purpose: 'privacy.storage_cart' },
  { name: 'vs_market_suggestion', purpose: 'privacy.storage_market' },
]

const rights = [
  'access',
  'rectification',
  'erasure',
  'portability',
  'objection',
  'restriction',
  'consent',
  'postmortem',
]

useSeoMeta({
  title: () => t('privacy.title'),
  description: () => t('privacy.description'),
  robots: 'index, follow',
})
</script>

<template>
  <div class="container-page py-12">
    <article class="mx-auto max-w-3xl">
      <h1 class="font-display text-3xl font-extrabold text-content-strong">
        {{ $t('privacy.title') }}
      </h1>
      <p class="mt-2 text-sm text-content-muted">
        {{ $t('legal.last_updated') }}
        <time :datetime="LAST_UPDATED">{{ updatedOn }}</time>
      </p>
      <p class="mt-4 text-content">{{ $t('privacy.intro') }}</p>

      <!-- Fragment links: the target is this same page, so there is no route for
           localePath to translate. -->
      <nav class="card mt-8 p-5" :aria-label="$t('legal.toc')">
        <h2 class="text-sm font-semibold text-content-strong">{{ $t('legal.toc') }}</h2>
        <ol class="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          <li v-for="(section, index) in sections" :key="section.id">
            <a :href="`#${section.id}`" class="text-content-muted hover:text-accent">
              {{ index + 1 }}. {{ $t(section.label) }}
            </a>
          </li>
        </ol>
      </nav>

      <section id="responsable" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.controller_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.controller_body') }}</p>
        <address class="mt-3 not-italic text-content-strong">
          VITESSE ECO SAS<br />
          32 Rue du Faubourg du Pont Neuf<br />
          86000 Poitiers, France<br />
          <a class="text-accent hover:underline" href="mailto:contact@vitesse-eco.fr">
            contact@vitesse-eco.fr
          </a>
        </address>
        <p class="mt-3 text-content">{{ $t('privacy.controller_no_dpo') }}</p>
      </section>

      <section id="donnees" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.data_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.data_intro') }}</p>
        <ul class="mt-4 space-y-4">
          <li v-for="category in categories" :key="category" class="card p-5">
            <h3 class="font-semibold text-content-strong">{{ $t(`privacy.data_${category}_title`) }}</h3>
            <p class="mt-2 text-sm text-content">{{ $t(`privacy.data_${category}_body`) }}</p>
          </li>
        </ul>
      </section>

      <section id="finalites" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.purposes_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.purposes_intro') }}</p>
        <ul class="mt-4 space-y-4">
          <li v-for="purpose in purposes" :key="purpose" class="card p-5">
            <h3 class="font-semibold text-content-strong">{{ $t(`privacy.purpose_${purpose}_title`) }}</h3>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex flex-wrap gap-x-2">
                <dt class="w-40 shrink-0 text-content-muted">{{ $t('privacy.legal_basis') }}</dt>
                <dd class="flex-1 text-content">{{ $t(`privacy.purpose_${purpose}_basis`) }}</dd>
              </div>
              <div class="flex flex-wrap gap-x-2">
                <dt class="w-40 shrink-0 text-content-muted">{{ $t('privacy.retention') }}</dt>
                <dd class="flex-1 text-content">{{ $t(`privacy.purpose_${purpose}_retention`) }}</dd>
              </div>
            </dl>
          </li>
        </ul>
        <p class="mt-4 text-content">{{ $t('privacy.no_marketing') }}</p>
      </section>

      <section id="paiement" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.payment_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.payment_body') }}</p>
        <p class="mt-3 text-content">{{ $t('privacy.payment_cash') }}</p>
      </section>

      <section id="cookies" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.cookies_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.cookies_intro') }}</p>

        <ul class="mt-4 space-y-3">
          <li v-for="cookie in cookies" :key="cookie.name" class="card p-4">
            <p class="font-mono text-sm font-semibold text-content-strong">{{ cookie.name }}</p>
            <p class="mt-1 text-sm text-content">{{ $t(cookie.purpose) }}</p>
            <p class="mt-1 text-sm text-content-muted">{{ $t(cookie.duration) }}</p>
          </li>
        </ul>

        <p class="mt-4 text-content">{{ $t('privacy.cookies_captcha') }}</p>

        <h3 class="mt-6 font-semibold text-content-strong">{{ $t('privacy.storage_title') }}</h3>
        <p class="mt-2 text-content">{{ $t('privacy.storage_intro') }}</p>
        <ul class="mt-3 space-y-3">
          <li v-for="entry in storage" :key="entry.name" class="card p-4">
            <p class="font-mono text-sm font-semibold text-content-strong">{{ entry.name }}</p>
            <p class="mt-1 text-sm text-content">{{ $t(entry.purpose) }}</p>
          </li>
        </ul>

        <p class="mt-4 text-content">{{ $t('privacy.cookies_none_else') }}</p>
      </section>

      <section id="destinataires" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.recipients_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.recipients_internal') }}</p>
        <ul class="mt-3 space-y-2 text-content">
          <li>{{ $t('privacy.recipient_neon') }}</li>
          <li>{{ $t('privacy.recipient_vercel') }}</li>
          <li>{{ $t('privacy.recipient_stripe') }}</li>
          <li>{{ $t('privacy.recipient_cloudflare') }}</li>
          <li>{{ $t('privacy.recipient_sanity') }}</li>
        </ul>
        <p class="mt-4 font-medium text-content-strong">{{ $t('privacy.recipients_no_sale') }}</p>
      </section>

      <section id="transferts" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.transfers_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.transfers_body') }}</p>
      </section>

      <section id="securite" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.security_title') }}
        </h2>
        <ul class="mt-3 space-y-2 text-content">
          <li>{{ $t('privacy.security_passwords') }}</li>
          <li>{{ $t('privacy.security_sessions') }}</li>
          <li>{{ $t('privacy.security_cookies') }}</li>
          <li>{{ $t('privacy.security_ip') }}</li>
          <li>{{ $t('privacy.security_transport') }}</li>
          <li>{{ $t('privacy.security_admin') }}</li>
        </ul>
      </section>

      <section id="droits" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.rights_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.rights_intro') }}</p>
        <dl class="mt-4 space-y-3">
          <div v-for="right in rights" :key="right">
            <dt class="font-semibold text-content-strong">{{ $t(`privacy.right_${right}_title`) }}</dt>
            <dd class="text-content">{{ $t(`privacy.right_${right}_body`) }}</dd>
          </div>
        </dl>
        <p class="mt-4 text-content">{{ $t('privacy.rights_how') }}</p>
        <p class="mt-3 text-content">{{ $t('privacy.rights_limits') }}</p>
        <p class="mt-3 text-content">
          {{ $t('privacy.rights_cnil') }}
          <a class="text-accent hover:underline" href="https://www.cnil.fr" rel="noopener" target="_blank">
            cnil.fr
          </a>
        </p>
        <address class="mt-3 not-italic text-sm text-content-muted">
          CNIL — 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, France
        </address>
      </section>

      <section id="mineurs" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.minors_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.minors_body') }}</p>
      </section>

      <section id="modifications" class="mt-12 scroll-mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('privacy.changes_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('privacy.changes_body') }}</p>
        <p class="mt-3 text-content">
          {{ $t('privacy.changes_legal_notice') }}
          <NuxtLink :to="localePath('/mentions-legales')" class="text-accent hover:underline">
            {{ $t('footer.legal_notice') }}
          </NuxtLink>
        </p>
      </section>
    </article>
  </div>
</template>
