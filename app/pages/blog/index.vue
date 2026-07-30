<script setup lang="ts">
import type { Article } from '~~/server/catalog/types'

/**
 * The blog.
 *
 * Seven articles existed in the Studio and on no page, because nothing queried
 * them. They are the pages that answer the questions a buyer asks before they
 * are ready to buy — which range does a fatbike really do, is it road-legal —
 * and those are the searches that bring someone to a shop they have not heard
 * of.
 */
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { formatLongDate } = useFormatDate()

const { data } = await useFetch<{ articles: Article[] }>('/api/content/articles', {
  query: computed(() => ({ locale: locale.value })),
})

const articles = computed(() => data.value?.articles ?? [])

useSeoMeta({
  title: () => t('blog.title'),
  description: () => t('blog.description'),
})
</script>

<template>
  <div class="container-page py-10">
    <h1 class="font-display text-3xl font-extrabold text-content-strong">{{ $t('blog.title') }}</h1>
    <p class="mt-2 max-w-2xl text-content-muted">{{ $t('blog.description') }}</p>

    <p v-if="articles.length === 0" class="mt-10 text-content-muted">{{ $t('blog.empty') }}</p>

    <ul v-else class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="article in articles" :key="article.id" class="card overflow-hidden">
        <NuxtLink :to="localePath(`/blog/${article.slug}`)" class="block">
          <NuxtImg
            v-if="article.image"
            :src="article.image.url"
            :alt="article.image.alt"
            width="600"
            height="338"
            loading="lazy"
            class="aspect-video w-full object-cover"
          />
          <div class="p-5">
            <p v-if="article.publishedAt" class="text-xs text-content-muted">
              {{ formatLongDate(article.publishedAt) }}
            </p>
            <h2 class="mt-1 font-display font-bold text-content-strong">{{ article.title }}</h2>
            <p v-if="article.excerpt" class="mt-2 line-clamp-3 text-sm text-content-muted">
              {{ article.excerpt }}
            </p>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
