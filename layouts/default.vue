<template>
  <div class="min-h-screen bg-primary text-white font-sans flex flex-col">
    <AppHeader />
    <main class="flex-1">
      <transition name="page" mode="out-in">
        <slot />
      </transition>
    </main>
    <AppFooter />
    <ClientOnly>
      <CartDrawer />
      <CookieConsent />
    </ClientOnly>
  </div>
</template>
