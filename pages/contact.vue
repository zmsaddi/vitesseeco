<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="section-title mb-4">{{ $t('contact.title') }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ $t('contact.subtitle') }}</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Contact Info Cards -->
        <div class="space-y-4">
          <div class="card p-6 flex items-start gap-4">
            <div class="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
              <Icon name="ph:map-pin" class="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 class="font-display font-semibold text-white mb-1">Adresse</h3>
              <p class="text-text-secondary text-sm leading-relaxed">
                32 Rue du Faubourg du Pont Neuf<br />
                86000 Poitiers, France
              </p>
            </div>
          </div>

          <div class="card p-6 flex items-start gap-4">
            <div class="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
              <Icon name="ph:envelope" class="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 class="font-display font-semibold text-white mb-1">Email</h3>
              <a href="mailto:contact@vitesse-eco.fr" class="text-text-secondary hover:text-accent transition-colors text-sm">
                contact@vitesse-eco.fr
              </a>
            </div>
          </div>

          <div class="card p-6 flex items-start gap-4">
            <div class="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
              <Icon name="ph:globe" class="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 class="font-display font-semibold text-white mb-1">Web</h3>
              <span class="text-text-secondary text-sm">www.vitesse-eco.com</span>
            </div>
          </div>

          <div class="card p-6 flex items-start gap-4">
            <div class="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
              <Icon name="ph:clock" class="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 class="font-display font-semibold text-white mb-1">Horaires</h3>
              <p class="text-text-secondary text-sm">Lun — Sam : 9h — 18h</p>
            </div>
          </div>

          <div class="card p-6 flex items-start gap-4">
            <div class="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
              <Icon name="ph:identification-card" class="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 class="font-display font-semibold text-white mb-1">Informations légales</h3>
              <p class="text-text-secondary text-xs leading-relaxed">
                VITESSE ECO — SAS<br />
                SIREN : 100 732 247<br />
                SIRET : 100 732 247 00018<br />
                APE : 46.90Z
              </p>
            </div>
          </div>
        </div>

        <!-- Contact Form + Map -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Google Map -->
          <div class="card overflow-hidden">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2770.7!2d0.3434!3d46.5802!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47fdbe31a5075ccb%3A0x2a43cf344f2d1b0!2s32%20Rue%20du%20Faubourg%20du%20Pont%20Neuf%2C%2086000%20Poitiers!5e0!3m2!1sfr!2sfr!4v1700000000000!5m2!1sfr!2sfr"
              width="100%"
              height="280"
              style="border: 0"
              allowfullscreen
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              class="w-full"
            />
          </div>

          <!-- Contact Form -->
          <div class="card p-6 md:p-8">
            <h2 class="font-display text-xl font-semibold text-white mb-6">Envoyez-nous un message</h2>
            <form @submit.prevent="handleSubmit" class="space-y-5">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label class="text-sm font-medium text-text-secondary block mb-2">{{ $t('contact.name') }}</label>
                  <input v-model="form.name" type="text" :placeholder="$t('contact.name')" class="input-field" required />
                </div>
                <div>
                  <label class="text-sm font-medium text-text-secondary block mb-2">{{ $t('contact.email') }}</label>
                  <input v-model="form.email" type="email" :placeholder="$t('contact.email')" class="input-field" required />
                </div>
              </div>
              <div>
                <label class="text-sm font-medium text-text-secondary block mb-2">{{ $t('contact.subject') }}</label>
                <input v-model="form.subject" type="text" :placeholder="$t('contact.subject')" class="input-field" required />
              </div>
              <div>
                <label class="text-sm font-medium text-text-secondary block mb-2">{{ $t('contact.message') }}</label>
                <textarea
                  v-model="form.message"
                  rows="5"
                  :placeholder="$t('contact.message')"
                  class="input-field resize-none"
                  required
                />
              </div>
              <button type="submit" class="btn-primary w-full md:w-auto">
                <span class="flex items-center gap-2">
                  <Icon name="ph:paper-plane-tilt" class="w-5 h-5" />
                  {{ $t('contact.send') }}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

useHead({ title: `${t('contact.title')} — Vitesse Eco` })

const form = reactive({
  name: '',
  email: '',
  subject: '',
  message: '',
})

function handleSubmit() {
  // Will be implemented in Phase 3
  alert(t('contact.success'))
  form.name = ''
  form.email = ''
  form.subject = ''
  form.message = ''
}
</script>
