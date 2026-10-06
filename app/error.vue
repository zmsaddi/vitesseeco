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

/**
 * The sentence for each status that has one of its own. Everything else is
 * "an error on our side" — which a 503 is not: it is an outage that will pass,
 * the catalogue or the database asleep, and the visitor is told to come back
 * rather than that the shop is broken. A 429 reaches here when the session
 * check behind the account area was refused (middleware/auth.ts).
 */
const MESSAGE_BY_STATUS: Record<number, string> = {
  404: 'errors.page_not_found',
  429: 'errors.rate_limited',
  503: 'errors.service_unavailable',
}
const messageKey = computed(() => MESSAGE_BY_STATUS[props.error?.statusCode ?? 500] ?? 'errors.internal')
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
