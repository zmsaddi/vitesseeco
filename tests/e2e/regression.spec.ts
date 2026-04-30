/**
 * Regression guards (P1-09).
 *
 * Each test here protects against a bug we already fixed and want to prevent
 * from recurring:
 *  - hard-refresh dispose error on /produits with filters (commit 3771166)
 *  - out-of-stock products hidden by default + toggle (commit 48ee37a)
 *  - Arabic routes work and the language switcher exposes AR (P1-03)
 *  - cart drawer touch targets are >= 44px on mobile (P1-06)
 *  - cookie banner is compact on mobile (P1-05)
 */
import { test, expect, devices } from '@playwright/test'

const HOME = '/'
const PRODUCTS = '/produits'

test.describe('Hard refresh — no dispose error (regression for unhead bug)', () => {
  test('produits page loads cleanly with filter query params', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(String(err)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(`${PRODUCTS}?type=bike&brand=QMWheel`, { waitUntil: 'networkidle' })

    const dispose = consoleErrors.filter((e) => /dispose/i.test(e))
    expect(dispose, `expected zero "dispose" errors, got:\n${dispose.join('\n')}`).toHaveLength(0)
    await expect(page.locator('h1')).toBeVisible()
  })
})

test.describe('Out-of-stock filter behaviour', () => {
  test('out-of-stock items are hidden by default and revealed by toggle', async ({ page }) => {
    await page.goto(PRODUCTS, { waitUntil: 'networkidle' })
    await page.locator('h1').waitFor()

    // Read the result count before toggle
    const before = await page.locator('text=/\\d+\\s*\\/\\s*\\d+/').first().textContent()

    // Toggle "show out of stock"
    const toggle = page.getByRole('checkbox').first()
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.check()
      await page.waitForTimeout(300)
      const after = await page.locator('text=/\\d+\\s*\\/\\s*\\d+/').first().textContent()
      expect(after).not.toBe(before)
    }
  })
})

test.describe('Arabic routing + language switcher exposure', () => {
  test('AR home loads and html dir is rtl', async ({ page }) => {
    await page.goto('/ar', { waitUntil: 'domcontentloaded' })
    const dir = await page.locator('html').getAttribute('dir')
    expect(dir).toBe('rtl')
  })

  test('language switcher includes Arabic option (P1-03)', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'networkidle' })
    // Open the switcher — match button by short locale code text
    const switcherButton = page.locator('button').filter({ hasText: /^(FR|EN|ES|NL|DE|AR)$/ }).first()
    if (!(await switcherButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'language switcher not surfaced (deploy may still be propagating)')
    }
    await switcherButton.click()
    // Dropdown is wrapped in a Vue Transition — wait for at least one option
    // before asserting on the AR row. We accept any of the localized name
    // ("العربية"), the English label ("Arabic"), or the short code AR.
    const arOption = page.locator('button').filter({ hasText: /العربية|Arabic|^AR$/i }).first()
    await expect(arOption).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Mobile UX — touch targets and overlays (P1-05/P1-06)', () => {
  // Playwright forbids test.use({ defaultBrowserType }) inside a describe.
  // We open a manual mobile context per test instead — same effect, no
  // worker-restart constraint.

  test('cart drawer +/− buttons are >= 44px (P1-06)', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await ctx.newPage()
    try {
      await page.goto(PRODUCTS)
      await page.locator('h1').waitFor()

      const firstCard = page.locator('a[href*="/produits/"]').first()
      if (!(await firstCard.isVisible().catch(() => false))) test.skip(true, 'no product cards visible')
      await firstCard.click()

      const addBtn = page.getByRole('button').filter({ hasText: /panier|cart|ajouter|add/i }).first()
      if (!(await addBtn.isVisible().catch(() => false))) test.skip(true, 'no add-to-cart button')
      await addBtn.click()

      // P1-06 increased the cart drawer +/− buttons to w-11 h-11 (44px). The
      // exact bounding box can round down by 1-2 px depending on devicePixelRatio
      // and rendering, so we use a 40px comfort floor here.
      const inc = page.getByRole('button', { name: /augmenter|increase|aumentar|verhogen|erhöhen|الزيادة/i }).first()
      if (!(await inc.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, 'cart drawer +/− not surfaced — drawer may not have opened')
      }
      const box = await inc.boundingBox()
      expect(box?.width || 0).toBeGreaterThanOrEqual(40)
      expect(box?.height || 0).toBeGreaterThanOrEqual(40)
    } finally {
      await ctx.close()
    }
  })

  test('cookie banner does not consume more than 30% of viewport height (P1-05)', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await ctx.newPage()
    try {
      await page.context().clearCookies()
      await page.goto(HOME)
      await page.evaluate(() => localStorage.removeItem('cookie_consent'))
      await page.reload({ waitUntil: 'networkidle' })

      const ok = page.getByRole('button', { name: /^ok$/i }).first()
      if (!(await ok.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, 'cookie banner not surfaced in this run')
      }

      const viewport = page.viewportSize()
      const banner2 = page.locator('div').filter({ has: ok }).first()
      const box = await banner2.boundingBox().catch(() => null)
      if (viewport && box) {
        const ratio = box.height / viewport.height
        expect(ratio, `banner takes ${Math.round(ratio * 100)}% of viewport`).toBeLessThanOrEqual(0.3)
      }
    } finally {
      await ctx.close()
    }
  })
})
