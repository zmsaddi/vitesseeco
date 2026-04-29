/**
 * Scroll-reveal directive (P3 follow-up).
 *
 * Adds `is-visible` class to any element with `[data-reveal]` once it
 * enters the viewport. Lightweight — no library, single shared
 * IntersectionObserver instance for the whole app.
 *
 * Usage in templates:
 *   <div data-reveal>...</div>
 *   <div data-reveal data-reveal-delay="2">...</div>
 *
 * Reduced-motion users see the content immediately (CSS in main.css
 * disables the transition under prefers-reduced-motion: reduce).
 */
export default defineNuxtPlugin(() => {
  if (typeof IntersectionObserver === 'undefined') return

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target) // one-shot — never re-hide
        }
      }
    },
    { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
  )

  function scan(root: ParentNode = document) {
    const elements = root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)')
    elements.forEach((el) => observer.observe(el))
  }

  // Initial scan on mount
  if (document.readyState !== 'loading') {
    scan()
  } else {
    document.addEventListener('DOMContentLoaded', () => scan(), { once: true })
  }

  // Re-scan after every Nuxt page navigation so newly-rendered elements get
  // observed too. Uses page:finish hook (fires after suspense resolves).
  const nuxtApp = useNuxtApp()
  nuxtApp.hook('page:finish', () => {
    // give Vue a tick to flush the new DOM, then scan
    setTimeout(() => scan(), 50)
  })

  // Also re-scan on dynamically loaded content (Sanity fetches resolving
  // after the initial mount). MutationObserver picks up nodes appearing
  // anywhere in the body.
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) scan(node as ParentNode)
      })
    }
  })
  mo.observe(document.body, { childList: true, subtree: true })
})
