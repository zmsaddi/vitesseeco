<template>
  <div>
    <!-- Hero Section -->
    <section class="relative min-h-[80vh] flex items-center">
      <div class="absolute inset-0">
        <img
          src="/poster.jpeg"
          alt="Vitesse Eco Fatbike"
          class="w-full h-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/40" />
      </div>
      <div class="container-custom relative z-10 py-20">
        <div class="max-w-2xl">
          <h1 class="font-display text-4xl md:text-6xl font-bold text-white leading-tight mb-2">
            {{ $t('home.hero_title') }}
          </h1>
          <p class="font-display text-2xl md:text-4xl font-bold text-accent mb-6">
            {{ $t('home.hero_subtitle') }}
          </p>
          <p class="text-text-secondary text-lg md:text-xl mb-8 leading-relaxed">
            {{ $t('home.hero_description') }}
          </p>
          <NuxtLink :to="localePath('/produits')" class="btn-primary text-lg px-8 py-4 inline-block">
            {{ $t('home.hero_cta') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Brand Values -->
    <section class="py-16 md:py-24 bg-primary">
      <div class="container-custom">
        <h2 class="section-title text-center mb-12">{{ $t('home.values_title') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="(value, i) in values" :key="i" class="card p-6 text-center">
            <div class="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Icon :name="value.icon" class="w-7 h-7 text-accent" />
            </div>
            <h3 class="font-display font-semibold text-white mb-2">{{ value.title }}</h3>
            <p class="text-text-secondary text-sm">{{ value.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Products -->
    <section class="py-16 md:py-24 bg-dark-secondary">
      <div class="container-custom">
        <div class="text-center mb-12">
          <h2 class="section-title mb-4">{{ $t('home.featured_title') }}</h2>
          <p class="text-text-secondary text-lg">{{ $t('home.featured_subtitle') }}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NuxtLink
            v-for="product in featuredProducts"
            :key="product._id"
            :to="localePath(`/produits/${product.slug?.current}`)"
          >
            <ProductCard :product="product" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16 md:py-24 bg-primary">
      <div class="container-custom text-center">
        <h2 class="section-title mb-4">{{ $t('home.cta_title') }}</h2>
        <p class="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
          {{ $t('home.cta_description') }}
        </p>
        <NuxtLink :to="localePath('/produits')" class="btn-outline text-lg px-8 py-4 inline-block">
          {{ $t('home.cta_button') }}
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()

useHead({ title: 'Vitesse Eco — Fatbikes Électriques' })

const query = groq`*[_type == "product" && isFeatured == true] | order(sortOrder asc)[0..2] {
  _id, name, slug, shortDescription, price, compareAtPrice, isOnSale, isNew,
  variants[]{ _key, colorHex, colorName, "images": images[]{asset} }
}`
const { data: featuredProducts } = useSanityFetch('featured-products', query)

const values = computed(() => [
  { icon: 'ph:battery-charging', title: t('home.value1_title'), desc: t('home.value1_desc') },
  { icon: 'ph:shield-check', title: t('home.value2_title'), desc: t('home.value2_desc') },
  { icon: 'ph:truck', title: t('home.value3_title'), desc: t('home.value3_desc') },
  { icon: 'ph:headset', title: t('home.value4_title'), desc: t('home.value4_desc') },
])
</script>
