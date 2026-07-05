/**
 * U-M4 — register the service worker (public/sw.js) after hydration.
 * Skipped in dev: a SW caching dev assets makes local debugging miserable.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.dev) return
  nuxtApp.hook('app:mounted', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failure (old browser, private mode) is non-fatal.
      })
    }
  })
})
