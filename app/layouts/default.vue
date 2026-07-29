<script setup lang="ts">
/**
 * The default layout. Header and footer arrive with the storefront section;
 * for now it establishes the landmark structure that every page sits inside,
 * so assistive technology has something to navigate from the first commit.
 */
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <main id="main" class="flex-1">
      <slot />
    </main>
  </div>
</template>
