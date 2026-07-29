<script setup lang="ts">
/**
 * Sign in.
 *
 * The CAPTCHA token is single-use at Cloudflare, so a rejected attempt is given
 * a fresh one before the button can be pressed again. The old build never reset
 * it, and one wrong password left the form permanently unusable until reload.
 */
const localePath = useLocalePath()
const route = useRoute()
const { t } = useI18n()

const form = reactive({ email: '', password: '' })
const captchaToken = ref('')
const captcha = ref<{ reset: () => void } | null>(null)
const submitting = ref(false)
const error = ref<string | null>(null)

/** Errors the OAuth callback reports by query string. */
const oauthError = computed(() => {
  const value = Array.isArray(route.query.error) ? route.query.error[0] : route.query.error
  return typeof value === 'string' ? value : null
})

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  error.value = null
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: form.email, password: form.password, captchaToken: captchaToken.value },
    })
    await navigateTo(localePath('/compte'))
  } catch (err: unknown) {
    const data = (err as { data?: { messageKey?: string } })?.data
    error.value = data?.messageKey ? t(data.messageKey) : t('errors.internal')
    // Burned at Cloudflare whether or not the password was right.
    captchaToken.value = ''
    captcha.value?.reset()
  } finally {
    submitting.value = false
  }
}

useSeoMeta({ title: () => t('auth.sign_in'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-16">
    <div class="mx-auto max-w-sm">
      <h1 class="font-display text-2xl font-extrabold text-content-strong">{{ $t('auth.sign_in') }}</h1>

      <a href="/api/auth/google" class="btn-secondary mt-6 w-full">
        <Icon name="ph:google-logo" class="h-5 w-5" />
        {{ $t('auth.continue_with_google') }}
      </a>

      <div class="my-6 flex items-center gap-3">
        <span class="h-px flex-1 bg-surface-border" />
        <span class="text-xs uppercase tracking-wide text-content-muted">{{ $t('auth.or') }}</span>
        <span class="h-px flex-1 bg-surface-border" />
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('auth.email') }}</span>
          <input v-model="form.email" type="email" autocomplete="email" required class="field mt-1" />
        </label>

        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('auth.password') }}</span>
          <input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            required
            class="field mt-1"
          />
        </label>

        <CaptchaWidget ref="captcha" v-model="captchaToken" />

        <p v-if="oauthError" role="alert" class="text-sm text-danger">
          {{ $t(`auth.oauth_${oauthError}`, $t('errors.internal')) }}
        </p>
        <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>

        <button type="submit" class="btn-primary w-full" :disabled="submitting || !captchaToken">
          {{ submitting ? $t('common.loading') : $t('auth.sign_in') }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-content-muted">
        {{ $t('auth.no_account') }}
        <NuxtLink :to="localePath('/inscription')" class="font-medium text-accent hover:underline">
          {{ $t('auth.create_account') }}
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
