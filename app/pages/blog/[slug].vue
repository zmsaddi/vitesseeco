<script setup lang="ts">
import type { ArticleDetail } from '~~/server/catalog/types'
import { localizedUrl, type LocaleCode } from '~~/shared/locales'
import { ORGANISATION, SITE_URL } from '~~/shared/organisation'

/**
 * One article.
 *
 * The fetch is awaited so an unknown slug produces a real 404 during server
 * rendering rather than a 200 with nothing on it, which tells a search engine
 * the page exists.
 *
 * Related products are priced live through the catalogue rather than rendered
 * from the document, so an article written in March cannot quote a March price.
 */
const route = useRoute()
const localePath = useLocalePath()
const { locale, t } = useI18n()
const { formatLongDate } = useFormatDate()

const slug = computed(() => String(route.params.slug))

const { data: article } = await useFetch<ArticleDetail>(
  () => `/api/content/articles/${slug.value}`,
  { query: computed(() => ({ locale: locale.value })) }
)

if (!article.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article not found', fatal: true })
}

useSeoMeta({
  title: () => article.value?.seo.title || article.value?.title || '',
  description: () => article.value?.seo.description || article.value?.excerpt || '',
  ogImage: () => article.value?.image?.url ?? '',
  ogType: 'article',
})

useHead(() => {
  const item = article.value
  if (!item) return {}
  const url = localizedUrl(`/blog/${item.slug}`, locale.value as LocaleCode)
  return {
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Article',
              '@id': `${url}#article`,
              headline: item.title,
              description: item.excerpt ?? undefined,
              image: item.image ? [item.image.url] : undefined,
              datePublished: item.publishedAt ?? undefined,
              dateModified: item.updatedAt || item.publishedAt || undefined,
              author: { '@type': item.author ? 'Person' : 'Organization', name: item.author || ORGANISATION.name },
              publisher: { '@id': `${SITE_URL}/#organization` },
              mainEntityOfPage: url,
              inLanguage: locale.value,
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: t('nav.home'), item: localizedUrl('/', locale.value as LocaleCode) },
                { '@type': 'ListItem', position: 2, name: t('blog.title'), item: localizedUrl('/blog', locale.value as LocaleCode) },
                { '@type': 'ListItem', position: 3, name: item.title, item: url },
              ],
            },
          ],
        }),
      },
    ],
  }
})
</script>

<template>
  <article v-if="article" class="container-page py-10">
    <NuxtLink :to="localePath('/blog')" class="text-sm text-content-muted hover:text-content-strong">
      ← {{ $t('blog.title') }}
    </NuxtLink>

    <header class="mt-4 max-w-3xl">
      <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ article.title }}</h1>
      <p class="mt-2 text-sm text-content-muted">
        <span v-if="article.publishedAt">{{ formatLongDate(article.publishedAt) }}</span>
        <span v-if="article.author"> · {{ article.author }}</span>
      </p>
      <p v-if="article.excerpt" class="mt-4 text-lg text-content">{{ article.excerpt }}</p>
    </header>

    <NuxtImg
      v-if="article.image"
      :src="article.image.url"
      :alt="article.image.alt"
      width="1200"
      height="675"
      class="mt-8 aspect-video w-full rounded-2xl object-cover"
    />

    <!-- Plain text from the Studio, rendered as paragraphs. Interpolated as
         text rather than HTML: editorial copy must never be able to inject
         markup into the page. -->
    <div v-if="article.content" class="mt-8 max-w-3xl space-y-4">
      <p
        v-for="(paragraph, index) in article.content.split(/\n{2,}/).filter(Boolean)"
        :key="index"
        class="whitespace-pre-line leading-relaxed text-content"
      >{{ paragraph }}</p>
    </div>

    <!-- The point of writing the article: something to act on. -->
    <section v-if="article.relatedProducts.length" class="mt-12">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('blog.related') }}</h2>
      <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="product in article.relatedProducts" :key="product.id" class="card overflow-hidden">
          <NuxtLink :to="localePath(`/produits/${product.slug}`)" class="block">
            <NuxtImg
              v-if="product.image"
              :src="product.image.url"
              :alt="product.image.alt"
              width="400"
              height="400"
              loading="lazy"
              class="aspect-square w-full object-cover"
            />
            <div class="p-4">
              <p class="font-medium text-content-strong">{{ product.name }}</p>
              <p class="mt-1 text-sm text-content-muted">{{ (product.price / 100).toFixed(2) }} €</p>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </article>
</template>
