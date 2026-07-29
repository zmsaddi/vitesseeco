<script setup lang="ts">
/**
 * Frequently asked questions.
 *
 * The list is held here rather than fetched: there is no FAQ document type in
 * server/catalog, and inventing one from a page would put a query in the wrong
 * layer. Moving these into the CMS later is a change to this file alone.
 *
 * The accordion is <details>/<summary>, which the browser already makes
 * keyboard-operable and announces correctly. A hand-built one needs aria-expanded,
 * aria-controls, focus management and an Escape handler to reach the same place,
 * and usually gets one of them wrong.
 */
const localePath = useLocalePath()
const { t } = useI18n()

interface Question {
  q: string
  a: string
  links?: { to: string; label: string }[]
}

const sections: { heading: string; items: Question[] }[] = [
  {
    heading: 'faq.section_delivery',
    items: [
      { q: 'faq.q_where', a: 'faq.a_where' },
      { q: 'faq.q_cost', a: 'faq.a_cost' },
      { q: 'faq.q_time', a: 'faq.a_time' },
      { q: 'faq.q_pickup', a: 'faq.a_pickup' },
    ],
  },
  {
    heading: 'faq.section_payment',
    items: [
      { q: 'faq.q_payment_methods', a: 'faq.a_payment_methods' },
      { q: 'faq.q_cash', a: 'faq.a_cash' },
      { q: 'faq.q_payment_security', a: 'faq.a_payment_security' },
    ],
  },
  {
    heading: 'faq.section_bikes',
    items: [
      { q: 'faq.q_assembled', a: 'faq.a_assembled' },
      { q: 'faq.q_range', a: 'faq.a_range' },
      { q: 'faq.q_charging', a: 'faq.a_charging' },
      { q: 'faq.q_legal', a: 'faq.a_legal' },
    ],
  },
  {
    heading: 'faq.section_after_sales',
    items: [
      { q: 'faq.q_warranty', a: 'faq.a_warranty', links: [{ to: '/cgv', label: 'footer.terms' }] },
      {
        q: 'faq.q_returns',
        a: 'faq.a_returns',
        links: [
          { to: '/retractation', label: 'footer.withdrawal' },
          { to: '/cgv', label: 'footer.terms' },
        ],
      },
      { q: 'faq.q_parts', a: 'faq.a_parts' },
      { q: 'faq.q_tracking', a: 'faq.a_tracking', links: [{ to: '/compte', label: 'account.title' }] },
    ],
  },
]

const questions = sections.flatMap((section) => section.items)

useSeoMeta({
  title: () => t('faq.title'),
  description: () => t('faq.description'),
  robots: 'index, follow',
})

// Built from the same keys the page renders, so the structured data can never
// promise an answer the visitor does not see — which is what gets a rich result
// removed rather than shown.
const structuredData = computed(() =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: t(item.q),
      acceptedAnswer: { '@type': 'Answer', text: t(item.a) },
    })),
  })
)

useHead({
  script: [{ type: 'application/ld+json', innerHTML: structuredData }],
})
</script>

<template>
  <div class="container-page py-16">
    <div class="max-w-3xl">
      <h1 class="font-display text-3xl font-extrabold text-content-strong sm:text-4xl">{{ $t('faq.title') }}</h1>
      <p class="mt-4 text-lg text-content">{{ $t('faq.lead') }}</p>
    </div>

    <div class="mt-12 max-w-3xl space-y-10">
      <section v-for="section in sections" :key="section.heading">
        <h2 class="font-display text-xl font-bold text-content-strong">{{ $t(section.heading) }}</h2>

        <ul class="mt-4 space-y-3">
          <li v-for="item in section.items" :key="item.q">
            <details class="card group p-5">
              <!-- The default disclosure triangle is removed in favour of a
                   chevron that can carry the open state; the element keeps its
                   own semantics either way. -->
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-content-strong [&::-webkit-details-marker]:hidden"
              >
                <span>{{ $t(item.q) }}</span>
                <Icon
                  name="ph:caret-down"
                  class="h-5 w-5 shrink-0 text-content-muted transition-transform group-open:rotate-180"
                />
              </summary>

              <p class="mt-3 text-content">{{ $t(item.a) }}</p>

              <div v-if="item.links" class="mt-3 flex flex-wrap gap-4">
                <NuxtLink
                  v-for="link in item.links"
                  :key="link.to"
                  :to="localePath(link.to)"
                  class="text-sm font-medium text-accent hover:underline"
                >
                  {{ $t(link.label) }}
                </NuxtLink>
              </div>
            </details>
          </li>
        </ul>
      </section>
    </div>

    <section class="card mt-12 max-w-3xl p-6 sm:p-8">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('faq.still_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('faq.still_body') }}</p>

      <ul class="mt-5 space-y-1 text-sm text-content-muted">
        <li><a class="hover:text-content-strong" href="mailto:contact@vitesse-eco.fr">contact@vitesse-eco.fr</a></li>
        <li><a class="hover:text-content-strong" href="tel:+33745830049">+33 7 45 83 00 49</a></li>
        <li><a class="hover:text-content-strong" href="https://wa.me/33745830049" rel="noopener">WhatsApp</a></li>
      </ul>

      <NuxtLink :to="localePath('/contact')" class="btn-primary mt-6">{{ $t('nav.contact') }}</NuxtLink>
    </section>
  </div>
</template>
