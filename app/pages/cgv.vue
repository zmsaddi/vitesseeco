<script setup lang="ts">
/**
 * Conditions générales de vente.
 *
 * The articles are declared once, as data, and drive both the table of contents
 * and the body. Numbering therefore cannot drift between the index and the
 * article it points at — which is the first thing a customer quotes back at you
 * in a dispute, and the last thing anyone remembers to check after an edit.
 */
const localePath = useLocalePath()
const { locale, t } = useI18n()

const { formatLongDate } = useFormatDate()
interface Article {
  /** Anchor. Kept in French in every language so a shared link survives a
   *  language switch instead of landing at the top of the page. */
  id: string
  title: string
  body: string[]
  /** Statutes French law requires be reproduced word for word. The reference is
   *  the name of a French text, so it is literal rather than translated. */
  quotes?: { ref: string; text: string }[]
  note?: string
  link?: { to: string; label: string }
  external?: string
  /** Article 1 carries the seller's identifiers, which are facts and not copy. */
  identity?: boolean
}

const ARTICLES: Article[] = [
  {
    id: 'vendeur',
    title: 'cgv.seller_title',
    body: ['cgv.seller_p1', 'cgv.seller_p2'],
    identity: true,
  },
  {
    id: 'objet',
    title: 'cgv.scope_title',
    body: ['cgv.scope_p1', 'cgv.scope_p2', 'cgv.scope_p3', 'cgv.scope_p4'],
  },
  {
    id: 'commande',
    title: 'cgv.order_title',
    body: [
      'cgv.order_p1',
      'cgv.order_p2',
      'cgv.order_p3',
      'cgv.order_p4',
      'cgv.order_p5',
      'cgv.order_p6',
    ],
  },
  {
    id: 'prix',
    title: 'cgv.prices_title',
    body: ['cgv.prices_p1', 'cgv.prices_p2', 'cgv.prices_p3', 'cgv.prices_p4', 'cgv.prices_p5'],
  },
  {
    id: 'paiement',
    title: 'cgv.payment_title',
    body: [
      'cgv.payment_p1',
      'cgv.payment_p2',
      'cgv.payment_p3',
      'cgv.payment_p4',
      'cgv.payment_p5',
    ],
  },
  {
    id: 'livraison',
    title: 'cgv.delivery_title',
    body: [
      'cgv.delivery_p1',
      'cgv.delivery_p2',
      'cgv.delivery_p3',
      'cgv.delivery_p4',
      'cgv.delivery_p5',
      'cgv.delivery_p6',
    ],
  },
  {
    id: 'risques',
    title: 'cgv.risk_title',
    body: ['cgv.risk_p1', 'cgv.risk_p2'],
  },
  {
    id: 'retractation',
    title: 'cgv.withdrawal_title',
    body: [
      'cgv.withdrawal_p1',
      'cgv.withdrawal_p2',
      'cgv.withdrawal_p3',
      'cgv.withdrawal_p4',
      'cgv.withdrawal_p5',
      'cgv.withdrawal_p6',
    ],
    link: { to: '/retractation', label: 'cgv.withdrawal_link' },
  },
  {
    id: 'garanties-legales',
    title: 'cgv.guarantees_title',
    body: [
      'cgv.guarantees_p1',
      'cgv.guarantees_p2',
      'cgv.guarantees_p3',
      'cgv.guarantees_p4',
      'cgv.guarantees_p5',
    ],
    quotes: [
      { ref: 'Article L217-3 du Code de la consommation', text: 'cgv.quote_l217_3' },
      { ref: 'Article L217-7 du Code de la consommation', text: 'cgv.quote_l217_7' },
      { ref: 'Article L217-9 du Code de la consommation', text: 'cgv.quote_l217_9' },
      { ref: 'Article 1641 du Code civil', text: 'cgv.quote_civil_1641' },
      { ref: 'Article 1648, alinéa 1er, du Code civil', text: 'cgv.quote_civil_1648' },
    ],
    note: 'cgv.guarantees_note',
  },
  {
    id: 'garantie-commerciale',
    title: 'cgv.warranty_title',
    body: ['cgv.warranty_p1', 'cgv.warranty_p2', 'cgv.warranty_p3'],
  },
  {
    id: 'responsabilite',
    title: 'cgv.liability_title',
    body: ['cgv.liability_p1', 'cgv.liability_p2', 'cgv.liability_p3'],
  },
  {
    id: 'donnees',
    title: 'cgv.data_title',
    body: ['cgv.data_p1', 'cgv.data_p2'],
    link: { to: '/politique-confidentialite', label: 'cgv.data_link' },
  },
  {
    id: 'litiges',
    title: 'cgv.law_title',
    body: ['cgv.law_p1', 'cgv.law_p2', 'cgv.law_p3', 'cgv.law_p4'],
    note: 'cgv.law_p5',
  },
]

/**
 * Fixed, not the render date. A terms page that always claims to be current
 * tells the reader nothing about whether the terms actually changed, and the
 * date is the only way a customer can tell which version they agreed to.
 */
const UPDATED_AT = '2026-07-29'

// Parsed at midday: a bare date string is UTC midnight, which formats as the
// previous day for anyone west of Greenwich.
const updatedOn = computed(() =>
  formatLongDate(`${UPDATED_AT}T12:00:00Z`)
)

useSeoMeta({
  title: () => t('cgv.title'),
  description: () => t('cgv.description'),
  robots: 'index, follow',
})
</script>

<template>
  <div class="container-page py-10">
    <article class="mx-auto max-w-3xl">
      <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('cgv.title') }}</h1>

      <p class="mt-2 text-sm text-content-muted">
        {{ $t('cgv.updated') }}
        <time :datetime="UPDATED_AT">{{ updatedOn }}</time>
      </p>

      <p class="mt-6 leading-relaxed text-content">{{ $t('cgv.intro') }}</p>

      <!-- Thirteen articles is a document, not a page: without an index nobody
           finds the one clause they came for. -->
      <nav class="card mt-8 p-5" :aria-label="$t('cgv.toc_title')">
        <h2 class="font-display font-bold text-content-strong">{{ $t('cgv.toc_title') }}</h2>
        <ol class="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <li v-for="(article, index) in ARTICLES" :key="article.id">
            <a :href="`#${article.id}`" class="text-content-muted underline-offset-2 hover:text-accent hover:underline">
              {{ index + 1 }}. {{ $t(article.title) }}
            </a>
          </li>
        </ol>
      </nav>

      <div class="mt-12 space-y-12">
        <!-- scroll-mt clears the sticky header, which would otherwise cover the
             heading the reader just jumped to. -->
        <section v-for="(article, index) in ARTICLES" :id="article.id" :key="article.id" class="scroll-mt-24">
          <h2 class="font-display text-xl font-bold text-content-strong">
            {{ index + 1 }}. {{ $t(article.title) }}
          </h2>

          <div class="mt-4 space-y-4 leading-relaxed text-content">
            <p v-for="paragraph in article.body" :key="paragraph">{{ $t(paragraph) }}</p>
          </div>

          <address v-if="article.identity" class="card mt-5 space-y-1 bg-surface-sunken p-5 text-sm not-italic text-content">
            <p class="font-semibold text-content-strong">VITESSE ECO SAS</p>
            <p>SIREN 100 732 247</p>
            <p>TVA intracommunautaire FR43 100 732 247</p>
            <p>32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France</p>
            <p><a class="text-accent hover:underline" href="mailto:contact@vitesse-eco.fr">contact@vitesse-eco.fr</a></p>
            <p><a class="text-accent hover:underline" href="tel:+33745830049">+33 7 45 83 00 49</a></p>
            <p>
              <a class="text-accent hover:underline" href="https://wa.me/33745830049" target="_blank" rel="noopener noreferrer">
                WhatsApp wa.me/33745830049
              </a>
            </p>
          </address>

          <!-- Reproduced rather than summarised: French law requires the buyer be
               shown these texts themselves, not our reading of them. -->
          <div v-if="article.quotes" class="card mt-5 space-y-4 bg-surface-sunken p-5">
            <blockquote v-for="quote in article.quotes" :key="quote.text">
              <p class="text-sm font-semibold text-content-strong">{{ quote.ref }}</p>
              <p class="mt-1 text-sm leading-relaxed text-content-muted">{{ $t(quote.text) }}</p>
            </blockquote>
          </div>

          <p v-if="article.external" class="mt-4">
            <a
              :href="article.external"
              target="_blank"
              rel="noopener noreferrer"
              class="break-all text-accent hover:underline"
            >{{ article.external }}</a>
          </p>

          <p v-if="article.note" class="mt-4 text-sm leading-relaxed text-content-muted">
            {{ $t(article.note) }}
          </p>

          <NuxtLink v-if="article.link" :to="localePath(article.link.to)" class="btn-secondary mt-5">
            {{ $t(article.link.label) }}
          </NuxtLink>
        </section>
      </div>
    </article>
  </div>
</template>
