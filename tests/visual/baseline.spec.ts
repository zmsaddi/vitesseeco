/**
 * Visual regression baseline (P2-11).
 *
 * Lightweight screenshot diffing using only Playwright's built-in
 * toHaveScreenshot — no paid service.
 *
 * First run on each new branch: `npm run test:visual:update` (creates the
 * baseline snapshots). Subsequent runs compare against them and fail on
 * meaningful diffs.
 *
 * Coverage is intentionally narrow: 5 critical pages × 2 viewports = 10
 * baselines. Wide coverage is expensive in storage and slow in CI.
 *
 * Notes:
 *  - Animations are disabled to keep snapshots stable.
 *  - Dynamic content (products, prices, dates) is masked where it would
 *    produce daily noise.
 */
import { test, expect, devices } from '@playwright/test'

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'products', path: '/produits' },
  { name: 'cart-empty', path: '/panier' },
  { name: 'contact', path: '/contact' },
  { name: 'a-propos', path: '/a-propos' },
  // U-Q2: full-surface coverage
  { name: 'guide', path: '/guide' },
  { name: 'comparatif', path: '/comparatif' },
  { name: 'faq', path: '/faq' },
  { name: 'blog', path: '/blog' },
  { name: 'withdrawal', path: '/retractation' },
]

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'mobile', viewport: devices['iPhone 13'].viewport },
]

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test(`visual — ${p.name} — ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: vp.viewport })
      const page = await ctx.newPage()

      // Disable animations + reduce motion to stabilize screenshots
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            transition-duration: 0s !important;
          }
        `,
      })

      // Avoid networkidle — Turnstile/analytics/Sanity image CDN can keep the
      // network busy indefinitely. Wait for a stable element instead.
      await page.goto(p.path, { waitUntil: 'domcontentloaded' })
      await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 })

      // Mask dynamic regions to avoid noise (products, prices, dates)
      const masks = [
        page.locator('[data-dynamic]'),     // opt-in marker — components can add this attr
        page.locator('time'),                 // dates
        page.locator('img[src*="cdn.sanity"]'), // CMS images — change ordering
      ].filter((m) => m)

      await expect(page).toHaveScreenshot(`${p.name}-${vp.name}.png`, {
        fullPage: false, // viewport only — top-fold focus
        animations: 'disabled',
        mask: masks,
        maxDiffPixelRatio: 0.02,
      })

      await ctx.close()
    })
  }
}
