/**
 * The storefront journey, walked in a real browser against the candidate rig:
 * home → listing → product page → basket → repricing → checkout → confirmation.
 *
 * Money and stock are asserted where they live — in PostgreSQL, by
 * tests/e2e/money-path.mjs. This spec owns the other half of the contract: that
 * a customer at a screen can actually complete the journey, that every figure
 * shown on the way is the server's figure, and that the safe payment path
 * (cash on delivery — no Stripe, no live keys) carries through to a real
 * confirmation.
 *
 * This is the ONLY spec that orders fixture-bike-in-stock, so its exact stock
 * count is stable here and nowhere else asserted.
 */
import { test, expect, waitForHydration } from '../helpers/test'
import { displayDecimal, displayPrice, journeyProduct, onHand } from '../helpers/catalogue'

test('a guest walks from the homepage to a placed cash order', async ({ page }) => {
  // Turnstile needs a round trip to Cloudflare before the confirm button arms.
  test.setTimeout(180_000)

  const product = journeyProduct
  const name = product.name.fr
  const stock = onHand(product._id)

  await test.step('home', async () => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('link', { name: 'Voir les vélos' }).click()
    await expect(page).toHaveURL(/\/produits$/)
  })

  await test.step('listing shows the fixture product', async () => {
    await expect(page.getByRole('status')).toContainText('Résultats')
    await page.locator(`a[href$="/produits/${product.slug}"]`).first().click()
  })

  await test.step('product page states name, price and stock', async () => {
    // The listing link may have caused a full navigation (if clicked before
    // hydration finished) — the PDP could be fresh SSR either way.
    await waitForHydration(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(page.getByText(displayPrice(product.price)).first()).toBeVisible()
    // The struck-through former price renders only when genuinely higher.
    await expect(page.getByText(displayPrice(product.compareAtPrice!)).first()).toBeVisible()
    await expect(page.getByText(`En stock (${stock} disponibles)`)).toBeVisible()
  })

  await test.step('add to cart', async () => {
    await page.getByRole('button', { name: 'Ajouter au panier' }).click()
    await expect(page.getByRole('button', { name: 'Ajouté !' })).toBeVisible()
    await expect(page.locator('header a[href$="/panier"] span.absolute')).toHaveText('1')
  })

  let pricedTotal = ''
  await test.step('basket reprices on the server', async () => {
    const priced = page.waitForResponse('**/api/cart/price')
    await page.locator('header a[href$="/panier"]').click()
    const body = (await (await priced).json()) as {
      lines: Array<{ productId: string; quantity: number; lineTotal: string }>
      total: string
    }
    expect(body.lines).toEqual([
      expect.objectContaining({ productId: product._id, quantity: 1 }),
    ])
    await expect(page.getByText(name).first()).toBeVisible()
    // What the page shows IS what the server answered — no client arithmetic.
    await expect(page.getByText(displayDecimal(body.total)).first()).toBeVisible()

    const repriced = page.waitForResponse('**/api/cart/price')
    const quantityInput = page.locator('li input[type="number"]').first()
    await quantityInput.fill('2')
    await quantityInput.blur()
    const secondBody = (await (await repriced).json()) as { total: string }
    pricedTotal = secondBody.total
    expect(Number(secondBody.total)).toBeCloseTo(product.price * 2, 2)
    await expect(page.getByText(displayDecimal(secondBody.total)).first()).toBeVisible()
  })

  await test.step('checkout as a Belgian guest, cash on delivery', async () => {
    await page.getByRole('link', { name: 'Commander' }).click()
    await expect(page).toHaveURL(/\/commande$/)
    await waitForHydration(page)

    await page.locator('select').first().selectOption('BE')
    await page.locator('input[autocomplete="postal-code"]').fill('1000')
    await page.locator('input[autocomplete="address-level2"]').fill('Bruxelles')
    await page.locator('input[autocomplete="given-name"]').fill('Walker')
    await page.locator('input[autocomplete="family-name"]').fill('Candidate')
    await page.locator('input[type="email"]').fill('walker@vitesse-eco.test')
    await page.locator('input[autocomplete="tel"]').fill('+32470123456')

    await page.locator('input[type="radio"][value="free-benelux"]').check()
    await page.locator('input[type="radio"][value="cod"]').check()
    await page.locator('input[autocomplete="address-line1"]').fill('Grote Markt 1')

    const confirm = page.getByRole('button', { name: 'Confirmer la commande' })
    await expect(confirm, 'Turnstile test key should arm the confirm button').toBeEnabled({
      timeout: 90_000,
    })

    const placed = page.waitForResponse('**/api/checkout/start')
    await confirm.click()
    const response = await placed
    expect(response.status()).toBe(200)
    const order = (await response.json()) as { orderNumber: string; total: string; mode: string }
    expect(order.mode).toBe('cash')
    expect(order.orderNumber).toMatch(/^ORD-/)
    // The order froze the same total the basket displayed.
    expect(order.total).toBe(pricedTotal)

    await expect(page).toHaveURL(/\/commande\/confirmation\?order=/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Commande reçue' })).toBeVisible()
    await expect(page.getByText(order.orderNumber)).toBeVisible()
  })

  await test.step('the basket is empty after confirmation', async () => {
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem('vitesse.cart.v1')
          return raw ? (JSON.parse(raw).lines as unknown[]).length : 0
        })
      )
      .toBe(0)
    await expect(page.locator('header a[href$="/panier"] span.absolute')).toHaveCount(0)
  })
})
