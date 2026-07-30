<script setup lang="ts">
import { alternatesFor, getLocale, localizedUrl, resolvePath, type LocaleCode } from '~~/shared/locales'
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

useHead(() => ({
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
