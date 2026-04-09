<template>
  <div>
    <!-- Table of Contents -->
    <nav v-if="sections?.length > 1" class="card p-4 mb-6">
      <h2 class="font-display font-semibold text-white text-sm mb-3">{{ $t('legal.toc') }}</h2>
      <ol class="space-y-1.5">
        <li v-for="(s, i) in sections" :key="i">
          <a :href="`#section-${i}`" class="text-text-secondary hover:text-accent transition-colors text-sm flex items-center gap-2">
            <span class="text-accent font-mono text-xs">{{ i + 1 }}.</span>
            {{ l(s.title) }}
          </a>
        </li>
      </ol>
    </nav>

    <!-- Sections -->
    <div class="card p-6 md:p-8 space-y-8">
      <section v-for="(s, i) in sections" :key="i" :id="`section-${i}`">
        <h2 class="font-display text-xl font-semibold text-white mb-3 flex items-center gap-2">
          <span class="text-accent font-mono text-sm">{{ i + 1 }}.</span>
          {{ l(s.title) }}
        </h2>
        <div class="text-text-secondary leading-relaxed whitespace-pre-line text-sm">{{ l(s.content) }}</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const l = useLocalizedField()
defineProps<{ sections: any[] }>()
</script>
