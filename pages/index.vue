<template>
  <div>
    <!-- Hero Section — premium refresh with layered visuals -->
    <section class="relative min-h-[85vh] flex items-center overflow-hidden">
      <!-- Background image -->
      <div class="absolute inset-0">
        <img
          src="/poster.webp"
          alt="Vitesse Eco Fatbike"
          width="1200"
          height="630"
          class="w-full h-full object-cover scale-105"
          loading="eager"
          fetchpriority="high"
        />
        <!-- Layered gradients for depth -->
        <div class="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-primary/30" />
        <div class="absolute inset-0 bg-hero-glow" />
        <!-- Bottom fade into next section -->
        <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-primary" />
      </div>

      <!-- Decorative accent line at top-right -->
      <div class="absolute top-0 right-0 w-72 h-72 rtl:left-0 rtl:right-auto pointer-events-none">
        <div class="absolute inset-0 bg-accent/5 blur-3xl rounded-full" />
      </div>

      <div class="container-custom relative z-10 py-20">
        <div class="max-w-2xl">
          <!-- Eyebrow tag -->
          <div class="inline-flex items-center gap-2 px-3 py-1.5 mb-6 bg-accent/10 border border-accent/20 rounded-full backdrop-blur-sm">
            <span class="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span class="text-accent text-xs font-medium tracking-wider uppercase">
              ⚡ {{ $t('site.tagline') }}
            </span>
          </div>

          <h1 class="font-display text-5xl md:text-7xl font-black text-white leading-[1.05] mb-3 tracking-tight">
            {{ heroTitle }}
          </h1>
          <p class="font-display text-3xl md:text-5xl font-black text-gradient-accent mb-8 leading-tight">
            {{ heroSubtitle }}
          </p>
          <p class="text-text-secondary text-base md:text-xl mb-10 leading-relaxed max-w-xl">
            {{ heroDescription }}
          </p>
          <div class="flex flex-wrap items-center gap-4">
            <NuxtLink :to="localePath(heroCtaLink)" class="btn-primary text-lg px-8 py-4 glow-accent-strong inline-flex items-center gap-2">
              {{ heroCtaText }}
              <Icon name="ph:arrow-right" class="w-5 h-5 rtl:rotate-180" />
            </NuxtLink>
            <NuxtLink :to="localePath('/comparatif')" class="btn-outline text-lg px-8 py-4 inline-flex items-center gap-2">
              <Icon name="ph:table" class="w-5 h-5" />
              {{ $t('compare.title') }}
            </NuxtLink>
          </div>

          <!-- Quick stats -->
          <div class="mt-12 flex flex-wrap items-center gap-8 max-w-xl">
            <div>
              <div class="text-2xl font-display font-bold text-white">100<span class="text-accent">km</span></div>
              <div class="text-text-secondary text-xs uppercase tracking-wider mt-1">{{ $t('product.range') }}</div>
            </div>
            <div class="w-px h-10 bg-dark-tertiary" />
            <div>
              <div class="text-2xl font-display font-bold text-white">5<span class="text-accent">-7</span> {{ $t('faq.cat_shipping') }}</div>
              <div class="text-text-secondary text-xs uppercase tracking-wider mt-1">{{ $t('trust.fast_delivery') }}</div>
            </div>
            <div class="w-px h-10 bg-dark-tertiary" />
            <div>
              <div class="text-2xl font-display font-bold text-white">2<span class="text-accent">+</span></div>
              <div class="text-text-secondary text-xs uppercase tracking-wider mt-1">{{ $t('trust.warranty') }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Trust Badges — refined with subtle accent border + hover -->
    <section class="py-5 bg-dark-secondary border-y border-dark-tertiary/50 relative">
      <div class="absolute inset-x-0 top-0 divider-accent" />
      <div class="container-custom">
        <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:gap-x-12">
          <div v-for="t in trustBadges" :key="t.label" class="group flex items-center gap-2 text-sm text-text-secondary hover:text-white transition-colors duration-fast">
            <div class="w-9 h-9 bg-accent/10 group-hover:bg-accent/20 rounded-lg flex items-center justify-center transition-colors duration-fast">
              <Icon :name="t.icon" class="w-4 h-4 text-accent" />
            </div>
            <span class="font-medium">{{ t.label }}</span>
          </div>
        </div>
      </div>
      <div class="absolute inset-x-0 bottom-0 divider-accent" />
    </section>

    <!-- Brand Values — premium card lift -->
    <section class="py-16 md:py-24 bg-primary">
      <div class="container-custom">
        <div class="text-center mb-12">
          <span class="text-accent text-xs font-bold uppercase tracking-[0.2em]">— Vitesse Eco —</span>
          <h2 class="section-title mt-3">{{ $t('home.values_title') }}</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="(value, i) in values"
            :key="i"
            data-reveal
            :data-reveal-delay="(i % 4) + 1"
            class="card card-lift p-6 text-center group"
          >
            <div class="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-normal ease-soft">
              <Icon :name="value.icon" class="w-8 h-8 text-accent" />
            </div>
            <h3 class="font-display font-bold text-white mb-2 text-lg">{{ value.title }}</h3>
            <p class="text-text-secondary text-sm leading-relaxed">{{ value.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Products — section divider + premium framing -->
    <section class="py-16 md:py-24 bg-dark-secondary relative">
      <div class="absolute inset-x-0 top-0 divider-accent" />
      <div class="container-custom">
        <div class="text-center mb-12">
          <span class="text-accent text-xs font-bold uppercase tracking-[0.2em]">⭐ Top Selection</span>
          <h2 class="section-title mt-3 mb-3">{{ featuredTitle }}</h2>
          <p class="text-text-secondary text-lg max-w-xl mx-auto">{{ featuredSubtitle }}</p>
        </div>
        <!-- Skeleton while loading -->
        <div v-if="!featuredProducts" class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div v-for="i in 3" :key="i" class="card animate-pulse">
            <div class="aspect-[4/3] bg-dark-tertiary" />
            <div class="p-4 space-y-3">
              <div class="h-3 bg-dark-tertiary rounded w-1/3" />
              <div class="h-4 bg-dark-tertiary rounded w-3/4" />
              <div class="h-5 bg-dark-tertiary rounded w-1/4" />
            </div>
          </div>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NuxtLink
            v-for="(product, i) in featuredProducts"
            :key="product._id"
            :to="localePath(`/produits/${product.slug?.current}`)"
            data-reveal
            :data-reveal-delay="(i % 3) + 1"
            class="block focus-ring rounded-xl"
          >
            <ProductCard :product="product" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Latest Blog Articles -->
    <section v-if="latestArticles?.length" class="py-16 md:py-24 bg-primary">
      <div class="container-custom">
        <div class="flex items-center justify-between mb-10">
          <h2 class="section-title">{{ $t('blog.title') }}</h2>
          <NuxtLink :to="localePath('/blog')" class="text-accent hover:underline text-sm font-medium flex items-center gap-1">
            {{ $t('blog.see_all_articles') }} <Icon name="ph:arrow-right" class="w-4 h-4 rtl:rotate-180" />
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NuxtLink
            v-for="article in latestArticles"
            :key="article._id"
            :to="localePath(`/blog/${article.slug?.current}`)"
            class="card overflow-hidden group hover:border-accent/30 transition-colors"
          >
            <div class="aspect-video bg-dark-tertiary overflow-hidden">
              <img
                v-if="article.featuredImage?.asset"
                :src="useSanityImageUrl(article.featuredImage, 400, 225)"
                :alt="l(article.title)"
                width="400"
                height="225"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div class="p-4">
              <h3 class="font-display font-semibold text-white text-sm mb-1 group-hover:text-accent transition-colors line-clamp-2">
                {{ l(article.title) }}
              </h3>
              <p class="text-text-secondary text-xs line-clamp-2">{{ l(article.excerpt) }}</p>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- CTA Section — premium with accent glow card -->
    <section class="py-16 md:py-24 bg-primary relative overflow-hidden">
      <!-- Decorative blur accents -->
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 blur-3xl rounded-full pointer-events-none" />
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-gold/5 blur-3xl rounded-full pointer-events-none" />

      <div class="container-custom relative">
        <div class="card-premium card p-10 md:p-16 text-center max-w-3xl mx-auto">
          <Icon name="ph:lightning" class="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 class="section-title mb-4">{{ $t('home.cta_title') }}</h2>
          <p class="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
            {{ $t('home.cta_description') }}
          </p>
          <NuxtLink :to="localePath('/produits')" class="btn-primary text-lg px-8 py-4 glow-accent-strong inline-flex items-center gap-2">
            {{ $t('home.cta_button') }}
            <Icon name="ph:arrow-right" class="w-5 h-5 rtl:rotate-180" />
          </NuxtLink>
        </div>
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
  color, colorHex, stock, "images": images[]{asset}
}`
const { data: featuredProducts } = useSanityFetch('featured-products', query)

// Latest blog articles
const blogQuery = groq`*[_type == "article" && isPublished == true] | order(publishedAt desc)[0..2] {
  _id, title, slug, excerpt, featuredImage, publishedAt
}`
const { data: latestArticles } = useSanityFetch('latest-articles', blogQuery)

const homeQuery = groq`*[_type == "homePage"][0]{
  heroBanner, featuredProductsTitle, featuredProductsSubtitle, values, seo
}`
const { data: homeData } = useSanityFetch('home-page', homeQuery)

useSeoMeta({
  title: () => homeData.value?.seo?.title || 'Vitesse Eco — Fatbikes Électriques',
  description: () => homeData.value?.seo?.description || '',
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

const trustBadges = computed(() => [
  { icon: 'ph:lock-simple',  label: t('trust.secure_payment') },
  { icon: 'ph:truck',        label: t('trust.fast_delivery') },
  { icon: 'ph:shield-check', label: t('trust.warranty') },
  { icon: 'ph:headset',      label: t('trust.support') },
])
</script>
