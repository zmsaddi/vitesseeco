<template>
  <div v-if="page">
    <template v-for="(section, i) in page.sections" :key="i">
      <!-- Hero Banner -->
      <section v-if="section._type === 'heroBanner'" class="relative min-h-[60vh] flex items-center">
        <div v-if="section.image?.asset" class="absolute inset-0">
          <img :src="useSanityImageUrl(section.image, 1920, 1080)" :alt="l(section.title)" class="w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/40" />
        </div>
        <div class="container-custom relative z-10 py-20">
          <div class="max-w-2xl">
            <h1 v-if="l(section.title)" class="font-display text-4xl md:text-5xl font-bold text-white mb-4">{{ l(section.title) }}</h1>
            <p v-if="l(section.subtitle)" class="text-accent text-xl md:text-2xl font-display font-bold mb-4">{{ l(section.subtitle) }}</p>
            <p v-if="l(section.description)" class="text-text-secondary text-lg mb-8">{{ l(section.description) }}</p>
            <NuxtLink v-if="section.ctaLink" :to="localePath(section.ctaLink)" class="btn-primary text-lg px-8 py-4 inline-block">
              {{ l(section.ctaText) || $t('common.see_more') }}
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Featured Products -->
      <section v-else-if="section._type === 'featuredProducts'" class="py-16 bg-dark-secondary">
        <div class="container-custom">
          <h2 v-if="l(section.title)" class="section-title text-center mb-10">{{ l(section.title) }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NuxtLink v-for="p in section.products" :key="p._id" :to="localePath(`/produits/${p.slug?.current}`)">
              <ProductCard :product="p" />
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Text Block -->
      <section v-else-if="section._type === 'textBlock'" class="py-16 bg-primary">
        <div class="container-custom max-w-3xl">
          <h2 v-if="l(section.title)" class="section-title text-center mb-8">{{ l(section.title) }}</h2>
          <div class="text-text-secondary leading-relaxed whitespace-pre-line text-center">{{ l(section.content) }}</div>
        </div>
      </section>

      <!-- CTA Block -->
      <section v-else-if="section._type === 'ctaBlock'" class="py-16 bg-dark-secondary">
        <div class="container-custom text-center">
          <h2 v-if="l(section.title)" class="section-title mb-4">{{ l(section.title) }}</h2>
          <p v-if="l(section.description)" class="text-text-secondary text-lg mb-8 max-w-xl mx-auto">{{ l(section.description) }}</p>
          <NuxtLink v-if="section.buttonLink" :to="localePath(section.buttonLink)" class="btn-primary text-lg px-8 py-4 inline-block">
            {{ l(section.buttonText) || $t('common.see_more') }}
          </NuxtLink>
        </div>
      </section>

      <!-- Testimonials -->
      <section v-else-if="section._type === 'testimonialBlock'" class="py-16 bg-primary">
        <div class="container-custom">
          <h2 v-if="l(section.title)" class="section-title text-center mb-10">{{ l(section.title) }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div v-for="t in section.testimonials" :key="t._id" class="card p-6">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Icon name="ph:user" class="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p class="text-white font-medium text-sm">{{ t.customerName }}</p>
                  <div class="flex gap-0.5">
                    <Icon v-for="s in 5" :key="s" name="ph:star-fill" class="w-3 h-3" :class="s <= (t.rating || 5) ? 'text-gold' : 'text-dark-tertiary'" />
                  </div>
                </div>
              </div>
              <p class="text-text-secondary text-sm">{{ l(t.text) }}</p>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>

  <div v-else class="container-custom py-20 text-center">
    <Icon name="ph:spinner" class="w-8 h-8 text-accent animate-spin mx-auto" />
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const l = useLocalizedField()
const route = useRoute()

const slug = computed(() => route.params.slug as string)

const { data: page, status } = useSanityFetch(
  () => `landing-${slug.value}`,
  groq`*[_type == "landingPage" && slug.current == $slug && isPublished == true][0] {
    title, slug, seo,
    sections[] {
      _type, _key, title, subtitle, description, content, image, ctaText, ctaLink,
      buttonText, buttonLink,
      products[]->{ _id, name, slug, price, color, colorHex, stock, "images": images[]{asset} },
      testimonials[]->{ _id, customerName, rating, text }
    }
  }`,
  { slug }
)

if (import.meta.server && status.value === 'success' && !page.value) {
  throw createError({ statusCode: 404, message: 'Page not found' })
}
if (import.meta.client) {
  watch([status, page], () => {
    if (status.value === 'success' && !page.value) showError({ statusCode: 404 })
  })
}

useHead({
  title: computed(() => page.value?.seo?.title || (page.value ? `${l(page.value.title)} — Vitesse Eco` : 'Vitesse Eco')),
  meta: computed(() => page.value?.seo?.description ? [{ name: 'description', content: page.value.seo.description }] : []),
})
</script>
