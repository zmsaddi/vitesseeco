/**
 * U-Q2 — Locale × viewport matrix.
 *
 * Every market locale (fr default-prefix-less, nl, de, es) is exercised on
 * desktop and mobile against the pages that earn the money and the pages
 * the law requires. Checks are deliberately shallow (page renders, correct
 * <html lang>, chrome visible) — deep flows live in checkout-flow.spec.ts;
 * this matrix exists to catch "locale X broke" and "mobile layout broke"
 * regressions cheaply across the whole surface.
 */
import { test, expect, devices } from '@playwright/test'

const LOCALES = [
  { code: 'fr', prefix: '' },
  { code: 'nl', prefix: '/nl' },
  { code: 'de', prefix: '/de' },
  { code: 'es', prefix: '/es' },
]

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'mobile', viewport: devices['iPhone 13'].viewport },
]

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'products', path: '/produits' },
  { name: 'guide', path: '/guide' },
  { name: 'comparatif', path: '/comparatif' },
  { name: 'faq', path: '/faq' },
  { name: 'contact', path: '/contact' },
  { name: 'withdrawal', path: '/retractation' },
]

for (const vp of VIEWPORTS) {
  for (const loc of LOCALES) {
    test.describe(`${loc.code} — ${vp.name}`, () => {
      test.use({ viewport: vp.viewport })

      for (const p of PAGES) {
        test(`${p.name} renders`, async ({ page }) => {
          const url = `${loc.prefix}${p.path}` || '/'
          const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
          expect(response?.status()).toBeLessThan(400)

          // i18n actually applied, not just routed
          await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${loc.code}`))

          await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 })
          await expect(page.locator('header')).toBeVisible()
          await expect(page.locator('footer')).toBeVisible()
        })
      }

      test('hreflang alternates present on home', async ({ page }) => {
        await page.goto(loc.prefix || '/', { waitUntil: 'domcontentloaded' })
        const alternates = page.locator('link[rel="alternate"][hreflang]')
        // 6 locales + fr-BE + nl-BE + x-default
        expect(await alternates.count()).toBeGreaterThanOrEqual(6)
      })
    })
  }
}

// Mobile-only chrome: the burger menu and always-visible search bar are the
// two things a phone shopper cannot live without.
test.describe('mobile chrome', () => {
  test.use({ viewport: devices['iPhone 13'].viewport })

  test('menu button and search visible on mobile home', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    // The language switcher also carries aria-expanded — target the burger
    // (the only md:hidden disclosure button) to stay strict-mode safe.
    await expect(page.locator('header button[class*="md:hidden"][aria-expanded]')).toBeVisible()
    // Two SearchBar instances render (desktop row, hidden on phones, comes
    // first in the DOM) — assert the mobile row's own instance.
    await expect(page.locator('header div[class*="md:hidden"] input[type="search"]')).toBeVisible()
  })
})
