/**
 * Reflow: no route on the purchase path may scroll the document sideways.
 *
 * 320 CSS pixels is the WCAG 1.4.10 floor and the width where this shop has
 * already shipped an overflow once (the pre-rebuild header measured 342px).
 * The contract is byte-simple: documentElement.scrollWidth never exceeds the
 * viewport, in French and in Arabic, with a full basket where that applies.
 */
import { test, expect } from '../helpers/test'
import { displayProduct } from '../helpers/catalogue'

const WIDTHS = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
]

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'listing', path: '/produits' },
  { name: 'product', path: `/produits/${displayProduct.slug}` },
  { name: 'cart', path: '/panier', ready: 'li input[type="number"]', cart: true },
  { name: 'checkout', path: '/commande', ready: 'input[autocomplete="postal-code"]', cart: true },
]

const LOCALES = [
  { prefix: '', label: 'fr' },
  { prefix: '/ar', label: 'ar' },
]

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      test(`${route.name} ${locale.label} does not overflow at ${viewport.width}px`, async ({
        page,
        seedCart,
      }) => {
        if (route.cart) await seedCart([{ productId: displayProduct._id, quantity: 1 }])
        await page.setViewportSize(viewport)
        await page.goto(`${locale.prefix}${route.path}`)
        if (route.ready) await page.locator(route.ready).first().waitFor()

        const overflow = await page.evaluate(() => {
          const root = document.documentElement
          if (root.scrollWidth <= root.clientWidth) return null
          // Name the widest offender so a failure reads as a diagnosis.
          let culprit = ''
          let widest = 0
          for (const element of document.querySelectorAll('body *')) {
            const rect = element.getBoundingClientRect()
            if (rect.right > widest) {
              widest = rect.right
              culprit = `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 80)}`
            }
          }
          return {
            scrollWidth: root.scrollWidth,
            clientWidth: root.clientWidth,
            culprit,
          }
        })
        expect(overflow, 'document scrolls horizontally').toBeNull()
      })
    }
  }
}
