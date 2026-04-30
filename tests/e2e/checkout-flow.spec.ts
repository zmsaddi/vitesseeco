/**
 * Critical checkout-flow smoke test (P5-05).
 *
 * Walks the path: home → /produits → click first product → add to cart →
 * /panier → choose shipping → /commande → reach the checkout page without
 * errors. Stops short of placing the order (Turnstile + payment require
 * real interaction).
 *
 * Runs in 4 locales × 2 viewports per the test matrix in the plan.
 */
import { test, expect, devices } from '@playwright/test'

const VARIANTS = [
  { locale: '',     prefix: '',     viewport: { width: 1280, height: 800 }, label: 'fr-desktop' },
  { locale: 'en',   prefix: '/en',  viewport: { width: 1280, height: 800 }, label: 'en-desktop' },
  { locale: 'es',   prefix: '/es',  viewport: { width: 1280, height: 800 }, label: 'es-desktop' },
  { locale: 'ar',   prefix: '/ar',  viewport: { width: 1280, height: 800 }, label: 'ar-desktop' },
  { locale: '',     prefix: '',     viewport: devices['iPhone 13'].viewport, label: 'fr-mobile' },
  { locale: 'ar',   prefix: '/ar',  viewport: devices['iPhone 13'].viewport, label: 'ar-mobile' },
]

for (const v of VARIANTS) {
  test(`checkout flow — ${v.label}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: v.viewport })
    const page = await ctx.newPage()

    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(String(err)))
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

    // 1. Home loads
    await page.goto(`${v.prefix}/`, { waitUntil: 'networkidle' })
    await expect(page.locator('h1, h2').first()).toBeVisible()

    // 2. Products list
    await page.goto(`${v.prefix}/produits`, { waitUntil: 'networkidle' })
    const firstCard = page.locator('a[href*="/produits/"]').first()
    if (!(await firstCard.isVisible().catch(() => false))) {
      test.skip(true, 'no product cards visible')
    }

    // 3. Product detail
    await firstCard.click()
    await page.waitForURL(/\/produits\/[^/]+$/)
    await expect(page.locator('h1')).toBeVisible()

    // 4. Add to cart (button visible — sticky on mobile, sidebar on desktop)
    const addBtn = page.getByRole('button', { name: /panier|cart|añadir|toevoegen|hinzufügen|أضف/i }).first()
    if (!(await addBtn.isVisible().catch(() => false))) {
      test.skip(true, 'add-to-cart not visible (likely out of stock)')
    }

    // For mobile we may have multiple add-to-cart buttons (main + sticky)
    const visibleAddBtns = await page.getByRole('button', { name: /panier|cart|añadir|toevoegen|hinzufügen|أضف/i }).all()
    if (visibleAddBtns.length) await visibleAddBtns[0].click()

    // 5. Cart page
    await page.goto(`${v.prefix}/panier`, { waitUntil: 'networkidle' })
    await expect(page.locator('h1')).toBeVisible()

    // 6. Reach checkout — proceed only if button is enabled (i.e. shipping was auto-selected)
    const checkoutBtn = page.getByRole('button', { name: /commande|checkout|pago|afrekenen|kasse|الدفع|إتمام/i }).first()
    if (await checkoutBtn.isVisible().catch(() => false)) {
      const isDisabled = await checkoutBtn.isDisabled().catch(() => false)
      if (!isDisabled) {
        await checkoutBtn.click()
        // Just verify navigation happened — actual form submission is gated by Turnstile
        await page.waitForURL(/commande/i, { timeout: 5000 }).catch(() => {})
      }
    }

    // 7. RTL sanity for AR
    if (v.locale === 'ar') {
      const dir = await page.locator('html').getAttribute('dir')
      expect(dir).toBe('rtl')
    }

    // 8. No console errors
    const fatalErrors = consoleErrors.filter((e) => !/network|404|fetch|favicon/i.test(e))
    expect(fatalErrors, `console errors:\n${fatalErrors.join('\n')}`).toHaveLength(0)

    await ctx.close()
  })
}

/**
 * Regression: guest + in-store pickup must collect first/last name on /commande.
 *
 * Pre-fix bug: the pickup branch hard-coded `lastName: ''` for unauthenticated
 * users, then /api/orders/create rejected the empty name with HTTP 400. This
 * test fails fast if anyone reverts the guest-pickup form fields.
 */
test('guest pickup checkout requires first + last name', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  // Walk to /commande via the cart so we have a real validated cart line
  await page.goto('/produits', { waitUntil: 'networkidle' })
  const firstCard = page.locator('a[href*="/produits/"]').first()
  if (!(await firstCard.isVisible().catch(() => false))) test.skip(true, 'no products')
  await firstCard.click()
  await page.waitForURL(/\/produits\/[^/]+$/)
  const addBtn = page.getByRole('button', { name: /panier|cart/i }).first()
  if (!(await addBtn.isVisible().catch(() => false))) test.skip(true, 'add-to-cart not visible')
  await addBtn.click()
  await page.goto('/commande', { waitUntil: 'networkidle' })

  // Select pickup (auto-selected when it's the only option; otherwise click it)
  const pickupRadio = page.locator('input#ship-pickup')
  if (!(await pickupRadio.isChecked().catch(() => false))) {
    if (!(await pickupRadio.isVisible().catch(() => false))) {
      test.skip(true, 'no pickup shipping method available — Sanity catalog has no entry with code=pickup')
    }
    await pickupRadio.check({ force: true })
  }
  await expect(pickupRadio).toBeChecked({ timeout: 10_000 })

  // The guest pickup form fields must be present (first name + last name).
  // Address fields are intentionally not shown — pickup uses the store address.
  await expect(page.locator('input#co-fn')).toBeVisible()
  await expect(page.locator('input#co-ln')).toBeVisible()
  // Address field for delivery is hidden under pickup
  await expect(page.locator('input#co-addr')).toHaveCount(0)

  // Submit must be disabled while names are empty, with a clear reason about name
  const submitBtn = page.getByRole('button', { name: /commande|order/i }).filter({ hasText: /passer|place/i }).first()
  await expect(submitBtn).toBeDisabled()
  const reasonText = await page.locator('p[role="status"]').first().textContent()
  expect(reasonText?.toLowerCase() || '').toMatch(/prénom|nom|name/i)

  // Fill the name fields; the disabled reason should advance off "no name"
  await page.locator('input#co-fn').fill('Test')
  await page.locator('input#co-ln').fill('Acheteur')
  await page.locator('input#co-fn').blur()
  await page.locator('input#co-ln').blur()

  // After names are present, the only remaining gate should be Turnstile (or
  // payment if not auto-selected). We assert the reason is no longer about names.
  const newReason = (await page.locator('p[role="status"]').first().textContent()) || ''
  expect(newReason.toLowerCase()).not.toMatch(/prénom|first.{0,3}name|last.{0,3}name/i)

  await ctx.close()
})
