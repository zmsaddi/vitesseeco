<script setup lang="ts">
/**
 * Frequently asked questions.
 *
 * The curated list below is the baseline, translated and guaranteed: it renders
 * whether or not the CMS answers, so this page cannot become empty because a
 * document store had a bad minute. Anything the owner adds in the Studio is
 * appended to it — the two are merged for display AND for the structured data,
 * so a question a visitor can read is a question Google can read.
 *
 * The accordion is <details>/<summary>, which the browser already makes
 * keyboard-operable and announces correctly. A hand-built one needs aria-expanded,
 * aria-controls, focus management and an Escape handler to reach the same place,
 * and usually gets one of them wrong.
 */
const localePath = useLocalePath()
const { t, locale } = useI18n()

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

/**
 * Extra questions the owner has written in the Studio. Fetched lazily and
 * tolerantly: a failure leaves the curated list standing.
 */
const { data: cms } = await useFetch<{ faqs: Array<{ id: string; question: string; answer: string }> }>(
  '/api/content/faq',
  { query: computed(() => ({ locale: locale.value })), default: () => ({ faqs: [] }) }
)
const extraQuestions = computed(() => cms.value?.faqs ?? [])

/** Everything a visitor can read here, curated and authored alike. */
const allQuestions = computed(() => [
  ...questions.map((item) => ({ question: t(item.q), answer: t(item.a) })),
  ...extraQuestions.value.map((item) => ({ question: item.question, answer: item.answer })),
])

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
    mainEntity: allQuestions.value.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
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

      <!-- Written by the owner in the Studio. Kept visually identical to the
           curated sections so a reader cannot tell, and should not have to. -->
      <section v-if="extraQuestions.length">
        <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('faq.section_more') }}</h2>
        <ul class="mt-4 space-y-3">
          <li v-for="item in extraQuestions" :key="item.id">
            <details class="card group p-5">
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-content-strong [&::-webkit-details-marker]:hidden"
              >
                <span>{{ item.question }}</span>
                <Icon
                  name="ph:caret-down"
                  class="h-5 w-5 shrink-0 text-content-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <p class="mt-3 whitespace-pre-line text-content">{{ item.answer }}</p>
            </details>
          </li>
        </ul>
      </section>
    </div>

    <section class="card mt-12 max-w-3xl p-6 sm:p-8">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('faq.still_title') }}</h2>
      <p class="mt-3 text-content">{{ $t('faq.still_body') }}</p>

      <ul class="mt-5 space-y-1 text-sm text-content-muted">
        <li><ContactLink kind="email" class="hover:text-content-strong" /></li>
        <li><ContactLink kind="phone" class="hover:text-content-strong" /></li>
        <li><ContactLink kind="whatsapp" label="WhatsApp" class="hover:text-content-strong" /></li>
      </ul>

      <NuxtLink :to="localePath('/contact')" class="btn-primary mt-6">{{ $t('nav.contact') }}</NuxtLink>
    </section>
  </div>
</template>
