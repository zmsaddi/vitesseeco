<script setup lang="ts">
/**
 * Legal notice — what article 6-III of the LCEN requires a French trader to
 * publish.
 *
 * The identifiers are literals rather than translation keys. A SIREN has no
 * French and no Dutch version, and putting one through i18n creates six places
 * for a digit to go wrong instead of one.
 *
 * Share capital is deliberately absent: the figure is not recorded anywhere in
 * this project, and a legal notice carrying an invented amount is worse than one
 * carrying none.
 */
const localePath = useLocalePath()
const { locale, t } = useI18n()

const LAST_UPDATED = '2026-07-29'
const updatedOn = computed(() => new Date(LAST_UPDATED).toLocaleDateString(locale.value))

useSeoMeta({
  title: () => t('mentions.title'),
  description: () => t('mentions.description'),
  robots: 'index, follow',
})
</script>

<template>
  <div class="container-page py-12">
    <article class="mx-auto max-w-3xl">
      <h1 class="font-display text-3xl font-extrabold text-content-strong">
        {{ $t('mentions.title') }}
      </h1>
      <p class="mt-2 text-sm text-content-muted">
        {{ $t('legal.last_updated') }}
        <time :datetime="LAST_UPDATED">{{ updatedOn }}</time>
      </p>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('mentions.publisher_title') }}
        </h2>

        <dl class="card mt-4 divide-y divide-surface-border text-sm">
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.company') }}</dt>
            <dd class="font-medium text-content-strong">VITESSE ECO SAS</dd>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.legal_form') }}</dt>
            <dd class="text-content-strong">{{ $t('mentions.legal_form_value') }}</dd>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.registered_office') }}</dt>
            <dd class="text-content-strong">
              <address class="not-italic">
                32 Rue du Faubourg du Pont Neuf<br />
                86000 Poitiers, France
              </address>
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.siren') }}</dt>
            <dd class="text-content-strong">100 732 247</dd>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.rcs') }}</dt>
            <dd class="text-content-strong">Poitiers 100 732 247</dd>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.vat') }}</dt>
            <dd class="text-content-strong">FR43 100 732 247</dd>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.email') }}</dt>
            <dd>
              <a class="text-accent hover:underline" href="mailto:contact@vitesse-eco.fr">
                contact@vitesse-eco.fr
              </a>
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.phone') }}</dt>
            <dd>
              <a class="text-accent hover:underline" href="tel:+33745830049">+33 7 45 83 00 49</a>
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 p-4">
            <dt class="w-56 shrink-0 text-content-muted">{{ $t('mentions.whatsapp') }}</dt>
            <dd>
              <a
                class="text-accent hover:underline"
                href="https://wa.me/33745830049"
                rel="noopener"
                target="_blank"
              >wa.me/33745830049</a>
            </dd>
          </div>
        </dl>
      </section>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('mentions.director_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('mentions.director_body') }}</p>
      </section>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('mentions.host_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('mentions.host_body') }}</p>
        <address class="mt-3 not-italic text-content-strong">
          Vercel Inc.<br />
          340 S Lemon Ave #4133<br />
          Walnut, CA 91789<br />
          {{ $t('mentions.host_country') }}
        </address>
        <p class="mt-3 text-sm">
          <a class="text-accent hover:underline" href="https://vercel.com" rel="noopener" target="_blank">
            vercel.com
          </a>
        </p>
      </section>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('mentions.providers_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('mentions.providers_intro') }}</p>
        <ul class="mt-3 space-y-2 text-content">
          <li>{{ $t('mentions.provider_database') }}</li>
          <li>{{ $t('mentions.provider_payments') }}</li>
          <li>{{ $t('mentions.provider_captcha') }}</li>
          <li>{{ $t('mentions.provider_cms') }}</li>
        </ul>
      </section>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('mentions.ip_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('mentions.ip_body') }}</p>
        <p class="mt-3 text-content">{{ $t('mentions.ip_brands') }}</p>
      </section>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('mentions.data_title') }}
        </h2>
        <p class="mt-3 text-content">
          {{ $t('mentions.data_body') }}
          <NuxtLink :to="localePath('/politique-confidentialite')" class="text-accent hover:underline">
            {{ $t('footer.privacy') }}
          </NuxtLink>
        </p>
      </section>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">
          {{ $t('mentions.disputes_title') }}
        </h2>
        <p class="mt-3 text-content">{{ $t('mentions.claims_body') }}</p>
        <p class="mt-3 text-content">
          {{ $t('mentions.terms_body') }}
          <NuxtLink :to="localePath('/cgv')" class="text-accent hover:underline">
            {{ $t('footer.terms') }}
          </NuxtLink>
        </p>
        <p class="mt-3 text-content">{{ $t('mentions.mediation_body') }}</p>
        <!-- No link to the EU ODR platform: it closed on 20 July 2025 when
             Regulation (EU) 2024/3228 repealed the ODR Regulation. Sending a
             consumer to a dead redress route is itself a misstatement, so the
             mediator above is named as the route that works. -->
        <p class="mt-3 text-content">{{ $t('mentions.odr_body') }}</p>
      </section>
    </article>
  </div>
</template>
