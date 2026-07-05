<template>
  <section v-if="visible.length" class="py-10">
    <div class="container-custom">
      <h2 class="font-display text-lg font-semibold text-white mb-4">{{ $t('product.recently_viewed') }}</h2>
      <div class="flex gap-4 overflow-x-auto pb-2 snap-x" style="scrollbar-width: thin;">
        <NuxtLink
          v-for="p in visible"
          :key="p.id"
          :to="localePath(`/produits/${p.slug}`)"
          class="card shrink-0 w-40 snap-start overflow-hidden group focus-ring"
        >
          <div class="aspect-square bg-dark-tertiary overflow-hidden">
            <img
              v-if="p.image"
              :src="p.image"
              :alt="p.name"
              width="160" height="160" loading="lazy"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            >
            <div v-else class="w-full h-full flex items-center justify-center">
              <Icon name="ph:package" class="w-8 h-8 text-text-secondary" />
            </div>
          </div>
          <div class="p-3">
            <p class="text-white text-xs font-medium truncate group-hover:text-accent transition-colors">{{ p.name }}</p>
            <p class="text-accent font-bold text-sm mt-0.5">{{ p.price }}€</p>
          </div>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ excludeSlug?: string }>(), { excludeSlug: '' })

const localePath = useLocalePath()
const { items, load } = useRecentlyViewed()

onMounted(load)

const visible = computed(() => items.value.filter((p) => p.slug !== props.excludeSlug))
</script>
