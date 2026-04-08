<template>
  <div class="py-8 md:py-16">
    <div class="container-custom max-w-md">
      <div class="card p-6 md:p-8">
        <h1 class="font-display text-2xl font-bold text-white text-center mb-6">{{ $t('auth.register_title') }}</h1>

        <p v-if="auth.error" class="text-red-400 text-sm text-center mb-4 bg-red-900/20 p-3 rounded-lg">{{ auth.error }}</p>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="reg-first" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.first_name') }}</label>
              <input id="reg-first" name="firstName" v-model="form.firstName" type="text" class="input-field" required autocomplete="given-name" />
            </div>
            <div>
              <label for="reg-last" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.last_name') }}</label>
              <input id="reg-last" name="lastName" v-model="form.lastName" type="text" class="input-field" required autocomplete="family-name" />
            </div>
          </div>
          <div>
            <label for="reg-email" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('auth.email') }}</label>
            <input id="reg-email" name="email" v-model="form.email" type="email" class="input-field" required autocomplete="email" />
          </div>
          <div>
            <label for="reg-phone" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.phone') }}</label>
            <input id="reg-phone" name="phone" v-model="form.phone" type="tel" class="input-field" autocomplete="tel" />
          </div>
          <div>
            <label for="reg-pass" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('auth.password') }}</label>
            <input id="reg-pass" name="password" v-model="form.password" type="password" class="input-field" required minlength="8" autocomplete="new-password" />
          </div>
          <div>
            <label for="reg-confirm" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('auth.confirm_password') }}</label>
            <input id="reg-confirm" name="confirmPassword" v-model="form.confirmPassword" type="password" class="input-field" required minlength="8" autocomplete="new-password" />
          </div>

          <p v-if="passwordMismatch" class="text-red-400 text-sm">{{ $t('auth.confirm_password') }} ≠ {{ $t('auth.password') }}</p>

          <button type="submit" :disabled="auth.loading || passwordMismatch" class="btn-primary w-full py-3 disabled:opacity-50">
            <span v-if="auth.loading">{{ $t('common.loading') }}</span>
            <span v-else>{{ $t('auth.register_button') }}</span>
          </button>
        </form>

        <p class="text-text-secondary text-sm text-center mt-6">
          {{ $t('auth.has_account') }}
          <NuxtLink :to="localePath('/connexion')" class="text-accent hover:underline">{{ $t('auth.login_button') }}</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

useHead({ title: `${t('auth.register_title')} — Vitesse Eco` })

const form = reactive({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' })
const passwordMismatch = computed(() => form.password && form.confirmPassword && form.password !== form.confirmPassword)

async function handleRegister() {
  if (passwordMismatch.value) return
  const ok = await auth.register({
    email: form.email,
    password: form.password,
    firstName: form.firstName,
    lastName: form.lastName,
    phone: form.phone || undefined,
  })
  if (ok) navigateTo(localePath('/compte'))
}
</script>
