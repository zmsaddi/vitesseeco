<template>
  <div :dir="dir" :lang="locale">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const route = useRoute()
const dir = computed(() => locale.value === 'ar' ? 'rtl' : 'ltr')

const locales = [
  { code: 'fr', hreflang: 'fr-FR', prefix: '' },
  { code: 'en', hreflang: 'en-GB', prefix: '/en' },
  { code: 'es', hreflang: 'es-ES', prefix: '/es' },
  { code: 'nl', hreflang: 'nl-NL', prefix: '/nl' },
  { code: 'de', hreflang: 'de-DE', prefix: '/de' },
  { code: 'ar', hreflang: 'ar-SA', prefix: '/ar' },
]

const baseUrl = 'https://vitesse-eco.fr'

/**
 * A locale-independent path a page nominates as its canonical, in place of the
 * one it was reached by. Set by product pages so colour variants consolidate
 * onto their model's primary URL. Null means "this URL is its own canonical".
 */
const canonicalOverride = useState<string | null>('canonical-override', () => null)

// Cleared on every navigation, or one product's canonical leaks onto the next
// page the customer visits.
watch(() => route.fullPath, () => { canonicalOverride.value = null })

// Get the path without locale prefix
const pathWithoutLocale = computed(() => {
  const path = route.path
  for (const l of locales) {
    if (l.prefix && (path === l.prefix || path.startsWith(l.prefix + '/'))) {
      return path.slice(l.prefix.length) || '/'
    }
  }
  return path
})

useHead(() => {
  // A prefixed home resolves to "/en" + "/" = "/en/", which contradicts the
  // "/en" the sitemap publishes; a locale prefix already IS the page.
  const rawPath = pathWithoutLocale.value
  const path = rawPath === '/' ? '' : rawPath
  const links: any[] = []

  // Canonical.
  // A page may nominate a different one — colour variants of a bike point at
  // their model's primary URL, so the ranking signal for the model name lands
  // on one page instead of being split across six and then collapsed by Google
  // to a canonical of its own choosing.
  const currentPrefix = locales.find(l => l.code === locale.value)?.prefix || ''
  const canonicalPath = canonicalOverride.value ?? path
  links.push({ rel: 'canonical', href: `${baseUrl}${currentPrefix}${canonicalPath}` })

  // Hreflang alternates always describe the canonical page, or the cluster
  // contradicts itself: an alternate pointing at a URL that canonicalises
  // elsewhere is an instruction Google resolves by ignoring both.
  for (const l of locales) {
    links.push({
      rel: 'alternate',
      hreflang: l.hreflang,
      href: `${baseUrl}${l.prefix}${canonicalPath}`,
    })
  }

  // Belgium (U-K1): both Belgian language communities are served by the
  // existing fr/nl pages — declare the regional variants explicitly.
  links.push({ rel: 'alternate', hreflang: 'fr-BE', href: `${baseUrl}${path}` })
  links.push({ rel: 'alternate', hreflang: 'nl-BE', href: `${baseUrl}/nl${path}` })

  // x-default (French)
  links.push({
    rel: 'alternate',
    hreflang: 'x-default',
    href: `${baseUrl}${path}`,
  })

  // U-S0b distribution pack: browser search registration, blog RSS
  // autodiscovery, installable-app manifest.
  links.push({ rel: 'search', type: 'application/opensearchdescription+xml', title: 'Vitesse Eco', href: '/opensearch.xml' })
  links.push({ rel: 'alternate', type: 'application/rss+xml', title: 'Vitesse Eco — Blog', href: `${baseUrl}/feeds/blog.xml` })
  links.push({ rel: 'manifest', href: '/manifest.webmanifest' })

  return {
    htmlAttrs: {
      lang: locale.value,
      dir: dir.value,
    },
    link: links,
    // Sitewide social/share defaults — pages override what they set.
    meta: [
      { property: 'og:site_name', content: 'Vitesse Eco' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'theme-color', content: '#0A1628' },
    ],
  }
})
</script>
