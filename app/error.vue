<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * The error page.
 *
 * It shows a status and a translated sentence, and nothing else. An error page
 * that renders `error.message` hands the visitor whatever the server happened
 * to throw — a query fragment, a file path, a provider's internal text — which
 * is a disclosure, not a courtesy.
 */
const props = defineProps<{ error: NuxtError }>()

const localePath = useLocalePath()

const isMissing = computed(() => props.error?.statusCode === 404)
const messageKey = computed(() => (isMissing.value ? 'errors.page_not_found' : 'errors.internal'))
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-surface px-4">
    <div class="w-full max-w-md text-center">
      <p class="font-display text-6xl font-extrabold text-accent">
        {{ error?.statusCode ?? 500 }}
      </p>
      <h1 class="mt-4 font-display text-2xl font-bold text-content-strong">
        {{ $t(messageKey) }}
      </h1>
      <NuxtLink :to="localePath('/')" class="btn-primary mt-8">
        {{ $t('errors.back_home') }}
      </NuxtLink>
    </div>
  </div>
</template>
