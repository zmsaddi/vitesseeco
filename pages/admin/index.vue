<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

// v1: orders are the only section — land straight on them.
await navigateTo('/admin/commandes', { replace: true })
</script>
