<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-lg">
      <div class="card p-6 md:p-8">
        <h1 class="font-display text-2xl font-bold text-white text-center mb-2">{{ $t('auth.register_title') }}</h1>
        <p class="text-text-secondary text-sm text-center mb-6">{{ $t('about.subtitle') }}</p>

        <!-- Google First -->
        <a href="/api/auth/google" class="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-lg bg-white hover:bg-gray-100 transition-colors text-gray-800 font-medium text-sm">
          <svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          {{ $t('auth.register_button') }} Google
        </a>

        <div class="flex items-center gap-4 my-6">
          <div class="flex-1 border-t border-dark-tertiary" />
          <span class="text-text-secondary text-xs uppercase">{{ $t('common.or') }}</span>
          <div class="flex-1 border-t border-dark-tertiary" />
        </div>

        <p v-if="auth.error" class="text-red-400 text-sm text-center mb-4 bg-red-900/20 p-3 rounded-lg">{{ auth.error }}</p>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <!-- Personal Info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="reg-first" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.first_name') }}</label>
              <input id="reg-first" name="firstName" v-model="form.firstName" type="text" class="input-field" required autocomplete="given-name" />
            </div>
            <div>
              <label for="reg-last" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.last_name') }}</label>
              <input id="reg-last" name="lastName" v-model="form.lastName" type="text" class="input-field" required autocomplete="family-name" />
            </div>
          </div>

          <div>
            <label for="reg-email" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('auth.email') }}</label>
            <input id="reg-email" name="email" v-model="form.email" type="email" class="input-field" required autocomplete="email" />
          </div>

          <div>
            <label for="reg-phone" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.phone') }}</label>
            <PhoneInput v-model="form.phone" input-id="reg-phone" :default-country="form.country" />
          </div>

          <!-- Address (collapsible) -->
          <div class="border-t border-dark-tertiary pt-4">
            <button type="button" @click="showAddress = !showAddress" class="flex items-center gap-2 text-sm text-accent hover:underline mb-3">
              <Icon :name="showAddress ? 'ph:caret-down' : 'ph:caret-right'" class="w-4 h-4" />
              {{ $t('checkout.shipping_address') }}
              <span class="text-text-secondary text-xs">({{ $t('common.or') === 'ou' ? 'optionnel' : 'optional' }})</span>
            </button>

            <div v-if="showAddress" class="space-y-4">
              <div>
                <label for="reg-address" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.address') }}</label>
                <AddressAutocomplete
                  v-model="form.address"
                  input-id="reg-address"
                  :placeholder="$t('checkout.address')"
                  @select="onAddressSelect"
                />
              </div>
              <div>
                <label for="reg-line2" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.address') }} 2</label>
                <input id="reg-line2" name="addressLine2" v-model="form.addressLine2" type="text" class="input-field" placeholder="Apt, étage, bâtiment..." />
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label for="reg-postal" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.postal_code') }}</label>
                  <input id="reg-postal" name="postalCode" v-model="form.postalCode" type="text" class="input-field" autocomplete="postal-code" />
                </div>
                <div>
                  <label for="reg-city" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.city') }}</label>
                  <input id="reg-city" name="city" v-model="form.city" type="text" class="input-field" autocomplete="address-level2" />
                </div>
                <div>
                  <label for="reg-country" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.country') }}</label>
                  <select id="reg-country" name="country" v-model="form.country" class="input-field">
                    <option value="FR">🇫🇷 France</option>
                    <option value="BE">🇧🇪 Belgique</option>
                    <option value="LU">🇱🇺 Luxembourg</option>
                    <option value="DE">🇩🇪 Deutschland</option>
                    <option value="NL">🇳🇱 Nederland</option>
                    <option value="ES">🇪🇸 España</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Password -->
          <div class="border-t border-dark-tertiary pt-4">
            <div class="space-y-4">
              <div>
                <label for="reg-pass" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('auth.password') }}</label>
                <input id="reg-pass" name="password" v-model="form.password" type="password" class="input-field" required minlength="8" autocomplete="new-password" />
                <p class="text-text-secondary text-xs mt-1">{{ passwordHint }}</p>
              </div>
              <div>
                <label for="reg-confirm" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('auth.confirm_password') }}</label>
                <input id="reg-confirm" name="confirmPassword" v-model="form.confirmPassword" type="password" class="input-field" required minlength="8" autocomplete="new-password" />
              </div>
              <p v-if="passwordMismatch" class="text-red-400 text-sm flex items-center gap-1">
                <Icon name="ph:x-circle" class="w-4 h-4" />
                {{ $t('auth.confirm_password') }} ≠ {{ $t('auth.password') }}
              </p>
            </div>
          </div>

          <ClientOnly>
            <TurnstileWidget @verify="t => turnstileToken = t" />
          </ClientOnly>

          <button type="submit" :disabled="auth.loading || passwordMismatch || !turnstileToken" class="btn-primary w-full py-3.5 text-lg disabled:opacity-50">
            <span v-if="auth.loading" class="flex items-center justify-center gap-2">
              <Icon name="ph:spinner" class="w-5 h-5 animate-spin" />
              {{ $t('common.loading') }}
            </span>
            <span v-else>{{ $t('auth.register_button') }}</span>
          </button>
        </form>

        <p class="text-text-secondary text-sm text-center mt-6">
          {{ $t('auth.has_account') }}
          <NuxtLink :to="localePath('/connexion')" class="text-accent hover:underline font-medium">{{ $t('auth.login_button') }}</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()
const turnstileToken = ref('')
const showAddress = ref(false)

useHead({ title: `${t('auth.register_title')} — Vitesse Eco` })

const form = reactive({
  firstName: '', lastName: '', email: '', phone: '',
  address: '', addressLine2: '', postalCode: '', city: '', country: 'FR',
  password: '', confirmPassword: '',
})

const passwordMismatch = computed(() => form.password && form.confirmPassword && form.password !== form.confirmPassword)
const passwordHint = computed(() => {
  const hints: Record<string, string> = {
    fr: 'Minimum 8 caractères',
    en: 'Minimum 8 characters',
    es: 'Mínimo 8 caracteres',
    nl: 'Minimaal 8 tekens',
    de: 'Mindestens 8 Zeichen',
    ar: '8 أحرف على الأقل',
  }
  return hints[locale.value] || hints.fr
})

function onAddressSelect(details: { address: string; city: string; postalCode: string; country: string }) {
  form.address = details.address
  form.city = details.city
  form.postalCode = details.postalCode
  form.country = details.country
}

async function handleRegister() {
  if (passwordMismatch.value) return

  const ok = await auth.register({
    email: form.email,
    password: form.password,
    firstName: form.firstName,
    lastName: form.lastName,
    phone: form.phone || undefined,
  })

  if (ok && form.address && form.city && form.postalCode) {
    // Save address automatically
    try {
      await $fetch('/api/addresses', {
        method: 'POST',
        body: {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          address: form.address,
          addressLine2: form.addressLine2 || undefined,
          city: form.city,
          postalCode: form.postalCode,
          country: form.country,
          isDefault: true,
        },
      })
    } catch {}
  }

  if (ok) navigateTo(localePath('/compte'))
}
</script>
