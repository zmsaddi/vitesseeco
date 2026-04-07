<template>
  <header class="sticky top-0 z-40 bg-primary/95 backdrop-blur-md border-b border-dark-tertiary/50">
    <div class="container-custom">
      <div class="flex items-center justify-between h-16 md:h-20">
        <!-- Logo -->
        <NuxtLink :to="localePath('/')" class="flex items-center gap-3 shrink-0">
          <img src="/logo.png" alt="Vitesse Eco" class="h-10 md:h-12 w-auto" />
          <span class="font-display font-bold text-lg md:text-xl hidden sm:block">
            <span class="text-white">Vitesse</span>
            <span class="text-accent"> Eco</span>
          </span>
        </NuxtLink>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-8">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.path"
            :to="localePath(link.path)"
            class="text-text-secondary hover:text-accent transition-colors text-sm font-medium"
            active-class="!text-accent"
          >
            {{ $t(link.label) }}
          </NuxtLink>
        </nav>

        <!-- Right Icons -->
        <div class="flex items-center gap-2 md:gap-4">
          <LanguageSwitcher />

          <button
            @click="openCart"
            class="relative text-text-secondary hover:text-white transition-colors p-2"
          >
            <Icon name="ph:shopping-cart" class="w-5 h-5" />
            <span
              v-if="cartCount > 0"
              class="absolute -top-1 -right-1 bg-accent text-primary text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
            >
              {{ cartCount }}
            </span>
          </button>

          <NuxtLink
            :to="localePath('/contact')"
            class="hidden md:flex text-text-secondary hover:text-white transition-colors p-2"
          >
            <Icon name="ph:user" class="w-5 h-5" />
          </NuxtLink>

          <!-- Mobile Menu Button -->
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="md:hidden text-text-secondary hover:text-white transition-colors p-2"
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
          <NuxtLink
            v-for="link in navLinks"
            :key="link.path"
            :to="localePath(link.path)"
            class="block py-3 px-2 text-text-secondary hover:text-accent transition-colors font-medium"
            active-class="!text-accent"
            @click="mobileMenuOpen = false"
          >
            {{ $t(link.label) }}
          </NuxtLink>
        </nav>
      </Transition>
    </div>
  </header>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const mobileMenuOpen = ref(false)
const cartCount = ref(0)
const cartOpen = useState('cartOpen', () => false)

const navLinks = [
  { path: '/', label: 'nav.home' },
  { path: '/produits', label: 'nav.products' },
  { path: '/a-propos', label: 'nav.about' },
  { path: '/contact', label: 'nav.contact' },
]

function openCart() {
  cartOpen.value = true
}
</script>
