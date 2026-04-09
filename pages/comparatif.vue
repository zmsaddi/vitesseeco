<template>
  <div class="py-8 md:py-12">
    <div class="container-custom">
      <div class="text-center mb-10">
        <h1 class="section-title mb-4">{{ $t('compare.title') }}</h1>
        <p class="text-text-secondary text-lg max-w-2xl mx-auto">{{ $t('compare.subtitle') }}</p>
      </div>

      <div v-if="products?.length" class="overflow-x-auto">
        <table class="w-full text-sm min-w-[800px]">
          <thead>
            <tr class="border-b-2 border-accent/30">
              <th class="text-left text-white p-3 font-display font-semibold sticky left-0 bg-primary z-10">{{ $t('guide.model') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('guide.price') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.tire_size') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.battery') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.range') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.motor') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.brake_type') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('product.weight') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('compare.colors') }}</th>
              <th class="text-center text-text-secondary p-3 font-medium">{{ $t('compare.stock') }}</th>
              <th class="p-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p._id" class="border-b border-dark-tertiary/50 hover:bg-dark-secondary/30 transition-colors">
              <td class="p-3 sticky left-0 bg-primary z-10">
                <NuxtLink :to="localePath(`/produits/${p.slug?.current}`)" class="text-accent hover:underline font-display font-semibold">
                  {{ l(p.name) }}
                </NuxtLink>
                <p class="text-text-secondary text-xs mt-0.5">{{ l(p.shortDescription) }}</p>
              </td>
              <td class="text-center p-3">
                <span class="text-white font-bold">{{ p.price }}€</span>
                <span v-if="p.compareAtPrice" class="block text-text-secondary line-through text-xs">{{ p.compareAtPrice }}€</span>
              </td>
              <td class="text-center text-text-secondary p-3">{{ p.specifications?.tireSize || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ p.specifications?.battery || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ sv(p.specifications?.range) || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ p.specifications?.motor || '250W' }}</td>
              <td class="text-center text-text-secondary p-3">{{ sv(p.specifications?.brakeType) || '—' }}</td>
              <td class="text-center text-text-secondary p-3">{{ p.specifications?.weight ? p.specifications.weight + ' kg' : '—' }}</td>
              <td class="text-center p-3">
                <div class="flex justify-center gap-1">
                  <span v-for="v in (p.variants || []).slice(0, 5)" :key="v._key" class="w-5 h-5 rounded-full border border-dark-tertiary" :style="{ backgroundColor: v.colorHex }" :title="l(v.colorName)" />
                </div>
              </td>
              <td class="text-center p-3">
                <span v-if="totalStock(p) > 5" class="text-accent text-xs">✅ {{ $t('product.in_stock') }}</span>
                <span v-else-if="totalStock(p) > 0" class="text-gold text-xs">🟡 {{ totalStock(p) }}</span>
                <span v-else class="text-red-400 text-xs">❌</span>
              </td>
              <td class="p-3">
                <NuxtLink :to="localePath(`/produits/${p.slug?.current}`)" class="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                  {{ $t('common.see_more') }}
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Legend -->
      <div class="mt-8 text-center text-text-secondary text-xs">
        <p>{{ $t('compare.all_models') }}</p>
      </div>

      <!-- Guide CTA -->
      <div class="text-center mt-10">
        <NuxtLink :to="localePath('/guide')" class="btn-outline inline-flex items-center gap-2">
          <Icon name="ph:compass" class="w-5 h-5" />
          {{ $t('guide.title') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()

// Spec value: handle both string and localizedString
const sv = (v: any) => typeof v === 'object' && v !== null ? l(v) : v

useHead({
  title: `${t('compare.title')} — Vitesse Eco`,
  meta: [{ name: 'description', content: t('compare.subtitle') }],
})

const { data: products } = useSanityFetch(
  'all-products-compare',
  groq`*[_type == "product" && isAvailable == true] | order(sortOrder asc) {
    _id, name, slug, shortDescription, price, compareAtPrice, specifications,
    variants[]{ _key, colorHex, colorName, stock }
  }`
)

function totalStock(p: any) {
  return (p.variants || []).reduce((sum: number, v: any) => sum + (v.stock || 0), 0)
}
</script>
