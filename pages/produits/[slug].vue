<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-text-secondary mb-8">
        <NuxtLink :to="localePath('/')" class="hover:text-accent transition-colors">{{ $t('nav.home') }}</NuxtLink>
        <Icon name="ph:caret-right" class="w-3 h-3" />
        <NuxtLink :to="localePath('/produits')" class="hover:text-accent transition-colors">{{ $t('nav.products') }}</NuxtLink>
        <Icon name="ph:caret-right" class="w-3 h-3" />
        <span class="text-white">{{ product.name }}</span>
      </nav>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <!-- Image Gallery -->
        <div class="space-y-4">
          <div class="card aspect-square flex items-center justify-center bg-dark-tertiary">
            <Icon name="ph:bicycle" class="w-32 h-32 text-dark-tertiary/50" />
          </div>
          <div class="grid grid-cols-4 gap-2">
            <div v-for="i in 4" :key="i" class="card aspect-square flex items-center justify-center bg-dark-tertiary cursor-pointer hover:border-accent/50">
              <Icon name="ph:bicycle" class="w-8 h-8 text-dark-tertiary/50" />
            </div>
          </div>
        </div>

        <!-- Product Info -->
        <div>
          <div class="flex items-center gap-2 mb-2" v-if="product.badge">
            <span :class="product.badge === 'PROMO' ? 'badge-promo' : 'badge-new'">{{ product.badge }}</span>
          </div>

          <h1 class="font-display text-3xl md:text-4xl font-bold text-white mb-2">{{ product.name }}</h1>
          <p class="text-text-secondary text-lg mb-4">{{ product.feature }}</p>

          <div class="text-3xl font-bold text-accent mb-6">
            {{ $t('common.from') }} {{ product.price }}{{ $t('common.currency') }}
          </div>

          <!-- Color Picker -->
          <div class="mb-6" v-if="product.colors.length > 0">
            <label class="text-sm font-medium text-text-secondary block mb-3">{{ $t('product.select_color') }}</label>
            <div class="flex gap-3">
              <button
                v-for="(color, i) in product.colors"
                :key="i"
                @click="selectedColor = i"
                class="w-10 h-10 rounded-full border-2 transition-all"
                :class="selectedColor === i ? 'border-accent scale-110' : 'border-dark-tertiary'"
                :style="{ backgroundColor: color }"
              />
            </div>
          </div>

          <!-- Quantity -->
          <div class="mb-6">
            <label class="text-sm font-medium text-text-secondary block mb-3">{{ $t('cart.quantity') }}</label>
            <div class="flex items-center gap-3">
              <button @click="qty = Math.max(1, qty - 1)" class="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors">
                <Icon name="ph:minus" class="w-4 h-4" />
              </button>
              <span class="w-12 text-center font-semibold text-lg">{{ qty }}</span>
              <button @click="qty++" class="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-tertiary flex items-center justify-center hover:border-accent transition-colors">
                <Icon name="ph:plus" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Add to Cart -->
          <button class="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3 mb-4">
            <Icon name="ph:shopping-cart" class="w-5 h-5" />
            {{ $t('product.add_to_cart') }}
          </button>

          <p class="text-accent text-sm flex items-center gap-2">
            <Icon name="ph:check-circle" class="w-4 h-4" />
            {{ $t('product.in_stock') }}
          </p>

          <!-- Specs Table -->
          <div class="mt-8">
            <h2 class="font-display text-xl font-semibold text-white mb-4">{{ $t('product.specifications') }}</h2>
            <div class="card divide-y divide-dark-tertiary/50">
              <div v-for="spec in specs" :key="spec.label" class="flex justify-between px-4 py-3">
                <span class="text-text-secondary text-sm">{{ $t(spec.label) }}</span>
                <span class="text-white text-sm font-medium">{{ spec.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Related Products -->
      <section class="mt-16">
        <h2 class="section-title mb-8">{{ $t('product.related') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="rp in relatedProducts"
            :key="rp.slug"
            :to="localePath(`/produits/${rp.slug}`)"
            class="card group"
          >
            <div class="aspect-[4/3] bg-dark-tertiary flex items-center justify-center">
              <Icon name="ph:bicycle" class="w-16 h-16 text-dark-tertiary/50" />
            </div>
            <div class="p-4">
              <h3 class="font-display font-semibold text-white group-hover:text-accent transition-colors">{{ rp.name }}</h3>
              <p class="text-accent font-bold mt-1">{{ $t('common.from') }} {{ rp.price }}{{ $t('common.currency') }}</p>
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const selectedColor = ref(0)
const qty = ref(1)

// Placeholder product data
const product = {
  name: 'V20 Pro',
  feature: 'Bestseller — Sièges extensibles',
  price: '1 299',
  badge: 'BEST',
  colors: ['#000000', '#8E8E8E', '#4A4A4A'],
  battery: '48V 15.6AH',
  motor: '250W',
  tire: '20"',
  range: '40-50km',
  brakes: 'Hydrauliques',
  weight: '32kg',
}

const specs = [
  { label: 'product.motor', value: product.motor },
  { label: 'product.battery', value: product.battery },
  { label: 'product.tire_size', value: product.tire },
  { label: 'product.range', value: product.range },
  { label: 'product.brake_type', value: product.brakes },
  { label: 'product.weight', value: product.weight },
]

const relatedProducts = [
  { slug: 'v20-limited', name: 'V20 Limited', price: '1 399' },
  { slug: 'v20-cross', name: 'V20 Cross', price: '1 599' },
  { slug: 'q30', name: 'Q30 Pliable', price: '1 399' },
]

useHead({ title: `${product.name} — Vitesse Eco` })
</script>
