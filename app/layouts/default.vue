<script setup lang="ts">
/**
 * The default layout: header, content landmark, footer.
 */
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <SiteHeader />
    <main id="main" class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
