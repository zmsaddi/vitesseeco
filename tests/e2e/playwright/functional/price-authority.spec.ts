/**
 * Proof, from the browser's side of the wire, that the client is never the
 * authority on money.
 *
 * The contract under test (shared/schemas.ts, all `.strict()`):
 *   - the persisted basket carries ids and quantities, nothing else;
 *   - the pricing request carries ids and quantities, nothing else;
 *   - a payload that smuggles a price, a total or an impossible quantity is
 *     rejected outright — not stripped, not ignored: refused.
 *
 * No business code was changed for this spec; it exercises the schemas exactly
 * as any tampering client would meet them.
 */
import { test, expect } from '../helpers/test'
import { displayProduct, journeyProduct } from '../helpers/catalogue'

test('the persisted basket holds ids and quantities only', async ({ page }) => {
  await page.goto(`/produits/${displayProduct.slug}`)
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await expect(page.getByRole('button', { name: 'Ajouté !' })).toBeVisible()

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('vitesse.cart.v1') ?? '{}')
  )
  expect(Object.keys(stored).sort()).toEqual(['lines', 'promoCode'])
  expect(stored.lines).toEqual([{ productId: displayProduct._id, quantity: 1 }])
})

test('the pricing request carries no money fields', async ({ page, seedCart }) => {
  await seedCart([{ productId: displayProduct._id, quantity: 2 }])
  const request = page.waitForRequest('**/api/cart/price')
  await page.goto('/panier')
  const payload = (await request).postDataJSON() as {
    cart: { lines: Array<Record<string, unknown>> }
    locale: string
  }
  expect(Object.keys(payload).sort()).toEqual(['cart', 'locale'])
  expect(Object.keys(payload.cart).sort()).toEqual(['lines'])
  expect(payload.cart.lines.map((line) => Object.keys(line).sort())).toEqual([
    ['productId', 'quantity'],
  ])
})

test('a line that states its own price is refused', async ({ page }) => {
  await page.goto('/')
  const status = await page.evaluate(async (productId) => {
    const response = await fetch('/api/cart/price', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cart: { lines: [{ productId, quantity: 1, unitPrice: '0.01' }] },
        locale: 'fr',
      }),
    })
    return response.status
  }, journeyProduct._id)
  expect(status).toBe(400)
})

test('a checkout that states its own total is refused', async ({ page }) => {
  await page.goto('/')
  const statuses = await page.evaluate(async (productId) => {
    const base = {
      cart: { lines: [{ productId, quantity: 1 }] },
      shipping: { methodCode: 'pickup', destination: { country: 'FR', postalCode: '86000' } },
      paymentMethod: 'in_store',
      locale: 'fr',
      email: 'walker@vitesse-eco.test',
      firstName: 'Walker',
      lastName: 'Candidate',
      phone: '+33745830049',
      idempotencyKey: crypto.randomUUID(),
      captchaToken: 'pw.DUMMY.TOKEN',
    }
    const post = async (body: unknown) => {
      const response = await fetch('/api/checkout/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return response.status
    }
    return {
      // A total the client computed has no field to travel in.
      smuggledTotal: await post({ ...base, total: '0.01' }),
      // A quantity beyond the per-line cap never reaches the order service.
      impossibleQuantity: await post({
        ...base,
        cart: { lines: [{ productId, quantity: 999 }] },
      }),
    }
  }, journeyProduct._id)

  expect(statuses.smuggledTotal).toBe(400)
  expect(statuses.impossibleQuantity).toBe(400)
})

test('the displayed total is the server total, recomputed from the catalogue', async ({
  page,
  seedCart,
}) => {
  await seedCart([{ productId: displayProduct._id, quantity: 2 }])
  const priced = page.waitForResponse('**/api/cart/price')
  await page.goto('/panier')
  const body = (await (await priced).json()) as { total: string }
  // The fixture authored this price in euros; the server rederived it in cents
  // from the catalogue and the quantity — nothing of it came from the browser.
  expect(Number(body.total)).toBeCloseTo(displayProduct.price * 2, 2)
})
