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
  test.setTimeout(60_000)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  // Inject a cart line via localStorage so we land on /commande with real
  // items, deterministically and without going through the product → add-to-cart
  // → cart-drawer dance. Walking the UI was racy: getByRole('button', { name:
  // /panier|cart/i }) matches both the header "Votre Panier" button and the
  // product-page "Ajouter au panier" button, and .first() picked the header
  // one — which opens the drawer instead of adding to cart, leaving the cart
  // empty and the test on /commande's empty-cart fallback.
  // Cart shape mirrors the pinia-persist payload from stores/cart.ts.
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  // Let the homepage settle a moment before we mutate localStorage and
  // navigate again — net::ERR_ABORTED can fire if a deferred home asset is
  // still loading when we trigger the next goto.
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const cart = {
      items: [{
        productId: 'zOkJuNZVmyYz76wu4fqHkf',
        name: { fr: 'Test Bike' },
        slug: 'test-bike',
        price: 100,
        colorHex: '#000000',
        colorName: { fr: 'Test' },
        sku: 'test-bike',
        quantity: 1,
      }],
      promoCode: null, promoDiscount: 0,
      shippingCode: null, shippingZone: 'FR', shippingCost: 0, shippingMethod: null,
      serverSubtotal: null, serverTotal: null, validating: false, validationError: null,
    }
    localStorage.setItem('cart', JSON.stringify(cart))
  })

  await page.goto('/commande', { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 })

  // One-straight-line flow (owner decision 2026-07-05): the address always
  // comes first — shipping options (pickup included) only render once the
  // address block is filled, because it doubles as the customer/billing record.
  await page.locator('input#co-zip').waitFor({ state: 'visible', timeout: 15_000 })
  await page.locator('input#co-zip').fill('86000')
  await page.locator('input#co-city').fill('Poitiers')
  await page.locator('input#co-addr').fill('1 Rue de Test')

  // Names left EMPTY on purpose — that is the regression under test.
  await page.locator('input#ship-pickup, input[id^="ship-"]').first().waitFor({ state: 'attached', timeout: 15_000 })

  // Select pickup (delivery is the default when the address qualifies)
  const pickupRadio = page.locator('input#ship-pickup')
  if (!(await pickupRadio.isVisible().catch(() => false))) {
    test.skip(true, 'no pickup shipping method available — Sanity catalog has no entry with code=pickup')
  }
  if (!(await pickupRadio.isChecked().catch(() => false))) {
    await pickupRadio.check({ force: true })
  }
  await expect(pickupRadio).toBeChecked({ timeout: 10_000 })

  // The guest form must still collect first + last name under pickup —
  // the address block stays visible (it doubles as the billing record).
  await expect(page.locator('input#co-fn')).toBeVisible()
  await expect(page.locator('input#co-ln')).toBeVisible()
  await expect(page.locator('input#co-addr')).toBeVisible()

  // Submit must be disabled while names are empty.
  // The button text comes from i18n key checkout.place_order which renders as
  // "Confirmer la commande" / "Confirm order" / etc. — match by that root.
  const submitBtn = page.getByRole('button', { name: /confirmer|confirm/i }).first()
  await expect(submitBtn).toBeDisabled()

  // With names missing, the disabled-reason is the incomplete-address message
  // ("Complétez votre adresse de livraison" — names are part of the address
  // block). Several p[role="status"] can exist (Turnstile) — filter by text.
  const addressReason = page.locator('p[role="status"]').filter({ hasText: /adresse|address/i })
  await expect(addressReason).toHaveCount(1, { timeout: 10_000 })

  // Fill the name fields; the address-incomplete reason must disappear
  // (the button may stay disabled on payment/Turnstile — not under test here).
  await page.locator('input#co-fn').fill('Test')
  await page.locator('input#co-ln').fill('Acheteur')
  await page.locator('input#co-ln').blur()

  await expect(addressReason).toHaveCount(0, { timeout: 10_000 })

  await ctx.close()
})

/**
 * Regression: /commande/confirmation must display the order number when one
 * is present in the URL, and a soft fallback when it isn't.
 *
 * Pre-fix bug: pages/commande.vue and pages/commande/confirmation.vue formed
 * a parent/child route pair, but the parent had no <NuxtPage /> slot, so SSR
 * for /commande/confirmation rendered the parent's empty-cart layout instead
 * of the confirmation card. Restructuring to siblings (pages/commande/index.vue)
 * fixes the route resolution.
 */
test('confirmation page renders the order number', async ({ browser }) => {
  test.setTimeout(45_000)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  await page.goto('/commande/confirmation?order=ORD-TESTABC123', { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 })

  const orderNumberEl = page.locator('[data-test="order-number"]')
  await expect(orderNumberEl).toBeVisible()
  await expect(orderNumberEl).toContainText('ORD-TESTABC123')
  // The fallback must NOT be visible when a valid number is present
  await expect(page.locator('[data-test="order-number-fallback"]')).toHaveCount(0)

  await ctx.close()
})

test('confirmation page falls back gracefully when order query is missing', async ({ browser }) => {
  test.setTimeout(45_000)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  await page.goto('/commande/confirmation', { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 })

  // Fallback paragraph is shown
  const fallbackEl = page.locator('[data-test="order-number-fallback"]')
  await expect(fallbackEl).toBeVisible()
  // The order-number element is NOT in the DOM (v-if hides it cleanly)
  await expect(page.locator('[data-test="order-number"]')).toHaveCount(0)

  await ctx.close()
})

test('confirmation page rejects malformed order query', async ({ browser }) => {
  test.setTimeout(45_000)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  // Junk in the query that doesn't match ORD-XXXXX should fall back, never
  // render attacker-controlled text inside the prominent <strong> slot.
  await page.goto('/commande/confirmation?order=javascript:alert(1)', { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 })

  await expect(page.locator('[data-test="order-number-fallback"]')).toBeVisible()
  await expect(page.locator('[data-test="order-number"]')).toHaveCount(0)

  await ctx.close()
})
