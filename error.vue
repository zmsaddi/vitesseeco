<template>
  <div class="min-h-screen bg-primary flex items-center justify-center">
    <div class="text-center px-4">
      <h1 class="font-display text-8xl font-bold text-accent mb-4">{{ error?.statusCode || 500 }}</h1>
      <p class="text-white text-2xl font-display font-semibold mb-2">
        {{ error?.statusCode === 404 ? 'Page non trouvée' : 'Erreur serveur' }}
      </p>
      <p class="text-text-secondary mb-8 max-w-md mx-auto">
        {{ error?.statusCode === 404
          ? 'La page que vous recherchez n\'existe pas ou a été déplacée.'
          : 'Une erreur est survenue. Veuillez réessayer.' }}
      </p>
      <div class="flex gap-4 justify-center">
        <button @click="handleError" class="btn-primary">
          Retour à l'accueil
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
