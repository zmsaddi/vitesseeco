<script setup lang="ts">
import { getLocale, isLocaleCode } from '~~/shared/locales'

/**
 * The customer's own details.
 *
 * Read-only, because nothing on the server writes them: /api/auth/me is the only
 * route that touches a customer record and it only reads. An input that silently
 * saves nothing is worse than no input at all, so the page shows the values and
 * says plainly where a correction is made until the endpoint exists.
 */
definePageMeta({ middleware: 'auth' })

const localePath = useLocalePath()
const { t } = useI18n()

interface Me {
  id: string
  email: string
  firstName: string
  lastName: string
  locale: string
}

// Stated explicitly: the route is wrapped by defineRoute, so its shape cannot be
// inferred through the wrapper.
const { data: me } = await useFetch<Me | null>('/api/auth/me')

/** The language named in its own language, taken from the locales manifest. */
const languageLabel = computed(() => {
  const code = me.value?.locale
  return isLocaleCode(code) ? getLocale(code).label : (code ?? '')
})

useSeoMeta({ title: () => t('profile.title'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-10">
    <NuxtLink :to="localePath('/compte')" class="text-sm text-content-muted hover:text-accent">
      {{ $t('account.title') }}
    </NuxtLink>

    <h1 class="mt-2 font-display text-3xl font-extrabold text-content-strong">
      {{ $t('profile.title') }}
    </h1>

    <div v-if="me" class="mt-8 max-w-2xl">
      <dl class="card divide-y divide-surface-border">
        <div class="flex flex-wrap items-baseline justify-between gap-2 p-5">
          <dt class="text-sm text-content-muted">{{ $t('auth.first_name') }}</dt>
          <dd class="text-content-strong">{{ me.firstName }}</dd>
        </div>
        <div class="flex flex-wrap items-baseline justify-between gap-2 p-5">
          <dt class="text-sm text-content-muted">{{ $t('auth.last_name') }}</dt>
          <dd class="text-content-strong">{{ me.lastName }}</dd>
        </div>
        <div class="flex flex-wrap items-baseline justify-between gap-2 p-5">
          <dt class="text-sm text-content-muted">{{ $t('auth.email') }}</dt>
          <dd class="break-all text-content-strong">{{ me.email }}</dd>
        </div>
        <div class="flex flex-wrap items-baseline justify-between gap-2 p-5">
          <dt class="text-sm text-content-muted">{{ $t('profile.language') }}</dt>
          <dd class="text-content-strong">{{ languageLabel }}</dd>
        </div>
      </dl>

      <p class="mt-6 text-sm text-content-muted">
        {{ $t('profile.read_only') }}
        <NuxtLink :to="localePath('/contact')" class="font-medium text-accent hover:underline">
          {{ $t('contact.title') }}
        </NuxtLink>
      </p>

      <!-- Addresses are the one part of the record a customer can already change
           themselves, so the page that can do it is offered here rather than
           leaving the note above looking like it covers everything. -->
      <NuxtLink :to="localePath('/compte/adresses')" class="btn-secondary mt-8">
        {{ $t('account.manage_addresses') }}
      </NuxtLink>
    </div>
  </div>
</template>
