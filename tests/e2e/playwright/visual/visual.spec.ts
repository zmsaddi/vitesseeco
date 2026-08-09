/**
 * Visual regression — the small set of screens whose paint sells the shop.
 *
 * Determinism before breadth: fixture catalogue, locally-served images (the
 * cdn.sanity.io route is fulfilled from a committed PNG), reduced motion,
 * device-pixel-ratio 1, fonts awaited, animations disabled by the global
 * toHaveScreenshot config. The one mask is the Turnstile iframe on checkout —
 * a third-party widget whose paint this repository does not own.
 *
 * Baselines are committed for Linux only (the CI runner); generate them with
 * `npm run test:visual:update` on a Linux-compatible environment. CI never
 * updates a snapshot — it compares, fails, and uploads the diff
 * (docs/testing/BROWSER_GATES.md documents the update procedure).
 */
import { test, expect } from '../helpers/test'
import { displayProduct } from '../helpers/catalogue'

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1366, height: 768 }

async function settle(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

interface Shot {
  name: string
  path: string
  viewport: { width: number; height: number }
  ready?: string
  cart?: boolean
  mask?: string[]
}

const SHOTS: Shot[] = [
  { name: 'home-mobile', path: '/', viewport: MOBILE },
  { name: 'listing-mobile', path: '/produits', viewport: MOBILE },
  { name: 'pdp-mobile', path: `/produits/${displayProduct.slug}`, viewport: MOBILE },
  {
    name: 'cart-mobile',
    path: '/panier',
    viewport: MOBILE,
    ready: 'li input[type="number"]',
    cart: true,
  },
  {
    name: 'checkout-mobile',
    path: '/commande',
    viewport: MOBILE,
    ready: 'input[autocomplete="postal-code"]',
    cart: true,
    // The Turnstile widget is third-party paint with its own animation cycle.
    mask: ['iframe[src*="challenges.cloudflare.com"]'],
  },
  { name: 'home-desktop', path: '/', viewport: DESKTOP },
  { name: 'pdp-desktop', path: `/produits/${displayProduct.slug}`, viewport: DESKTOP },
  { name: 'pdp-mobile-ar', path: `/ar/produits/${displayProduct.slug}`, viewport: MOBILE },
]

for (const shot of SHOTS) {
  test(shot.name, async ({ page, seedCart }) => {
    if (shot.cart) await seedCart([{ productId: displayProduct._id, quantity: 1 }])
    await page.setViewportSize(shot.viewport)
    await page.goto(shot.path)
    if (shot.ready) await page.locator(shot.ready).first().waitFor()
    await settle(page)

    await expect(page).toHaveScreenshot(`${shot.name}.png`, {
      fullPage: true,
      mask: (shot.mask ?? []).map((selector) => page.locator(selector)),
    })
  })
}
