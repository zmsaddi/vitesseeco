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

useHead({
  htmlAttrs: {
    lang: locale,
    dir: dir,
  },
  link: computed(() => {
    const path = pathWithoutLocale.value
    const links: any[] = []

    // Canonical
    const currentPrefix = locales.find(l => l.code === locale.value)?.prefix || ''
    links.push({ rel: 'canonical', href: `${baseUrl}${currentPrefix}${path}` })

    // Hreflang alternates
    for (const l of locales) {
      links.push({
        rel: 'alternate',
        hreflang: l.hreflang,
        href: `${baseUrl}${l.prefix}${path}`,
      })
    }

    // x-default (French)
    links.push({
      rel: 'alternate',
      hreflang: 'x-default',
      href: `${baseUrl}${path}`,
    })

    return links
  }),
})
</script>
