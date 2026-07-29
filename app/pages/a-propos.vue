<script setup lang="ts">
/**
 * About the shop.
 *
 * Everything stated here is something the business can be held to: the towns it
 * delivers to, the address it trades from, the terms it sells on. There is no
 * stats band of founding years or customer counts, because a number nobody can
 * check is the first thing a careful buyer stops believing.
 */
const localePath = useLocalePath()
const { t } = useI18n()

const facts = [
  { label: 'about.fact_countries_label', value: 'about.fact_countries_value' },
  { label: 'about.fact_delivery_label', value: 'about.fact_delivery_value' },
  { label: 'about.fact_shop_label', value: 'about.fact_shop_value' },
]

const range = [
  { title: 'about.range_bikes_title', body: 'about.range_bikes_body' },
  { title: 'about.range_parts_title', body: 'about.range_parts_body' },
  { title: 'about.range_accessories_title', body: 'about.range_accessories_body' },
  { title: 'about.range_kids_title', body: 'about.range_kids_body' },
]

useSeoMeta({
  title: () => t('about.title'),
  description: () => t('about.description'),
  robots: 'index, follow',
})
</script>

<template>
  <div class="container-page py-16">
    <section class="max-w-3xl">
      <p class="text-sm font-semibold uppercase tracking-widest text-accent">{{ $t('about.eyebrow') }}</p>
      <h1 class="mt-3 font-display text-4xl font-extrabold leading-tight text-content-strong sm:text-5xl">
        {{ $t('about.title') }}
      </h1>
      <p class="mt-5 text-lg text-content">{{ $t('about.lead') }}</p>
    </section>

    <!-- Only figures that come from the way the shop actually trades. -->
    <dl class="mt-12 grid gap-4 sm:grid-cols-3">
      <div v-for="fact in facts" :key="fact.label" class="card p-5">
        <dt class="text-sm text-content-muted">{{ $t(fact.label) }}</dt>
        <dd class="mt-1 font-display font-bold text-content-strong">{{ $t(fact.value) }}</dd>
      </div>
    </dl>

    <section class="mt-16">
      <h2 class="font-display text-2xl font-bold text-content-strong">{{ $t('about.range_title') }}</h2>
      <p class="mt-3 max-w-2xl text-content-muted">{{ $t('about.range_intro') }}</p>

      <ul class="mt-6 grid gap-4 sm:grid-cols-2">
        <li v-for="item in range" :key="item.title" class="card p-5">
          <h3 class="font-medium text-content-strong">{{ $t(item.title) }}</h3>
          <p class="mt-1 text-sm text-content-muted">{{ $t(item.body) }}</p>
        </li>
      </ul>
    </section>

    <section class="mt-16 grid gap-10 lg:grid-cols-2">
      <div>
        <h2 class="font-display text-2xl font-bold text-content-strong">{{ $t('about.delivery_title') }}</h2>
        <p class="mt-3 text-content">{{ $t('about.delivery_body') }}</p>
        <p class="mt-3 text-content">{{ $t('about.delivery_elsewhere') }}</p>
      </div>

      <div>
        <h2 class="font-display text-2xl font-bold text-content-strong">{{ $t('about.difference_title') }}</h2>
        <p class="mt-3 text-content">{{ $t('about.difference_body') }}</p>
        <p class="mt-3 text-content">{{ $t('about.difference_body_2') }}</p>
      </div>
    </section>

    <section class="card mt-16 p-6 sm:p-8">
      <h2 class="font-display text-2xl font-bold text-content-strong">{{ $t('about.contact_title') }}</h2>
      <p class="mt-3 max-w-2xl text-content">{{ $t('about.contact_body') }}</p>

      <div class="mt-6 grid gap-6 sm:grid-cols-2">
        <address class="space-y-1 text-sm not-italic text-content-muted">
          <p class="font-medium text-content-strong">VITESSE ECO SAS</p>
          <p>32 Rue du Faubourg du Pont Neuf</p>
          <p>86000 Poitiers, France</p>
        </address>

        <ul class="space-y-1 text-sm text-content-muted">
          <li><a class="hover:text-content-strong" href="mailto:contact@vitesse-eco.fr">contact@vitesse-eco.fr</a></li>
          <li><a class="hover:text-content-strong" href="tel:+33745830049">+33 7 45 83 00 49</a></li>
          <li>
            <a class="hover:text-content-strong" href="https://wa.me/33745830049" rel="noopener">WhatsApp</a>
          </li>
        </ul>
      </div>

      <div class="mt-8 flex flex-wrap gap-3">
        <NuxtLink :to="localePath('/produits')" class="btn-primary">{{ $t('about.cta_products') }}</NuxtLink>
        <NuxtLink :to="localePath('/contact')" class="btn-secondary">{{ $t('nav.contact') }}</NuxtLink>
      </div>

      <!-- The identifiers a French SAS must publish, repeated here because this
           is the page a buyer checks before trusting an unfamiliar shop. -->
      <p class="mt-8 flex flex-wrap gap-x-2 gap-y-1 border-t border-surface-border pt-6 text-xs text-content-muted">
        <span>SIREN 100 732 247</span>
        <span aria-hidden="true">·</span>
        <span>TVA FR43 100 732 247</span>
      </p>
    </section>
  </div>
</template>
