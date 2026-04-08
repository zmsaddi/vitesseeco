<template>
  <footer class="bg-dark-secondary border-t border-dark-tertiary/50">
    <div class="container-custom py-12 md:py-16">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
        <!-- Brand -->
        <div class="lg:col-span-1">
          <NuxtLink :to="localePath('/')" class="flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="Vitesse Eco" class="h-10 w-auto" />
            <span class="font-display font-bold text-lg">
              <span class="text-white">Vitesse</span>
              <span class="text-accent"> Eco</span>
            </span>
          </NuxtLink>
          <p class="text-text-secondary text-sm leading-relaxed">
            {{ footerDescription || $t('footer.description') }}
          </p>
        </div>

        <!-- Quick Links -->
        <div>
          <h3 class="font-display font-semibold text-white mb-4">{{ $t('footer.quick_links') }}</h3>
          <ul class="space-y-2">
            <li v-for="link in quickLinks" :key="link.path">
              <NuxtLink
                :to="localePath(link.path)"
                class="text-text-secondary hover:text-accent transition-colors text-sm"
              >
                {{ $t(link.label) }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div>
          <h3 class="font-display font-semibold text-white mb-4">{{ $t('footer.legal') }}</h3>
          <ul class="space-y-2">
            <li v-for="link in legalLinks" :key="link.path">
              <NuxtLink
                :to="localePath(link.path)"
                class="text-text-secondary hover:text-accent transition-colors text-sm"
              >
                {{ $t(link.label) }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Newsletter -->
        <div>
          <h3 class="font-display font-semibold text-white mb-4">{{ $t('footer.newsletter') }}</h3>
          <form v-if="!newsletterSubmitted" @submit.prevent="submitNewsletter" class="flex gap-2">
            <label for="newsletter-email" class="sr-only">{{ $t('footer.newsletter') }}</label>
            <input
              id="newsletter-email"
              name="newsletter-email"
              type="email"
              v-model="newsletterEmail"
              :placeholder="$t('footer.newsletter_placeholder')"
              class="input-field flex-1 text-sm py-2.5"
              autocomplete="email"
              required
            />
            <button type="submit" class="btn-primary py-2.5 px-4 text-sm">
              {{ $t('footer.newsletter_button') }}
            </button>
          </form>
          <p v-else class="text-accent text-sm flex items-center gap-2">
            <Icon name="ph:check-circle" class="w-5 h-5" />
            {{ $t('footer.newsletter_success') }}
          </p>
          <div class="flex items-center gap-4 mt-6">
            <a :href="instagramUrl" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="text-text-secondary hover:text-accent transition-colors">
              <Icon name="ph:instagram-logo" class="w-5 h-5" />
            </a>
            <a :href="facebookUrl" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="text-text-secondary hover:text-accent transition-colors">
              <Icon name="ph:facebook-logo" class="w-5 h-5" />
            </a>
            <a :href="tiktokUrl" target="_blank" rel="noopener noreferrer" aria-label="TikTok" class="text-text-secondary hover:text-accent transition-colors">
              <Icon name="ph:tiktok-logo" class="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      <!-- Company Info + Copyright -->
      <div class="border-t border-dark-tertiary/50 mt-10 pt-6">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <p class="text-text-secondary text-xs leading-relaxed text-center md:text-left">
            {{ $t('footer.company_line') }}<br class="hidden md:block" />
            {{ $t('footer.address_line') }}
          </p>
          <p class="text-text-secondary text-sm shrink-0">
            &copy; {{ new Date().getFullYear() }} Vitesse Eco. {{ $t('footer.rights') }}
          </p>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const l = useLocalizedField()

// Fetch siteSettings for social links and footer text
const { data: siteSettings } = useSanityFetch('site-settings', groq`*[_type == "siteSettings"][0]{ socialLinks, footerText, contactInfo }`)

const footerDescription = computed(() => {
  if (siteSettings.value?.footerText) return l(siteSettings.value.footerText)
  return null
})
const instagramUrl = computed(() => siteSettings.value?.socialLinks?.instagram || '#')
const facebookUrl = computed(() => siteSettings.value?.socialLinks?.facebook || '#')
const tiktokUrl = computed(() => siteSettings.value?.socialLinks?.tiktok || '#')

const newsletterEmail = ref('')
const newsletterSubmitted = ref(false)

function submitNewsletter() {
  if (!newsletterEmail.value) return
  newsletterSubmitted.value = true
  newsletterEmail.value = ''
}

const quickLinks = [
  { path: '/', label: 'nav.home' },
  { path: '/produits', label: 'nav.products' },
  { path: '/a-propos', label: 'nav.about' },
  { path: '/contact', label: 'nav.contact' },
]

const legalLinks = [
  { path: '/mentions-legales', label: 'footer.mentions_legales' },
  { path: '/politique-confidentialite', label: 'footer.privacy' },
  { path: '/cgv', label: 'footer.cgv' },
]
</script>
