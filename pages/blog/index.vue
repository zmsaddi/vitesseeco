<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="section-title mb-4">{{ $t('blog.title') }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ $t('blog.subtitle') }}</p>
      </div>

      <!-- Articles grid -->
      <div v-if="articles?.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <NuxtLink
          v-for="article in articles"
          :key="article._id"
          :to="localePath(`/blog/${article.slug?.current}`)"
          class="card overflow-hidden group hover:border-accent/30 transition-colors"
        >
          <div class="aspect-video bg-dark-tertiary overflow-hidden">
            <img
              v-if="article.featuredImage?.asset"
              :src="useSanityImageUrl(article.featuredImage, 600, 340)"
              :alt="l(article.title)"
              width="600"
              height="340"
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Icon name="ph:article" class="w-12 h-12 text-dark-tertiary/50" />
            </div>
          </div>
          <div class="p-5">
            <p v-if="article.publishedAt" class="text-text-secondary text-xs mb-2">
              {{ new Date(article.publishedAt).toLocaleDateString($i18n.locale === 'ar' ? 'ar-SA' : $i18n.locale + '-' + $i18n.locale.toUpperCase()) }}
            </p>
            <h2 class="font-display font-semibold text-white mb-2 group-hover:text-accent transition-colors">
              {{ l(article.title) }}
            </h2>
            <p class="text-text-secondary text-sm line-clamp-3">{{ l(article.excerpt) }}</p>
          </div>
        </NuxtLink>
      </div>

      <!-- Empty -->
      <div v-else class="text-center py-20">
        <Icon name="ph:article" class="w-16 h-16 text-dark-tertiary mx-auto mb-4" />
        <p class="text-text-secondary">{{ $t('blog.no_articles') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()

useHead({
  title: `${t('blog.title')} — Vitesse Eco`,
  meta: [
    { name: 'description', content: t('blog.subtitle') },
  ],
})

const { data: articles } = useSanityFetch(
  'blog-articles',
  groq`*[_type == "article" && isPublished == true] | order(publishedAt desc) {
    _id, title, slug, excerpt, featuredImage, publishedAt, author
  }`
)
</script>
