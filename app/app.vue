<script setup lang="ts">
import { LOCALES, alternatesFor, getLocale, localizedUrl, resolvePath, type LocaleCode } from '~~/shared/locales'
import { ORGANISATION, SITE_URL } from '~~/shared/organisation'

/**
 * The document shell.
 *
 * Canonical and hreflang are derived from the locales manifest, so they cannot
 * drift from the sitemap or from what the router actually serves — and when a
 * market later moves onto its own country domain, these tags follow without an
 * edit here.
 *
 * The site-wide structured data lives here too. Organization and LocalBusiness
 * are what let Google connect this domain to a real shop with an address and a
 * phone number, which is the difference between appearing as a business and
 * appearing as a page.
 */
const route = useRoute()
const { locale } = useI18n()

const seo = computed(() => {
  const current = locale.value as LocaleCode
  const { path } = resolvePath(route.path)
  return {
    dir: getLocale(current).dir,
    canonical: localizedUrl(path, current),
    alternates: alternatesFor(path),
  }
})

/**
 * A page may override the canonical — the product page consolidates the colours
 * of one model onto a single URL, so six near-identical pages stop competing
 * with each other for the same query.
 */
const canonicalOverride = useState<string | null>('canonical-override', () => null)

const organisationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: ORGANISATION.name,
      legalName: ORGANISATION.legalName,
      url: SITE_URL,
      email: ORGANISATION.email,
      telephone: ORGANISATION.phone,
      vatID: ORGANISATION.vatNumber,
      address: {
        '@type': 'PostalAddress',
        streetAddress: ORGANISATION.address.street,
        postalCode: ORGANISATION.address.postalCode,
        addressLocality: ORGANISATION.address.city,
        addressRegion: ORGANISATION.address.region,
        addressCountry: ORGANISATION.address.country,
      },
    },
    {
      '@type': 'LocalBusiness',
      '@id': `${SITE_URL}/#localbusiness`,
      name: ORGANISATION.name,
      parentOrganization: { '@id': `${SITE_URL}/#organization` },
      url: SITE_URL,
      telephone: ORGANISATION.phone,
      email: ORGANISATION.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: ORGANISATION.address.street,
        postalCode: ORGANISATION.address.postalCode,
        addressLocality: ORGANISATION.address.city,
        addressCountry: ORGANISATION.address.country,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: ORGANISATION.geo.latitude,
        longitude: ORGANISATION.geo.longitude,
      },
      areaServed: ORGANISATION.deliversTo.map((code) => ({ '@type': 'Country', name: code })),
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: ORGANISATION.name,
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/produits?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

/**
 * What a shared link looks like.
 *
 * The site shipped with no OpenGraph tags at all: pasting vitesse-eco.fr into
 * WhatsApp produced a bare URL with no picture, no title and no description —
 * and the contact page itself says WhatsApp is how most customers open a
 * conversation. Product pages carried an og:image and nothing else, so a shared
 * bike showed a photograph with no name and no price beside it.
 *
 * These are DEFAULTS. A page that knows better — a product, an article — sets
 * its own ogImage and wins, because a page's useSeoMeta is resolved after the
 * root's.
 *
 * There is deliberately NO og:title or og:description here. The obvious way to
 * write them — `ogTitle: '%s'` — was tried and shipped the literal two
 * characters `%s` into the tag: Unhead only substitutes that parameter inside a
 * title template, and it was checked in the served HTML rather than assumed.
 * A root component cannot see the title a page will set, and every scraper that
 * matters falls back to <title> and <meta name="description"> when these are
 * absent — so the honest fix is the titleTemplate below, which makes that
 * fallback carry the shop's name.
 *
 * The card is generated from the brand kit rather than cropped from a poster —
 * public/brand/og-card.svg, rendered by scripts/build-og-image.mjs. It is a
 * JPEG on purpose: Facebook and WhatsApp are still inconsistent about SVG and
 * WebP, and a preview that fails to load looks broken rather than absent.
 */
useSeoMeta({
  ogSiteName: ORGANISATION.name,
  ogType: 'website',
  ogUrl: () => canonicalOverride.value ?? seo.value.canonical,
  ogImage: `${SITE_URL}/og-default.jpg`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/jpeg',
  ogImageAlt: () => `${ORGANISATION.name} — ${ORGANISATION.address.city}`,
  // Facebook wants xx_XX; the manifest's format locale is the same value with
  // a hyphen, and 'ar' has no region to give.
  ogLocale: () => (getLocale(locale.value as LocaleCode)?.formatLocale ?? 'fr-FR').replace('-', '_'),
  ogLocaleAlternate: () =>
    LOCALES.filter((entry) => entry.code !== locale.value).map((entry) =>
      entry.formatLocale.replace('-', '_')
    ),
  twitterCard: 'summary_large_image',
  twitterImage: `${SITE_URL}/og-default.jpg`,
})

useHead(() => ({
  /**
   * Tabs said "Panier" and "Nos produits" — true, and true of any shop. A
   * customer with six tabs open could not tell which one was ours, and a shared
   * link inherited the same anonymous title.
   *
   * A function rather than a '%s · Vitesse Eco' string, because some titles
   * already carry the name: product SEO titles are authored in Studio and most
   * of them end in "| Vitesse Eco". A plain suffix would have printed it twice.
   */
  titleTemplate: (title?: string) =>
    !title ? ORGANISATION.name
    : title.includes(ORGANISATION.name) ? title
    : `${title} · ${ORGANISATION.name}`,
  htmlAttrs: { lang: locale.value, dir: seo.value.dir },
  link: [
    { rel: 'canonical', href: canonicalOverride.value ?? seo.value.canonical },
    // Shipped since the first build and advertised by nothing: without these the
    // manifest is a file nobody fetches and the shop cannot be installed, and the
    // browser search box never learns the site can be searched.
    { rel: 'manifest', href: '/manifest.webmanifest' },
    { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
    { rel: 'icon', href: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    {
      rel: 'search',
      type: 'application/opensearchdescription+xml',
      title: ORGANISATION.name,
      href: '/opensearch.xml',
    },
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: `${ORGANISATION.name} — blog`,
      href: '/feeds/blog.xml',
    },
    ...seo.value.alternates.map((alternate) => ({
      rel: 'alternate',
      hreflang: alternate.hreflang,
      href: alternate.href,
    })),
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(organisationJsonLd),
    },
  ],
}))
</script>

<template>
  <div class="min-h-dvh bg-surface text-content">
    <!-- Keyboard users reach the content without tabbing the whole header. -->
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-contrast"
    >
      {{ $t('a11y.skip_to_content') }}
    </a>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
