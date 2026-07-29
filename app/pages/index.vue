<script setup lang="ts">
/**
 * Placeholder home page.
 *
 * The storefront is built in the catalogue step; this exists so the application
 * boots, the design tokens are exercised in both themes, and the pipeline has
 * something real to render.
 */
const { t } = useI18n()

useSeoMeta({
  title: () => t('home.title'),
  description: () => t('home.description'),
})
</script>

<template>
  <section class="container-page py-24">
    <p class="text-sm font-semibold uppercase tracking-widest text-accent">
      {{ $t('home.eyebrow') }}
    </p>
    <h1 class="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight text-content-strong sm:text-5xl">
      {{ $t('home.title') }}
    </h1>
    <p class="mt-4 max-w-2xl text-lg text-content-muted">
      {{ $t('home.description') }}
    </p>
  </section>
</template>
