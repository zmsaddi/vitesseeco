<template>
  <div class="py-8 md:py-16">
    <div class="container-custom max-w-md">
      <div class="card p-6 md:p-8">
        <h1 class="font-display text-2xl font-bold text-white text-center mb-2">{{ $t('auth.login_title') }}</h1>
        <p class="text-text-secondary text-sm text-center mb-6">{{ $t('auth.login_subtitle') }}</p>

        <!-- Google First -->
        <a href="/api/auth/google" class="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-lg bg-white hover:bg-gray-100 transition-colors text-gray-800 font-medium text-sm">
          <svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          {{ $t('auth.login_button') }} Google
        </a>

        <!-- Divider -->
        <div class="flex items-center gap-4 my-6">
          <div class="flex-1 border-t border-dark-tertiary" />
          <span class="text-text-secondary text-xs uppercase">{{ $t('common.or') }}</span>
          <div class="flex-1 border-t border-dark-tertiary" />
        </div>

        <p v-if="googleError" class="text-red-400 text-sm text-center mb-4 bg-red-900/20 p-3 rounded-lg">Google: {{ googleError }}</p>
        <p v-if="auth.error" class="text-red-400 text-sm text-center mb-2 bg-red-900/20 p-3 rounded-lg">{{ authErrorText }}</p>
        <!-- U-P10: Google accounts have a random password — point the user to
             the right door instead of leaving them retrying (generic hint so
             we never reveal whether the email exists). -->
        <p v-if="auth.error" class="text-accent text-xs mb-4 bg-accent/5 border border-accent/20 p-3 rounded-lg flex items-start gap-2 text-start">
          <Icon name="ph:lightbulb" class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ $t('auth.google_hint') }}</span>
        </p>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label for="login-email" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('auth.email') }}</label>
            <input id="login-email" name="email" v-model="form.email" type="email" class="input-field" required autocomplete="email" />
          </div>
          <div>
            <label for="login-password" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('auth.password') }}</label>
            <input id="login-password" name="password" v-model="form.password" type="password" class="input-field" required autocomplete="current-password" />
          </div>

          <ClientOnly>
            <TurnstileWidget ref="turnstile" @verify="t => turnstileToken = t" />
          </ClientOnly>

          <button type="submit" :disabled="auth.loading || !turnstileToken" class="btn-primary w-full py-3 disabled:opacity-50">
            <span v-if="auth.loading">{{ $t('common.loading') }}</span>
            <span v-else>{{ $t('auth.login_button') }}</span>
          </button>
        </form>

        <p class="text-text-secondary text-sm text-center mt-6">
          {{ $t('auth.no_account') }}
          <NuxtLink :to="localePath('/inscription')" class="text-accent hover:underline font-medium">{{ $t('auth.register_button') }}</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

useHead({ title: `${t('auth.login_title')} — Vitesse Eco`, meta: [{ name: 'robots', content: 'noindex' }] })

// Server auth messages are English — map by status code to the visitor's
// language. 400/401 stay deliberately generic (no account enumeration).
const authErrorText = computed(() =>
  auth.errorCode === 400 || auth.errorCode === 401 ? t('auth.error_invalid') : t('common.error')
)

// Check for Google OAuth error in URL
const route = useRoute()
const googleError = computed(() => route.query.error as string || '')

const turnstileToken = ref('')
const turnstile = ref<{ retry: () => void } | null>(null)

const form = reactive({ email: '', password: '' })

async function handleLogin() {
  const ok = await auth.login(form.email, form.password, turnstileToken.value)
  if (ok) {
    navigateTo(localePath('/compte'))
    return
  }
  // Turnstile tokens are single-use — a rejected attempt (wrong password as
  // much as a stale token) needs a freshly issued one before retrying.
  turnstileToken.value = ''
  turnstile.value?.retry()
}
</script>
