<template>
  <div class="min-h-screen bg-primary flex items-center justify-center">
    <div class="text-center px-4">
      <h1 class="font-display text-8xl font-bold text-accent mb-4">{{ error?.statusCode || 500 }}</h1>
      <p class="text-white text-2xl font-display font-semibold mb-2">
        {{ error?.statusCode === 404 ? $t('error_page.not_found') : $t('error_page.server_error') }}
      </p>
      <p class="text-text-secondary mb-8 max-w-md mx-auto">
        {{ error?.statusCode === 404 ? $t('error_page.not_found_desc') : $t('error_page.server_error_desc') }}
      </p>
      <div class="flex gap-4 justify-center">
        <button @click="handleError" class="btn-primary">
          {{ $t('error_page.back_home') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; message: string } }>()

function handleError() {
  clearError({ redirect: '/' })
}
</script>
