/**
 * U-M4 — Vitesse Eco service worker (hand-rolled, no build step).
 *
 * Deliberately conservative for an e-commerce site:
 *  - NEVER touches /api, auth/account/checkout/cart pages, or non-GET.
 *  - Navigations: network-first, offline.html fallback. HTML is never
 *    cached (prices/stock must stay live).
 *  - /_nuxt/ hashed assets: cache-first (immutable by construction).
 *  - Images (same-origin + cdn.sanity.io): stale-while-revalidate, capped.
 *
 * Bump VERSION to invalidate all caches on deploy of this file.
 */
const VERSION = 'v1'
const STATIC_CACHE = `ve-static-${VERSION}`
const IMG_CACHE = `ve-img-${VERSION}`
const OFFLINE_URL = '/offline.html'
const IMG_CACHE_MAX = 120

// Private/dynamic areas the SW must never intercept (any locale prefix).
const PRIVATE = /^\/(?:en|es|nl|de|ar)?\/?(?:api|admin|compte|commande|panier|connexion|inscription)(?:\/|$)/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, '/logo.webp'])).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== IMG_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length > max) await cache.delete(keys[0])
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  const sameOrigin = url.origin === self.location.origin
  const isSanityImg = url.hostname === 'cdn.sanity.io'
  if (!sameOrigin && !isSanityImg) return
  if (sameOrigin && PRIVATE.test(url.pathname)) return

  // Navigations: live network, offline page only when the network is gone.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // Hashed build assets: immutable → cache-first.
  if (sameOrigin && url.pathname.startsWith('/_nuxt/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      })
    )
    return
  }

  // Images: stale-while-revalidate with a size cap.
  const isImage = req.destination === 'image' || isSanityImg
  if (isImage) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok) {
              cache.put(req, res.clone())
              trimCache(IMG_CACHE, IMG_CACHE_MAX)
            }
            return res
          })
          .catch(() => hit)
        return hit || refresh
      })
    )
  }
})
