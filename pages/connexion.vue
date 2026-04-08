<template>
  <div class="py-8 md:py-16">
    <div class="container-custom max-w-md">
      <div class="card p-6 md:p-8">
        <h1 class="font-display text-2xl font-bold text-white text-center mb-6">{{ $t('auth.login_title') }}</h1>

        <p v-if="auth.error" class="text-red-400 text-sm text-center mb-4 bg-red-900/20 p-3 rounded-lg">{{ auth.error }}</p>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label for="login-email" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('auth.email') }}</label>
            <input id="login-email" name="email" v-model="form.email" type="email" class="input-field" required autocomplete="email" />
          </div>
          <div>
            <label for="login-password" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('auth.password') }}</label>
            <input id="login-password" name="password" v-model="form.password" type="password" class="input-field" required autocomplete="current-password" />
          </div>

          <button type="submit" :disabled="auth.loading" class="btn-primary w-full py-3 disabled:opacity-50">
            <span v-if="auth.loading">{{ $t('common.loading') }}</span>
            <span v-else>{{ $t('auth.login_button') }}</span>
          </button>
        </form>

        <p class="text-text-secondary text-sm text-center mt-6">
          {{ $t('auth.no_account') }}
          <NuxtLink :to="localePath('/inscription')" class="text-accent hover:underline">{{ $t('auth.register_button') }}</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

useHead({ title: `${t('auth.login_title')} — Vitesse Eco` })

const form = reactive({ email: '', password: '' })

async function handleLogin() {
  const ok = await auth.login(form.email, form.password)
  if (ok) navigateTo(localePath('/compte'))
}
</script>
