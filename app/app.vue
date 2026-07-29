<script setup lang="ts">
import { alternatesFor, getLocale, localizedUrl, resolvePath, type LocaleCode } from '~~/shared/locales'

/**
 * The document shell.
 *
 * Canonical and hreflang are derived from the locales manifest, so they cannot
 * drift from the sitemap or from what the router actually serves — and when a
 * market later moves onto its own country domain, these tags follow without an
 * edit here.
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

useHead(() => ({
  htmlAttrs: { lang: locale.value, dir: seo.value.dir },
  link: [
    { rel: 'canonical', href: seo.value.canonical },
    ...seo.value.alternates.map((alternate) => ({
      rel: 'alternate',
      hreflang: alternate.hreflang,
      href: alternate.href,
    })),
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
