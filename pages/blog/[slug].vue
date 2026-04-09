<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-3xl" v-if="article">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-text-secondary mb-8">
        <NuxtLink :to="localePath('/')" class="hover:text-accent transition-colors">{{ $t('nav.home') }}</NuxtLink>
        <Icon name="ph:caret-right" class="w-3 h-3 rtl:rotate-180" />
        <NuxtLink :to="localePath('/blog')" class="hover:text-accent transition-colors">{{ $t('blog.title') }}</NuxtLink>
        <Icon name="ph:caret-right" class="w-3 h-3 rtl:rotate-180" />
        <span class="text-white truncate">{{ l(article.title) }}</span>
      </nav>

      <!-- Featured Image -->
      <div v-if="article.featuredImage?.asset" class="card overflow-hidden mb-8 aspect-video">
        <img
          :src="useSanityImageUrl(article.featuredImage, 1200, 630)"
          :alt="l(article.title)"
          width="1200"
          height="630"
          class="w-full h-full object-cover"
        />
      </div>

      <!-- Article header -->
      <div class="mb-8">
        <h1 class="font-display text-3xl md:text-4xl font-bold text-white mb-4">{{ l(article.title) }}</h1>
        <div class="flex items-center gap-4 text-text-secondary text-sm">
          <span v-if="article.author" class="flex items-center gap-1.5">
            <Icon name="ph:user" class="w-4 h-4" /> {{ article.author }}
          </span>
          <span v-if="article.publishedAt" class="flex items-center gap-1.5">
            <Icon name="ph:calendar" class="w-4 h-4" />
            {{ new Date(article.publishedAt).toLocaleDateString($i18n.locale === 'ar' ? 'ar-SA' : $i18n.locale + '-' + $i18n.locale.toUpperCase()) }}
          </span>
        </div>
      </div>

      <!-- Content -->
      <div class="prose prose-invert max-w-none text-text-secondary leading-relaxed whitespace-pre-line">
        {{ l(article.content) }}
      </div>

      <!-- Related Products -->
      <section v-if="article.relatedProducts?.length" class="mt-12 pt-8 border-t border-dark-tertiary">
        <h2 class="font-display text-xl font-semibold text-white mb-6">{{ $t('product.related') }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <NuxtLink
            v-for="rp in article.relatedProducts"
            :key="rp._id"
            :to="localePath(`/produits/${rp.slug?.current}`)"
          >
            <ProductCard :product="rp" />
          </NuxtLink>
        </div>
      </section>

      <!-- Back to blog -->
      <div class="mt-8 text-center">
        <NuxtLink :to="localePath('/blog')" class="text-accent hover:underline flex items-center justify-center gap-2">
          <Icon name="ph:arrow-left" class="w-4 h-4 rtl:rotate-180" />
          {{ $t('blog.back_to_blog') }}
        </NuxtLink>
      </div>
    </div>

    <!-- Loading -->
    <div v-else class="container-custom py-20 text-center">
      <Icon name="ph:spinner" class="w-8 h-8 text-accent animate-spin mx-auto" />
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const route = useRoute()

const slug = computed(() => route.params.slug as string)

const { data: article, status } = useSanityFetch(
  () => `article-${slug.value}`,
  groq`*[_type == "article" && slug.current == $slug && isPublished == true][0] {
    _id, title, slug, excerpt, content, featuredImage, author, publishedAt, seo,
    relatedProducts[]->{ _id, name, slug, price, variants[]{ _key, colorHex, colorName, stock, "images": images[]{asset} } }
  }`,
  { slug }
)

// 404
if (import.meta.server && status.value === 'success' && !article.value) {
  throw createError({ statusCode: 404, message: 'Article not found' })
}
if (import.meta.client) {
  watch([status, article], () => {
    if (status.value === 'success' && !article.value) {
      showError({ statusCode: 404, message: 'Article not found' })
    }
  })
}

// SEO + Article JSON-LD
useHead({
  title: computed(() => article.value?.seo?.title || (article.value ? `${l(article.value.title)} — Vitesse Eco` : 'Vitesse Eco')),
  meta: computed(() => article.value ? [
    { name: 'description', content: article.value.seo?.description || l(article.value.excerpt) || '' },
  ] : []),
  script: computed(() => {
    if (!article.value) return []
    const a = article.value
    return [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: l(a.title),
        description: l(a.excerpt),
        image: a.featuredImage?.asset ? useSanityImageUrl(a.featuredImage, 1200, 630) : undefined,
        author: a.author ? { '@type': 'Person', name: a.author } : undefined,
        datePublished: a.publishedAt,
        publisher: { '@type': 'Organization', name: 'Vitesse Eco', url: 'https://vitesse-eco.fr' },
      }),
    }]
  }),
})
</script>
