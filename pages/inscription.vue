<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-lg">
      <div class="card p-6 md:p-8">
        <h1 class="font-display text-2xl font-bold text-white text-center mb-2">{{ $t('auth.register_title') }}</h1>
        <p class="text-text-secondary text-sm text-center mb-6">{{ $t('auth.register_subtitle') }}</p>

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
          <!-- Personal -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="reg-first" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.first_name') }}</label>
              <input id="reg-first" name="firstName" v-model="form.firstName" type="text" class="input-field" required autocomplete="given-name" />
            </div>
            <div>
              <label for="reg-last" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.last_name') }}</label>
              <input id="reg-last" name="lastName" v-model="form.lastName" type="text" class="input-field" required autocomplete="family-name" />
            </div>
          </div>

          <div>
            <label for="reg-email" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('auth.email') }}</label>
            <input id="reg-email" name="email" v-model="form.email" type="email" class="input-field" required autocomplete="email" />
          </div>

          <div>
            <label for="reg-phone" class="text-sm font-medium text-text-secondary block mb-1.5">{{ $t('checkout.phone') }}</label>
            <PhoneInput v-model="form.phone" input-id="reg-phone" :default-country="form.country" />
          </div>

          <!-- Address -->
          <div class="border-t border-dark-tertiary pt-4">
            <p class="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
              <Icon name="ph:map-pin" class="w-4 h-4 text-accent" />
              {{ $t('checkout.shipping_address') }}
            </p>

            <div class="space-y-3">
              <!-- Country FIRST -->
              <div>
                <label for="reg-country" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.country') }}</label>
                <select id="reg-country" name="country" v-model="form.country" class="input-field">
                  <option value="FR">🇫🇷 France</option>
                  <option value="BE">🇧🇪 Belgique</option>
                  <option value="LU">🇱🇺 Luxembourg</option>
                  <option value="DE">🇩🇪 Deutschland</option>
                  <option value="NL">🇳🇱 Nederland</option>
                  <option value="ES">🇪🇸 España</option>
                </select>
              </div>

              <!-- Address with autocomplete for selected country -->
              <div>
                <label for="reg-address" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.address') }}</label>
                <div class="relative">
                  <input
                    id="reg-address"
                    ref="addressInput"
                    name="address"
                    type="text"
                    v-model="form.address"
                    @input="onAddressInput"
                    @focus="addressFocused = true"
                    class="input-field"
                    :placeholder="addressPlaceholder"
                    required
                    autocomplete="off"
                  />
                  <div v-if="addressLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                    <Icon name="ph:spinner" class="w-4 h-4 text-accent animate-spin" />
                  </div>
                  <!-- Suggestions -->
                  <div
                    v-if="addressFocused && addressSuggestions.length > 0"
                    class="absolute z-50 left-0 right-0 mt-1 bg-dark-secondary border border-dark-tertiary rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                  >
                    <button
                      v-for="s in addressSuggestions"
                      :key="s.place_id"
                      type="button"
                      @mousedown.prevent="pickAddress(s)"
                      class="w-full text-left px-3 py-2.5 text-sm text-text-secondary hover:bg-dark-tertiary hover:text-white transition-colors flex items-start gap-2"
                    >
                      <Icon name="ph:map-pin" class="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
                      <span>{{ s.description }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="reg-postal" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.postal_code') }}</label>
                  <input id="reg-postal" name="postalCode" v-model="form.postalCode" type="text" class="input-field" required autocomplete="postal-code" />
                </div>
                <div>
                  <label for="reg-city" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.city') }}</label>
                  <input id="reg-city" name="city" v-model="form.city" type="text" class="input-field" required autocomplete="address-level2" />
                </div>
              </div>
            </div>
          </div>

          <!-- Password -->
          <div class="border-t border-dark-tertiary pt-4 space-y-3">
            <div>
              <label for="reg-pass" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('auth.password') }}</label>
              <input id="reg-pass" name="password" v-model="form.password" type="password" class="input-field" required minlength="8" autocomplete="new-password" />
              <div class="flex gap-1 mt-1.5">
                <div v-for="i in 4" :key="i" class="h-1 flex-1 rounded-full transition-colors" :class="passwordStrength >= i ? strengthColors[passwordStrength - 1] : 'bg-dark-tertiary'" />
              </div>
            </div>
            <div>
              <label for="reg-confirm" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('auth.confirm_password') }}</label>
              <input id="reg-confirm" name="confirmPassword" v-model="form.confirmPassword" type="password" class="input-field" required minlength="8" autocomplete="new-password" />
              <p v-if="passwordMismatch" class="text-red-400 text-xs mt-1">{{ $t('auth.password_mismatch') }}</p>
              <p v-else-if="form.confirmPassword && !passwordMismatch" class="text-accent text-xs mt-1">✓</p>
            </div>
          </div>

          <ClientOnly>
            <TurnstileWidget @verify="t => turnstileToken = t" />
          </ClientOnly>

          <button type="submit" :disabled="auth.loading || passwordMismatch || !turnstileToken || !form.password" class="btn-primary w-full py-3.5 disabled:opacity-50">
            <span v-if="auth.loading" class="flex items-center justify-center gap-2">
              <Icon name="ph:spinner" class="w-5 h-5 animate-spin" />
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

useHead({ title: `${t('auth.register_title')} — Vitesse Eco` })

const form = reactive({
  firstName: '', lastName: '', email: '', phone: '',
  address: '', postalCode: '', city: '', country: 'FR',
  password: '', confirmPassword: '',
})

// Password
const passwordMismatch = computed(() => form.password && form.confirmPassword && form.password !== form.confirmPassword)
const passwordStrength = computed(() => {
  const p = form.password
  if (!p) return 0
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
})
const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-accent']

// Address autocomplete — inline, no separate component
const addressInput = ref<HTMLInputElement>()
const addressSuggestions = ref<any[]>([])
const addressFocused = ref(false)
const addressLoading = ref(false)
let addressTimer: ReturnType<typeof setTimeout>

const addressPlaceholder = computed(() => {
  const p: Record<string, string> = {
    fr: 'Tapez votre adresse...', en: 'Type your address...',
    es: 'Escribe tu dirección...', nl: 'Typ je adres...',
    de: 'Geben Sie Ihre Adresse ein...', ar: 'اكتب عنوانك...',
  }
  return p[locale.value] || p.fr
})

function onAddressInput() {
  clearTimeout(addressTimer)
  if (form.address.length < 3) {
    addressSuggestions.value = []
    addressLoading.value = false
    return
  }
  addressLoading.value = true
  addressTimer = setTimeout(async () => {
    try {
      const data = await $fetch<any>('/api/places/autocomplete', {
        query: { input: form.address, country: form.country.toLowerCase() },
      })
      addressSuggestions.value = data.predictions || []
    } catch {
      addressSuggestions.value = []
    } finally {
      addressLoading.value = false
    }
  }, 400)
}

async function pickAddress(s: any) {
  addressFocused.value = false
  addressSuggestions.value = []
  form.address = s.structured_formatting?.main_text || s.description

  try {
    const data = await $fetch<any>('/api/places/details', { query: { place_id: s.place_id } })
    if (data.address) {
      form.address = data.address
      form.city = data.city || ''
      form.postalCode = data.postalCode || ''
      form.country = data.country || 'FR'
    }
  } catch {}
}

// Click outside to close suggestions
function onDocClick(e: MouseEvent) {
  if (addressInput.value && !addressInput.value.parentElement?.contains(e.target as Node)) {
    addressFocused.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

// Submit
async function handleRegister() {
  if (passwordMismatch.value || !form.password) return

  const ok = await auth.register({
    email: form.email,
    password: form.password,
    firstName: form.firstName,
    lastName: form.lastName,
    phone: form.phone || undefined,
  })

  if (ok && form.address && form.city && form.postalCode) {
    try {
      await $fetch('/api/addresses', {
        method: 'POST',
        body: {
          firstName: form.firstName, lastName: form.lastName,
          phone: form.phone || undefined,
          address: form.address, city: form.city,
          postalCode: form.postalCode, country: form.country,
          isDefault: true,
        },
      })
    } catch {}
  }

  if (ok) navigateTo(localePath('/compte'))
}
</script>
