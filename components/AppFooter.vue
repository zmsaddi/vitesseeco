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
            {{ $t('footer.description') }}
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
          <form @submit.prevent class="flex gap-2">
            <input
              type="email"
              :placeholder="$t('footer.newsletter_placeholder')"
              class="input-field flex-1 text-sm py-2.5"
            />
            <button type="submit" class="btn-primary py-2.5 px-4 text-sm">
              {{ $t('footer.newsletter_button') }}
            </button>
          </form>
          <div class="flex items-center gap-4 mt-6">
            <a href="#" class="text-text-secondary hover:text-accent transition-colors">
              <Icon name="ph:instagram-logo" class="w-5 h-5" />
            </a>
            <a href="#" class="text-text-secondary hover:text-accent transition-colors">
              <Icon name="ph:facebook-logo" class="w-5 h-5" />
            </a>
            <a href="#" class="text-text-secondary hover:text-accent transition-colors">
              <Icon name="ph:tiktok-logo" class="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      <!-- Copyright -->
      <div class="border-t border-dark-tertiary/50 mt-10 pt-6 text-center">
        <p class="text-text-secondary text-sm">
          &copy; {{ new Date().getFullYear() }} Vitesse Eco. {{ $t('footer.rights') }}
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const localePath = useLocalePath()

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
