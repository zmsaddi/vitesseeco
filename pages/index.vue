<template>
  <div>
    <!-- Hero Section -->
    <section class="relative min-h-[80vh] flex items-center">
      <div class="absolute inset-0">
        <img
          src="/poster.jpeg"
          alt="Vitesse Eco Fatbike"
          class="w-full h-full object-cover"
          loading="eager"
          fetchpriority="high"
        />
        <div class="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/40" />
      </div>
      <div class="container-custom relative z-10 py-20">
        <div class="max-w-2xl">
          <h1 class="font-display text-4xl md:text-6xl font-bold text-white leading-tight mb-2">
            {{ heroTitle }}
          </h1>
          <p class="font-display text-2xl md:text-4xl font-bold text-accent mb-6">
            {{ heroSubtitle }}
          </p>
          <p class="text-text-secondary text-lg md:text-xl mb-8 leading-relaxed">
            {{ heroDescription }}
          </p>
          <NuxtLink :to="localePath(heroCtaLink)" class="btn-primary text-lg px-8 py-4 inline-block">
            {{ heroCtaText }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Trust Badges -->
    <section class="py-4 bg-dark-secondary border-y border-dark-tertiary/50">
      <div class="container-custom">
        <div class="flex flex-wrap items-center justify-center gap-6 md:gap-12">
          <div class="flex items-center gap-2 text-sm text-text-secondary">
            <Icon name="ph:lock-simple" class="w-5 h-5 text-accent" />
            <span>{{ $t('trust.secure_payment') }}</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-secondary">
            <Icon name="ph:truck" class="w-5 h-5 text-accent" />
            <span>{{ $t('trust.fast_delivery') }}</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-secondary">
            <Icon name="ph:shield-check" class="w-5 h-5 text-accent" />
            <span>{{ $t('trust.warranty') }}</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-secondary">
            <Icon name="ph:headset" class="w-5 h-5 text-accent" />
            <span>{{ $t('trust.support') }}</span>
          </div>
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
          <h2 class="section-title mb-4">{{ featuredTitle }}</h2>
          <p class="text-text-secondary text-lg">{{ featuredSubtitle }}</p>
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

const query = groq`*[_type == "product" && isFeatured == true] | order(sortOrder asc)[0..2] {
  _id, name, slug, shortDescription, price, compareAtPrice, isOnSale, isNew,
  variants[]{ _key, colorHex, colorName, stock, "images": images[]{asset} }
}`
const { data: featuredProducts } = useSanityFetch('featured-products', query)

const homeQuery = groq`*[_type == "homePage"][0]{
  heroBanner, featuredProductsTitle, featuredProductsSubtitle, values, seo
}`
const { data: homeData } = useSanityFetch('home-page', homeQuery)

useHead({
  title: computed(() => homeData.value?.seo?.title || 'Vitesse Eco — Fatbikes Électriques'),
  meta: [
    { name: 'description', content: computed(() => homeData.value?.seo?.description || '') },
  ],
})

const heroTitle = computed(() => homeData.value?.heroBanner?.title ? l(homeData.value.heroBanner.title) : t('home.hero_title'))
const heroSubtitle = computed(() => homeData.value?.heroBanner?.subtitle ? l(homeData.value.heroBanner.subtitle) : t('home.hero_subtitle'))
const heroDescription = computed(() => homeData.value?.heroBanner?.description ? l(homeData.value.heroBanner.description) : t('home.hero_description'))
const heroCtaText = computed(() => homeData.value?.heroBanner?.ctaText ? l(homeData.value.heroBanner.ctaText) : t('home.hero_cta'))
const heroCtaLink = computed(() => homeData.value?.heroBanner?.ctaLink || '/produits')
const featuredTitle = computed(() => homeData.value?.featuredProductsTitle ? l(homeData.value.featuredProductsTitle) : t('home.featured_title'))
const featuredSubtitle = computed(() => homeData.value?.featuredProductsSubtitle ? l(homeData.value.featuredProductsSubtitle) : t('home.featured_subtitle'))

const iconMap: Record<string, string> = {
  'battery-charging': 'ph:battery-charging',
  'shield-check': 'ph:shield-check',
  'truck': 'ph:truck',
  'headset': 'ph:headset',
}

const values = computed(() => {
  if (homeData.value?.values?.length) {
    return homeData.value.values.map((v: any) => ({
      icon: iconMap[v.icon] || `ph:${v.icon}`,
      title: l(v.title),
      desc: l(v.description),
    }))
  }
  return [
    { icon: 'ph:battery-charging', title: t('home.value1_title'), desc: t('home.value1_desc') },
    { icon: 'ph:shield-check', title: t('home.value2_title'), desc: t('home.value2_desc') },
    { icon: 'ph:truck', title: t('home.value3_title'), desc: t('home.value3_desc') },
    { icon: 'ph:headset', title: t('home.value4_title'), desc: t('home.value4_desc') },
  ]
})
</script>
