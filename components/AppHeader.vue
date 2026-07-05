<template>
  <header class="sticky top-0 z-header bg-primary/85 backdrop-blur-xl border-b border-dark-tertiary/30 shadow-soft relative">
    <div class="absolute inset-x-0 -bottom-px divider-accent" />
    <div class="container-custom">
      <!-- Row 1: logo · search (desktop) · icons -->
      <div class="flex items-center gap-3 md:gap-6 h-16 md:h-[4.5rem]">
        <NuxtLink :to="localePath('/')" class="flex items-center gap-3 shrink-0">
          <img src="/logo.webp" alt="Vitesse Eco" width="48" height="48" class="h-10 md:h-11 w-auto" />
          <span class="font-display font-bold text-lg md:text-xl hidden sm:block">
            <span class="text-white">Vitesse</span>
            <span class="text-accent"> Eco</span>
          </span>
        </NuxtLink>

        <!-- The Amazon rule: search front and center, always visible on desktop -->
        <div class="hidden md:block flex-1 max-w-xl mx-auto">
          <SearchBar />
        </div>

        <div class="flex items-center gap-1 md:gap-3 ms-auto md:ms-0 shrink-0">
          <LanguageSwitcher />

          <ClientOnly>
            <NuxtLink
              :to="localePath(auth.isLoggedIn ? '/compte' : '/connexion')"
              class="text-text-secondary hover:text-white transition-colors p-2 min-w-touch min-h-touch flex items-center justify-center"
              :aria-label="auth.isLoggedIn ? $t('account.title') : $t('nav.login')"
            >
              <Icon :name="auth.isLoggedIn ? 'ph:user-circle-fill' : 'ph:user'" class="w-5 h-5" :class="auth.isLoggedIn ? 'text-accent' : ''" />
            </NuxtLink>
          </ClientOnly>

          <button
            @click="openCart"
            class="relative text-text-secondary hover:text-white transition-colors p-2 min-w-touch min-h-touch flex items-center justify-center"
            :aria-label="$t('cart.title')"
          >
            <Icon name="ph:shopping-cart" class="w-5 h-5" />
            <ClientOnly>
              <span
                v-if="cartCount > 0"
                class="absolute top-0.5 end-0.5 bg-accent text-primary text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
              >
                {{ cartCount }}
              </span>
            </ClientOnly>
          </button>

          <!-- Mobile menu -->
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="md:hidden text-text-secondary hover:text-white transition-colors p-2 min-w-touch min-h-touch flex items-center justify-center"
            :aria-label="mobileMenuOpen ? $t('nav.close_menu') : $t('nav.open_menu')"
            :aria-expanded="mobileMenuOpen"
          >
            <Icon :name="mobileMenuOpen ? 'ph:x' : 'ph:list'" class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Row 2 (mobile): search always visible — never hidden behind a tap -->
      <div class="md:hidden pb-3">
        <SearchBar @navigate="mobileMenuOpen = false" />
      </div>

      <!-- Row 2 (desktop): flat category nav — scannable, no mega-dropdown -->
      <nav class="hidden md:flex items-center gap-6 pb-2.5 text-sm" :aria-label="$t('nav.products')">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="localePath(item.path)"
          class="text-text-secondary hover:text-accent transition-colors font-medium pb-1 border-b-2 border-transparent"
          :class="{ '!text-accent !border-accent': isActiveNav(item) }"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>

    <!-- Mobile Menu -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <nav v-if="mobileMenuOpen" :aria-label="$t('nav.open_menu')" class="md:hidden border-t border-dark-tertiary/50 bg-primary/95 backdrop-blur-xl">
        <div class="container-custom py-3">
          <NuxtLink
            v-for="item in navItems"
            :key="item.path"
            :to="localePath(item.path)"
            class="flex items-center gap-3 py-3 px-2 text-text-secondary hover:text-accent transition-colors font-medium min-h-touch"
            @click="mobileMenuOpen = false"
          >
            <span v-if="item.icon" aria-hidden="true">{{ item.icon }}</span>
            {{ item.label }}
          </NuxtLink>
          <div class="border-t border-dark-tertiary/50 mt-2 pt-2">
            <NuxtLink :to="localePath('/a-propos')" class="block py-3 px-2 text-text-secondary hover:text-accent transition-colors text-sm" @click="mobileMenuOpen = false">
              {{ $t('nav.about') }}
            </NuxtLink>
            <NuxtLink :to="localePath('/contact')" class="block py-3 px-2 text-text-secondary hover:text-accent transition-colors text-sm" @click="mobileMenuOpen = false">
              {{ $t('nav.contact') }}
            </NuxtLink>
            <NuxtLink :to="localePath('/faq')" class="block py-3 px-2 text-text-secondary hover:text-accent transition-colors text-sm" @click="mobileMenuOpen = false">
              {{ $t('nav.faq') }}
            </NuxtLink>
          </div>
        </div>
      </nav>
    </Transition>
  </header>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const mobileMenuOpen = ref(false)
const cart = useCartStore()
const auth = useAuthStore()
const cartCount = computed(() => cart.totalItems)
const cartOpen = useState('cartOpen', () => false)

// Flat nav — every destination one predictable click away (plan §2.1:
// "simple category navigation: flat, labeled" — the mega-dropdown is gone).
const navItems = computed(() => [
  { path: '/produits?type=bike', label: t('nav.type_bikes'), icon: '🚲', type: 'bike' },
  { path: '/produits?type=spare_part', label: t('nav.type_parts'), icon: '🔧', type: 'spare_part' },
  { path: '/produits?type=accessory', label: t('nav.type_accessories'), icon: '🎒', type: 'accessory' },
  { path: '/produits?type=kids_car', label: t('nav.type_kids'), icon: '🧸', type: 'kids_car' },
  { path: '/produits', label: t('nav.all_products'), icon: '', type: '' },
  { path: '/comparatif', label: t('compare.title'), icon: '', type: null },
  { path: '/blog', label: t('blog.title'), icon: '', type: null },
])

function isActiveNav(item: { path: string; type: string | null }) {
  if (item.type === null) return route.path.startsWith(item.path.split('?')[0]) && item.path !== '/produits'
  if (!route.path.includes('/produits')) return false
  const currentType = (route.query.type as string) || ''
  return currentType === item.type
}

function openCart() {
  cartOpen.value = true
}

// Close the mobile menu on navigation.
watch(() => route.fullPath, () => { mobileMenuOpen.value = false })
</script>
