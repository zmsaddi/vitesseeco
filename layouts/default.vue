<template>
  <div class="min-h-screen bg-primary text-white font-sans flex flex-col">
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <CartDrawer />
  </div>
</template>
