<script setup lang="ts">
/**
 * The footer.
 *
 * The company line carries the legal identifiers a French SAS must publish.
 * It is written as separate elements rather than one interpolated string —
 * the old build joined them with "|", which vue-i18n reads as a plural
 * separator, and the company name and SIRET silently vanished in all six
 * languages.
 */
const localePath = useLocalePath()

const legal = [
  { to: '/impressum', label: 'footer.impressum' },
  { to: '/batteries', label: 'footer.batteries' },
  { to: '/mentions-legales', label: 'footer.legal_notice' },
  { to: '/politique-confidentialite', label: 'footer.privacy' },
  { to: '/cgv', label: 'footer.terms' },
  { to: '/retractation', label: 'footer.withdrawal' },
]

/**
 * Pages that help someone decide. They existed and nothing linked to them,
 * which for a blog or a comparison table is the same as not existing.
 */
const explore = [
  { to: '/guide', label: 'nav.guide' },
  { to: '/comparatif', label: 'nav.compare' },
  { to: '/blog', label: 'blog.title' },
  { to: '/faq', label: 'faq.title' },
]
</script>

<template>
  <footer class="mt-16 border-t border-surface-border bg-surface-sunken">
    <div class="container-page py-12">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p class="font-display text-lg font-extrabold text-content-strong">
            Vitesse<span class="text-accent">Eco</span>
          </p>
          <p class="mt-3 text-sm text-content-muted">{{ $t('footer.tagline') }}</p>
        </div>

        <div>
          <h2 class="text-sm font-semibold text-content-strong">{{ $t('footer.contact') }}</h2>
          <address class="mt-3 space-y-1 text-sm not-italic text-content-muted">
            <p>32 Rue du Faubourg du Pont Neuf</p>
            <p>86000 Poitiers, France</p>
            <p>
              <ContactLink kind="email" class="hover:text-content-strong" />
            </p>
            <p><ContactLink kind="phone" class="hover:text-content-strong" /></p>
          </address>
        </div>

        <div>
          <h2 class="text-sm font-semibold text-content-strong">{{ $t('footer.legal') }}</h2>
          <ul class="mt-3 space-y-1 text-sm">
            <li v-for="entry in legal" :key="entry.to">
              <NuxtLink :to="localePath(entry.to)" class="text-content-muted hover:text-content-strong">
                {{ $t(entry.label) }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-sm font-semibold text-content-strong">{{ $t('footer.explore') }}</h2>
          <ul class="mt-3 space-y-1 text-sm">
            <li v-for="entry in explore" :key="entry.to">
              <NuxtLink :to="localePath(entry.to)" class="text-content-muted hover:text-content-strong">
                {{ $t(entry.label) }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-sm font-semibold text-content-strong">{{ $t('footer.delivery') }}</h2>
          <p class="mt-3 text-sm text-content-muted">{{ $t('footer.delivery_note') }}</p>
        </div>
      </div>

      <!-- Each identifier is its own element, so no separator character can be
           mistaken for i18n syntax and swallow the rest of the line. -->
      <p class="mt-10 flex flex-wrap gap-x-2 gap-y-1 border-t border-surface-border pt-6 text-xs text-content-muted">
        <span>VITESSE ECO SAS</span>
        <span aria-hidden="true">·</span>
        <span>SIREN 100 732 247</span>
        <span aria-hidden="true">·</span>
        <span>TVA FR43 100 732 247</span>
        <span aria-hidden="true">·</span>
        <span>&copy; {{ new Date().getFullYear() }}</span>
      </p>
    </div>
  </footer>
</template>
