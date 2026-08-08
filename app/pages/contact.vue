<script setup lang="ts">
/**
 * Contact.
 *
 * The form mirrors `contactSchema` exactly — same four fields, same lengths —
 * so the browser refuses what the server would refuse anyway, instead of
 * accepting 6 000 characters and returning a validation error the customer
 * cannot act on.
 *
 * The CAPTCHA token is single-use at Cloudflare. It is cleared and the widget
 * reset after every attempt, successful or not: a customer who mistypes their
 * email and corrects it would otherwise submit a burned token and be told the
 * security check failed, which reads as the site being broken.
 *
 * There is no embedded map. It would mean a third-party script the CSP blocks
 * and a consent banner we do not have, to show an address that is already
 * written on the page.
 */
const localePath = useLocalePath()
const { locale, t } = useI18n()

const MAX = { name: 100, email: 254, subject: 200, message: 5000 } as const

const form = reactive({ name: '', email: '', subject: '', message: '' })
const captchaToken = ref('')
const captcha = ref<{ reset: () => void } | null>(null)
const submitting = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  error.value = null
  fieldErrors.value = {}

  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: {
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
        locale: locale.value,
        captchaToken: captchaToken.value,
      },
    })
    form.name = ''
    form.email = ''
    form.subject = ''
    form.message = ''
    sent.value = true
  } catch (err: unknown) {
    const data = (err as { data?: { messageKey?: string; details?: { issues?: Array<{ path: string; message: string }> } } })?.data
    for (const issue of data?.details?.issues ?? []) {
      fieldErrors.value[issue.path] = issue.message.startsWith('errors.') ? t(issue.message) : issue.message
    }
    // A field-level message is more useful than the generic one, so the banner
    // only appears when nothing was attributable to a field.
    if (Object.keys(fieldErrors.value).length === 0) {
      error.value = data?.messageKey ? t(data.messageKey) : t('errors.internal')
    }
  } finally {
    // Burned at Cloudflare either way. What the customer typed is untouched, so
    // a failed attempt costs them one checkbox and not the whole message.
    captchaToken.value = ''
    captcha.value?.reset()
    submitting.value = false
  }
}

useSeoMeta({
  title: () => t('contact.title'),
  description: () => t('contact.description'),
  robots: 'index, follow',
})
</script>

<template>
  <div class="container-page py-12">
    <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('contact.title') }}</h1>
    <p class="mt-3 max-w-2xl text-lg text-content-muted">{{ $t('contact.intro') }}</p>

    <div class="mt-10 grid gap-8 lg:grid-cols-5">
      <section class="lg:col-span-3">
        <div v-if="sent" class="card p-6" role="status">
          <p class="font-display text-lg font-bold text-success">{{ $t('contact.sent_title') }}</p>
          <p class="mt-3 text-content">{{ $t('contact.sent_body') }}</p>
          <p class="mt-2 text-sm text-content-muted">{{ $t('contact.sent_urgent') }}</p>
          <button type="button" class="btn-secondary mt-6" @click="sent = false">
            {{ $t('contact.send_another') }}
          </button>
        </div>

        <form v-else class="card space-y-4 p-6" @submit.prevent="submit">
          <h2 class="font-display text-lg font-bold text-content-strong">{{ $t('contact.form_title') }}</h2>

          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('contact.name') }}</span>
            <input
              v-model="form.name"
              type="text"
              autocomplete="name"
              required
              :maxlength="MAX.name"
              class="field mt-1"
            />
            <span v-if="fieldErrors.name" class="mt-1 block text-sm text-danger">{{ fieldErrors.name }}</span>
          </label>

          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('auth.email') }}</span>
            <input
              v-model="form.email"
              type="email"
              autocomplete="email"
              required
              :maxlength="MAX.email"
              class="field mt-1"
            />
            <span v-if="fieldErrors.email" class="mt-1 block text-sm text-danger">{{ fieldErrors.email }}</span>
          </label>

          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('contact.subject') }}</span>
            <input
              v-model="form.subject"
              type="text"
              required
              :maxlength="MAX.subject"
              class="field mt-1"
            />
            <span v-if="fieldErrors.subject" class="mt-1 block text-sm text-danger">{{ fieldErrors.subject }}</span>
          </label>

          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('contact.message') }}</span>
            <textarea
              v-model="form.message"
              required
              rows="7"
              :maxlength="MAX.message"
              class="field mt-1 py-2.5"
            />
            <!-- Only shown near the ceiling: a running counter on an empty box
                 is noise, but silently truncating a long message is not. -->
            <span v-if="form.message.length > MAX.message - 500" class="mt-1 block text-xs text-content-muted">
              {{ $t('contact.characters_left', { count: MAX.message - form.message.length }) }}
            </span>
            <span v-if="fieldErrors.message" class="mt-1 block text-sm text-danger">{{ fieldErrors.message }}</span>
          </label>

          <CaptchaWidget ref="captcha" v-model="captchaToken" />

          <!-- The failure names the fallback channel. A customer who has just
               been refused by a form is the one most likely to leave. -->
          <div v-if="error" role="alert" class="rounded-xl border border-surface-border p-3">
            <p class="text-sm text-danger">{{ error }}</p>
            <p class="mt-1 text-sm text-content">{{ $t('contact.error_fallback') }}</p>
          </div>

          <button type="submit" class="btn-primary w-full" :disabled="submitting || !captchaToken">
            {{ submitting ? $t('common.loading') : $t('contact.send') }}
          </button>

          <p class="text-xs text-content-muted">
            {{ $t('contact.privacy_note') }}
            <NuxtLink :to="localePath('/politique-confidentialite')" class="text-accent hover:underline">
              {{ $t('contact.privacy_link') }}
            </NuxtLink>
          </p>
        </form>
      </section>

      <aside class="lg:col-span-2">
        <div class="card p-6">
          <h2 class="font-display text-lg font-bold text-content-strong">{{ $t('contact.channels') }}</h2>

          <!-- WhatsApp first and as the primary button: it is how most of our
               customers actually open a conversation, and burying it behind a
               form costs us the ones who will not fill in a form. -->
          <ContactLink kind="whatsapp" class="btn-primary mt-4 w-full" target="_blank">
            <Icon name="ph:whatsapp-logo" class="h-5 w-5" />
            {{ $t('contact.whatsapp') }}
          </ContactLink>
          <p class="mt-2 text-sm text-content-muted">{{ $t('contact.whatsapp_note') }}</p>

          <dl class="mt-6 space-y-4 text-sm">
            <div class="flex gap-3">
              <Icon name="ph:phone" class="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <dt class="text-content-muted">{{ $t('contact.phone') }}</dt>
                <dd>
                  <ContactLink kind="phone" class="font-medium text-content-strong hover:text-accent" />
                </dd>
              </div>
            </div>

            <div class="flex gap-3">
              <Icon name="ph:envelope-simple" class="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <dt class="text-content-muted">{{ $t('auth.email') }}</dt>
                <dd>
                  <ContactLink kind="email" class="font-medium text-content-strong hover:text-accent" />
                </dd>
              </div>
            </div>

            <div class="flex gap-3">
              <Icon name="ph:map-pin" class="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <dt class="text-content-muted">{{ $t('contact.address') }}</dt>
                <dd>
                  <address class="not-italic text-content-strong">
                    VITESSE ECO SAS<br />
                    32 Rue du Faubourg du Pont Neuf<br />
                    86000 Poitiers, France
                  </address>
                  <p class="mt-1 text-content-muted">{{ $t('contact.visit_note') }}</p>
                </dd>
              </div>
            </div>

            <div class="flex gap-3">
              <Icon name="ph:clock" class="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <dt class="text-content-muted">{{ $t('contact.hours') }}</dt>
                <dd class="text-content-strong">{{ $t('contact.hours_value') }}</dd>
                <dd class="mt-1 text-content-muted">{{ $t('contact.reply_time') }}</dd>
              </div>
            </div>
          </dl>

          <!-- Each identifier is its own element rather than one interpolated
               string, so no separator can be read as i18n plural syntax. -->
          <p class="mt-6 flex flex-wrap gap-x-2 gap-y-1 border-t border-surface-border pt-4 text-xs text-content-muted">
            <span>SIREN 100 732 247</span>
            <span aria-hidden="true">·</span>
            <span>TVA FR43 100 732 247</span>
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>
