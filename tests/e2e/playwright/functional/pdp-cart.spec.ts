/**
 * Product-page and basket states that the journey does not cross:
 * sold out, sibling colours, remove-with-undo, promo feedback, empty basket.
 *
 * Everything here is read-only against the shop — no order is ever placed, so
 * these tests can run in parallel with anything without moving stock.
 */
import { test, expect } from '../helpers/test'
import {
  displayPrice,
  displayProduct,
  fixturePromo,
  onHand,
  outOfStockProduct,
} from '../helpers/catalogue'

test('a sold-out product says so and refuses the basket', async ({ page }) => {
  await page.goto(`/produits/${outOfStockProduct.slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(outOfStockProduct.name.fr)
  await expect(page.getByText('Épuisé').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ajouter au panier' })).toBeDisabled()
})

test('colours of one model link each other, with the current one marked', async ({ page }) => {
  await page.goto(`/produits/${displayProduct.slug}`)
  const current = page.locator('[aria-current="true"]')
  await expect(current).toContainText(displayProduct.color!.fr)
  // The other colour is a link away, and carries its own slug.
  await page.getByRole('link', { name: /Noir/ }).first().click()
  await expect(page).toHaveURL(/fixture-velo-ville-noir$/)
  await expect(page.locator('[aria-current="true"]')).toContainText('Noir')
})

test('an unknown product answers a real 404, not an empty page', async ({ page }) => {
  const response = await page.goto('/produits/produit-qui-nexiste-pas')
  expect(response?.status()).toBe(404)
})

test('removing a basket line offers a working undo', async ({ page, seedCart }) => {
  await seedCart([{ productId: displayProduct._id, quantity: 1 }])
  await page.goto('/panier')
  await expect(page.getByText(displayProduct.name.fr).first()).toBeVisible()

  await page.getByRole('button', { name: 'Retirer' }).click()
  const undoStrip = page.getByRole('status').filter({ hasText: displayProduct.name.fr })
  await expect(undoStrip).toBeVisible()

  const repriced = page.waitForResponse('**/api/cart/price')
  await undoStrip.getByRole('button', { name: 'Annuler' }).click()
  await repriced
  await expect(page.locator('li').filter({ hasText: displayProduct.name.fr }).first()).toBeVisible()
})

test('the promo code is priced by the server and announced', async ({ page, seedCart }) => {
  await seedCart([{ productId: displayProduct._id, quantity: 2 }])
  await page.goto('/panier')
  await expect(page.getByText(displayProduct.name.fr).first()).toBeVisible()

  const repriced = page.waitForResponse('**/api/cart/price')
  await page.locator('#promo').fill(fixturePromo.code)
  await page.getByRole('button', { name: 'Appliquer' }).click()
  const body = (await (await repriced).json()) as {
    subtotal: string
    discount: string
    total: string
    promo: { code: string; applied: boolean }
  }

  expect(body.promo).toEqual({ code: fixturePromo.code, applied: true })
  // 10% off, computed in cents on the server; the page renders those figures.
  expect(Number(body.discount)).toBeCloseTo(Number(body.subtotal) / 10, 2)
  await expect(page.getByText(`Code ${fixturePromo.code} appliqué`)).toBeVisible()

  const rejected = page.waitForResponse('**/api/cart/price')
  await page.locator('#promo').fill('CODE-INVENTE')
  await page.getByRole('button', { name: 'Appliquer' }).click()
  await rejected
  await expect(page.getByText("Ce code n'est pas valable.")).toBeVisible()
})

test('the quantity field is capped by real stock', async ({ page, seedCart }) => {
  await seedCart([{ productId: displayProduct._id, quantity: 1 }])
  await page.goto('/panier')
  const input = page.locator('li input[type="number"]').first()
  await expect(input).toHaveAttribute('max', String(onHand(displayProduct._id)))
})

test('an empty basket says so and routes back to the shop', async ({ page }) => {
  await page.goto('/panier')
  await expect(page.getByText('Votre panier est vide.')).toBeVisible()
  await page.getByRole('link', { name: 'Voir les produits' }).click()
  await expect(page).toHaveURL(/\/produits$/)
  await expect(page.getByText(displayPrice(displayProduct.price)).first()).toBeVisible()
})
