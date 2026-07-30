/**
 * Register the service worker.
 *
 * public/sw.js and offline.html have shipped in every build, and nothing ever
 * called navigator.serviceWorker.register — so the site was installable in
 * theory and worked offline in none. This is the line that makes them real.
 *
 * Registration waits for the load event on purpose: doing it during hydration
 * makes the browser fetch and parse the worker while it is still painting the
 * page a customer is looking at, and the worker has nothing to do until the
 * second visit anyway.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return

  // A worker registered on a preview or a local build would cache that origin's
  // assets under the same scope, which is confusing to debug and useless to the
  // shop. Only the real site gets one.
  if (!window.isSecureContext) return

  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      // A failed registration must never be fatal: the site works without it.
      console.warn('[pwa] service worker registration failed', error)
    })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
})
