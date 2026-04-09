<template>
  <header class="sticky top-0 z-40 bg-primary/95 backdrop-blur-md border-b border-dark-tertiary/50">
    <div class="container-custom">
      <div class="flex items-center justify-between h-16 md:h-20">
        <!-- Logo -->
        <NuxtLink :to="localePath('/')" class="flex items-center gap-3 shrink-0">
          <img src="/logo.webp" alt="Vitesse Eco" width="48" height="48" class="h-10 md:h-12 w-auto" />
          <span class="font-display font-bold text-lg md:text-xl hidden sm:block">
            <span class="text-white">Vitesse</span>
            <span class="text-accent"> Eco</span>
          </span>
        </NuxtLink>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-6">
          <NuxtLink :to="localePath('/')" class="text-text-secondary hover:text-accent transition-colors text-sm font-medium" active-class="!text-accent">
            {{ $t('nav.home') }}
          </NuxtLink>

          <!-- Products Mega Dropdown -->
          <div class="relative" ref="productsDropdown" @mouseenter="showProducts = true" @mouseleave="showProducts = false">
            <button
              @click="showProducts = !showProducts"
              class="flex items-center gap-1 text-text-secondary hover:text-accent transition-colors text-sm font-medium"
              :class="{ '!text-accent': $route.path.includes('/produits') }"
            >
              {{ $t('nav.products') }}
              <Icon name="ph:caret-down" class="w-3 h-3 transition-transform" :class="{ 'rotate-180': showProducts }" />
            </button>

            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="opacity-0 -translate-y-2 scale-95"
              enter-to-class="opacity-100 translate-y-0 scale-100"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100 translate-y-0 scale-100"
              leave-to-class="opacity-0 -translate-y-2 scale-95"
            >
              <div v-if="showProducts" class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[480px] bg-dark-secondary border border-dark-tertiary rounded-xl shadow-2xl overflow-hidden z-50">
                <div class="p-5">
                  <div class="grid grid-cols-2 gap-3">
                    <NuxtLink
                      v-for="type in productTypes"
                      :key="type.value"
                      :to="localePath(type.path)"
                      @click="showProducts = false"
                      class="flex items-start gap-3 p-3 rounded-lg hover:bg-dark-tertiary/50 transition-colors group"
                    >
                      <span class="text-xl">{{ type.icon }}</span>
                      <div>
                        <p class="text-white font-medium text-sm group-hover:text-accent transition-colors">{{ type.label }}</p>
                        <p class="text-text-secondary text-xs mt-0.5">{{ type.desc }}</p>
                      </div>
                    </NuxtLink>
                  </div>
                  <div class="border-t border-dark-tertiary mt-4 pt-3 flex items-center justify-between">
                    <NuxtLink :to="localePath('/produits')" @click="showProducts = false" class="text-accent text-sm font-medium hover:underline flex items-center gap-1">
                      {{ $t('nav.all_products') }} <Icon name="ph:arrow-right" class="w-4 h-4 rtl:rotate-180" />
                    </NuxtLink>
                    <NuxtLink :to="localePath('/guide')" @click="showProducts = false" class="text-text-secondary text-xs hover:text-accent flex items-center gap-1">
                      <Icon name="ph:compass" class="w-3.5 h-3.5" /> {{ $t('guide.title') }}
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <NuxtLink :to="localePath('/blog')" class="text-text-secondary hover:text-accent transition-colors text-sm font-medium" active-class="!text-accent">
            {{ $t('blog.title') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/a-propos')" class="text-text-secondary hover:text-accent transition-colors text-sm font-medium" active-class="!text-accent">
            {{ $t('nav.about') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/contact')" class="text-text-secondary hover:text-accent transition-colors text-sm font-medium" active-class="!text-accent">
            {{ $t('nav.contact') }}
          </NuxtLink>
        </nav>

        <!-- Right Icons -->
        <div class="flex items-center gap-2 md:gap-4">
          <LanguageSwitcher />

          <button
            @click="openCart"
            class="relative text-text-secondary hover:text-white transition-colors p-2"
            :aria-label="$t('cart.title')"
          >
            <Icon name="ph:shopping-cart" class="w-5 h-5" />
            <ClientOnly>
              <span
                v-if="cartCount > 0"
                class="absolute -top-1 -right-1 bg-accent text-primary text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
              >
                {{ cartCount }}
              </span>
            </ClientOnly>
          </button>

          <ClientOnly>
            <NuxtLink
              :to="localePath(auth.isLoggedIn ? '/compte' : '/connexion')"
              class="text-text-secondary hover:text-white transition-colors p-2"
              :aria-label="auth.isLoggedIn ? $t('account.title') : $t('nav.login')"
            >
              <Icon :name="auth.isLoggedIn ? 'ph:user-circle-fill' : 'ph:user'" class="w-5 h-5" :class="auth.isLoggedIn ? 'text-accent' : ''" />
            </NuxtLink>
          </ClientOnly>

          <!-- Mobile Menu Button -->
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="md:hidden text-text-secondary hover:text-white transition-colors p-2"
            :aria-label="mobileMenuOpen ? $t('nav.close_menu') : $t('nav.open_menu')"
          >
            <Icon :name="mobileMenuOpen ? 'ph:x' : 'ph:list'" class="w-6 h-6" />
          </button>
        </div>
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
        <nav v-if="mobileMenuOpen" class="md:hidden pb-4 border-t border-dark-tertiary/50 mt-2 pt-4">
          <NuxtLink :to="localePath('/')" class="block py-3 px-2 text-text-secondary hover:text-accent transition-colors font-medium" @click="mobileMenuOpen = false">
            {{ $t('nav.home') }}
          </NuxtLink>

          <!-- Mobile: Products section -->
          <div class="py-2">
            <p class="px-2 text-white font-semibold text-sm mb-2">{{ $t('nav.products') }}</p>
            <NuxtLink
              v-for="type in productTypes"
              :key="type.value"
              :to="localePath(type.path)"
              class="block py-2.5 px-4 text-text-secondary hover:text-accent transition-colors text-sm flex items-center gap-2"
              @click="mobileMenuOpen = false"
            >
              <span>{{ type.icon }}</span> {{ type.label }}
            </NuxtLink>
            <NuxtLink :to="localePath('/produits')" class="block py-2.5 px-4 text-accent text-sm font-medium" @click="mobileMenuOpen = false">
              → {{ $t('nav.all_products') }}
            </NuxtLink>
          </div>

          <NuxtLink :to="localePath('/blog')" class="block py-3 px-2 text-text-secondary hover:text-accent transition-colors font-medium" @click="mobileMenuOpen = false">
            {{ $t('blog.title') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/a-propos')" class="block py-3 px-2 text-text-secondary hover:text-accent transition-colors font-medium" @click="mobileMenuOpen = false">
            {{ $t('nav.about') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/contact')" class="block py-3 px-2 text-text-secondary hover:text-accent transition-colors font-medium" @click="mobileMenuOpen = false">
            {{ $t('nav.contact') }}
          </NuxtLink>
        </nav>
      </Transition>
    </div>
  </header>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const mobileMenuOpen = ref(false)
const showProducts = ref(false)
const productsDropdown = ref<HTMLElement>()
const cart = useCartStore()
const auth = useAuthStore()
const cartCount = computed(() => cart.totalItems)
const cartOpen = useState('cartOpen', () => false)

const productTypes = computed(() => [
  {
    value: 'bike', icon: '🚲', path: '/produits?type=bike',
    label: t('nav.type_bikes'), desc: t('nav.type_bikes_desc'),
  },
  {
    value: 'accessory', icon: '🎒', path: '/produits?type=accessory',
    label: t('nav.type_accessories'), desc: t('nav.type_accessories_desc'),
  },
  {
    value: 'spare_part', icon: '🔧', path: '/produits?type=spare_part',
    label: t('nav.type_parts'), desc: t('nav.type_parts_desc'),
  },
  {
    value: 'kids_car', icon: '🚗', path: '/produits?type=kids_car',
    label: t('nav.type_kids'), desc: t('nav.type_kids_desc'),
  },
])

function openCart() {
  cartOpen.value = true
}
</script>
