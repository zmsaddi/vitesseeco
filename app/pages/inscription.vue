<script setup lang="ts">
/**
 * Create an account.
 *
 * The password minimum is length rather than a composition rule: forcing a
 * symbol and a digit produces "Password1!" far more often than it produces
 * anything hard to guess.
 */
const localePath = useLocalePath()
const { locale, t } = useI18n()

const form = reactive({ email: '', password: '', firstName: '', lastName: '', phone: '' })
const captchaToken = ref('')
const captcha = ref<{ reset: () => void } | null>(null)
const submitting = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

const MIN_PASSWORD = 10
const passwordTooShort = computed(
  () => form.password.length > 0 && form.password.length < MIN_PASSWORD
)

async function submit(): Promise<void> {
  if (submitting.value || passwordTooShort.value) return
  submitting.value = true
  error.value = null
  fieldErrors.value = {}

  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        ...(form.phone ? { phone: form.phone } : {}),
        locale: locale.value,
        captchaToken: captchaToken.value,
      },
    })
    await navigateTo(localePath('/compte'))
  } catch (err: unknown) {
    const data = (err as { data?: { messageKey?: string; details?: { issues?: Array<{ path: string; message: string }> } } })?.data
    for (const issue of data?.details?.issues ?? []) {
      fieldErrors.value[issue.path] = issue.message.startsWith('errors.') ? t(issue.message) : issue.message
    }
    if (Object.keys(fieldErrors.value).length === 0) {
      error.value = data?.messageKey ? t(data.messageKey) : t('errors.internal')
    }
    captchaToken.value = ''
    captcha.value?.reset()
  } finally {
    submitting.value = false
  }
}

useSeoMeta({ title: () => t('auth.create_account'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-16">
    <div class="mx-auto max-w-sm">
      <h1 class="font-display text-2xl font-extrabold text-content-strong">{{ $t('auth.create_account') }}</h1>

      <!-- Hands the language over the Google round trip; see connexion.vue. -->
      <a :href="`/api/auth/google?next=${encodeURIComponent(localePath('/compte'))}`" class="btn-secondary mt-6 w-full">
        <Icon name="ph:google-logo" class="h-5 w-5" />
        {{ $t('auth.continue_with_google') }}
      </a>

      <div class="my-6 flex items-center gap-3">
        <span class="h-px flex-1 bg-surface-border" />
        <span class="text-xs uppercase tracking-wide text-content-muted">{{ $t('auth.or') }}</span>
        <span class="h-px flex-1 bg-surface-border" />
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('auth.first_name') }}</span>
            <input v-model="form.firstName" type="text" autocomplete="given-name" required class="field mt-1" />
          </label>
          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('auth.last_name') }}</span>
            <input v-model="form.lastName" type="text" autocomplete="family-name" required class="field mt-1" />
          </label>
        </div>

        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('auth.email') }}</span>
          <input v-model="form.email" type="email" autocomplete="email" required class="field mt-1" />
          <span v-if="fieldErrors.email" class="mt-1 block text-sm text-danger">{{ fieldErrors.email }}</span>
        </label>

        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('auth.password') }}</span>
          <input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            :minlength="MIN_PASSWORD"
            required
            class="field mt-1"
          />
          <span class="mt-1 block text-xs" :class="passwordTooShort ? 'text-danger' : 'text-content-muted'">
            {{ $t('auth.password_hint', { min: MIN_PASSWORD }) }}
          </span>
        </label>

        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('auth.phone_optional') }}</span>
          <input v-model="form.phone" type="tel" autocomplete="tel" class="field mt-1" />
        </label>

        <CaptchaWidget ref="captcha" v-model="captchaToken" />

        <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>

        <button
          type="submit"
          class="btn-primary w-full"
          :disabled="submitting || !captchaToken || passwordTooShort"
        >
          {{ submitting ? $t('common.loading') : $t('auth.create_account') }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-content-muted">
        {{ $t('auth.have_account') }}
        <NuxtLink :to="localePath('/connexion')" class="font-medium text-accent hover:underline">
          {{ $t('auth.sign_in') }}
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
