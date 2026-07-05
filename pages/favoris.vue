<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <div class="mb-6">
        <Breadcrumbs :items="[
          { label: $t('nav.home'), to: localePath('/') },
          { label: $t('wishlist.title') },
        ]" />
      </div>

      <h1 class="font-display text-2xl md:text-3xl font-black text-white mb-8">
        {{ $t('wishlist.title') }}
        <span v-if="items.length" class="text-text-secondary text-lg font-normal">({{ items.length }})</span>
      </h1>

      <ClientOnly>
        <div v-if="items.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div v-for="p in items" :key="p.id" class="card overflow-hidden group relative">
            <button
              type="button"
              class="absolute top-2 end-2 z-10 w-touch h-touch min-w-10 min-h-10 rounded-full bg-primary/70 backdrop-blur flex items-center justify-center text-accent hover:text-danger transition-colors"
              :aria-label="$t('wishlist.removed')"
              @click="removeWithToast(p)"
            >
              <Icon name="ph:heart-fill" class="w-5 h-5" />
            </button>
            <NuxtLink :to="localePath(`/produits/${p.slug}`)" class="block focus-ring">
              <div class="aspect-square bg-dark-tertiary overflow-hidden">
                <img
                  v-if="p.image"
                  :src="p.image"
                  :alt="p.name"
                  width="320" height="320" loading="lazy"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                >
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Icon name="ph:package" class="w-10 h-10 text-text-secondary" />
                </div>
              </div>
              <div class="p-3">
                <p class="text-white text-sm font-medium truncate group-hover:text-accent transition-colors">{{ p.name }}</p>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-accent font-bold">{{ p.price }}€</span>
                  <StockBadge :stock="p.stock" class="!text-xs" />
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <div v-else class="card">
          <EmptyState
            icon="ph:heart"
            :message="$t('wishlist.empty')"
            :cta-to="localePath('/produits')"
            :cta-label="$t('cart.empty_cta')"
            cta-icon="ph:arrow-right"
          />
        </div>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const { items, load, remove } = useWishlist()

onMounted(load)

useHead({
  title: computed(() => `${t('wishlist.title')} — Vitesse Eco`),
  meta: [{ name: 'robots', content: 'noindex' }],
})

function removeWithToast(p: any) {
  remove(p.id)
  toast.info(t('wishlist.removed'))
}
</script>
