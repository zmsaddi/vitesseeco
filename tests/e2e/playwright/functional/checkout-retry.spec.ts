/**
 * A retry goes back into the purchase it belongs to, and only that one.
 *
 * The checkout keeps one purchase key per attempt, mirrored to sessionStorage so
 * that a customer returning from a failed payment retries INTO the order they
 * already have. Three ways that went wrong, each guarded here:
 *
 *  - When that order has closed (abandoned and swept, or cancelled by the shop)
 *    the server answers errors.order_closed and the key must go: kept, every
 *    press replays the closed order. The page dropped it from memory only, so
 *    the mirror brought it back on the next visit; and a PayPal capture refused
 *    for a closed order dropped it nowhere at all.
 *  - The key was tied to the basket, delivery and payment alone. A street, a
 *    name or an email corrected after a reload kept it, and the replay returned
 *    the order as first placed: paid for, it shipped to the old address.
 *  - A key restored long after its order's stock hold lapsed was replayed into
 *    an attempt that could no longer be paid.
 *
 * The server's answers are the ones it really gives (shape and message key, as
 * the route wrapper serialises them) — fulfilled here, because a closed order
 * cannot be reached from a browser without waiting out the sweep. PayPal's SDK
 * is replaced by a stand-in that approves on click; the candidate rig has no
 * PayPal account, and the page only needs Buttons().render(). A purchase that
 * reached the PayPal buttons is also how the page comes to hold a minted key in
 * its mirror, exactly as a customer's tab does.
 */
import { test, expect } from '../helpers/test'
import { displayProduct } from '../helpers/catalogue'
import type { Page, Route } from '@playwright/test'

const STORE = 'vitesse.checkout.v1'

/** errors.order_closed exactly as the route wrapper answers it. */
function closed(url: string) {
  return JSON.stringify({
    error: true,
    url,
    statusCode: 409,
    statusMessage: 'ALREADY_PROCESSED',
    message: 'ALREADY_PROCESSED',
    data: { code: 'ALREADY_PROCESSED', messageKey: 'errors.order_closed' },
  })
}
const CLOSED_MESSAGE = 'Votre tentative de paiement précédente a expiré. Validez à nouveau pour recommencer.'

/** The start route's answer for an order placed to be paid with PayPal. */
function placedForPayPal(route: Route) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      orderNumber: 'ORD-TESTPAYPAL1',
      total: '1490.00',
      subtotal: '1490.00',
      discount: '0.00',
      shipping: '0.00',
      mode: 'paypal',
      paypalOrderId: 'PP-TESTPAYPAL1',
    }),
  })
}

/** The basket every case buys: one read-only fixture bike, never actually ordered. */
const LINES = [{ productId: displayProduct._id, quantity: 1 }]

/** The form as an earlier visit left it, without a purchase key. Synthetic identity only. */
const SAVED_FORM = {
  country: 'FR',
  postalCode: '86000',
  city: 'Poitiers',
  email: 'max.mustermann@example.com',
  phone: '+436601234567',
  firstName: 'Max',
  lastName: 'Mustermann',
  address: { line1: 'Musterstrasse 1', line2: '' },
  shipping: 'free-86',
  payment: 'stripe',
}

/** Seeds the mirror once per tab, so a reload reads what the page itself wrote. */
async function seedForm(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem('test.form-seeded')) return
      window.sessionStorage.setItem(key as string, value as string)
      window.sessionStorage.setItem('test.form-seeded', '1')
    },
    [STORE, JSON.stringify(SAVED_FORM)]
  )
}

/** Stands in for PayPal's SDK: the buttons approve on click. */
async function standInForPayPal(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { paypal: unknown }).paypal = {
      Buttons: (options: { onApprove: () => Promise<void> }) => ({
        render: async (container: HTMLElement) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.textContent = 'PayPal (stand-in)'
          button.addEventListener('click', () => void options.onApprove())
          container.appendChild(button)
        },
      }),
    }
  })
}

interface SentPurchase {
  idempotencyKey: string
  email: string
  shippingAddress?: { line1: string }
}

function sentPurchase(route: Route): SentPurchase {
  return route.request().postDataJSON() as SentPurchase
}

async function storedKey(page: Page): Promise<string | undefined> {
  return page.evaluate((key) => JSON.parse(window.sessionStorage.getItem(key) ?? 'null')?.purchaseKey, STORE)
}

async function confirmWhenArmed(page: Page): Promise<void> {
  const confirm = page.getByRole('button', { name: 'Confirmer la commande' })
  await expect(confirm, 'Turnstile test key should arm the confirm button').toBeEnabled({ timeout: 90_000 })
  await confirm.click()
}

/** Confirm, and wait for the PayPal buttons the placed order is paid with. */
async function placeForPayPal(page: Page): Promise<void> {
  await confirmWhenArmed(page)
  await expect(page.getByRole('button', { name: 'PayPal (stand-in)' })).toBeVisible()
}

test('a closed order\'s purchase key is dropped from the saved form, not only from memory', async ({ page, seedCart }) => {
  test.setTimeout(240_000)
  await seedCart(LINES)
  await seedForm(page)
  await standInForPayPal(page)

  const sent: string[] = []
  await page.route('**/api/checkout/start', async (route) => {
    sent.push(sentPurchase(route).idempotencyKey)
    // Placed the first time; by the customer's return, the sweep has closed it.
    if (sent.length === 1) await placedForPayPal(route)
    else await route.fulfill({ status: 409, contentType: 'application/json', body: closed(route.request().url()) })
  })

  await page.goto('/commande')
  await placeForPayPal(page)
  const dead = sent[0]!
  await expect.poll(() => storedKey(page)).toBe(dead)

  await page.reload()
  await confirmWhenArmed(page)

  await expect(page.getByRole('alert')).toHaveText(CLOSED_MESSAGE)
  // The mirror restored the earlier attempt's key, and that is what was replayed.
  expect(sent).toEqual([dead, dead])
  // Gone from the mirror as well: otherwise the next visit brings it back.
  await expect.poll(() => storedKey(page)).toBe('')

  await page.reload()
  await confirmWhenArmed(page)
  await expect.poll(() => sent.length).toBe(3)
  expect(sent[2]).not.toBe(dead)
  expect(sent[2]).toMatch(/^[0-9a-f-]{36}$/)
})

test('a PayPal capture refused because the order closed starts the next press afresh', async ({ page, seedCart }) => {
  test.setTimeout(240_000)
  await seedCart(LINES)
  await seedForm(page)
  await standInForPayPal(page)

  const sent: string[] = []
  await page.route('**/api/checkout/start', async (route) => {
    sent.push(sentPurchase(route).idempotencyKey)
    await placedForPayPal(route)
  })
  await page.route('**/api/checkout/paypal-capture', (route) =>
    route.fulfill({ status: 409, contentType: 'application/json', body: closed(route.request().url()) })
  )

  await page.goto('/commande')
  await placeForPayPal(page)
  await page.getByRole('button', { name: 'PayPal (stand-in)' }).click()

  await expect(page.getByRole('alert')).toHaveText(CLOSED_MESSAGE)
  await expect.poll(() => storedKey(page)).toBe('')

  await confirmWhenArmed(page)
  await expect.poll(() => sent.length).toBe(2)
  expect(sent[1]).not.toBe(sent[0])
})

test('a detail corrected after a reload is ordered as corrected, not replayed under the old key', async ({ page, seedCart }) => {
  test.setTimeout(300_000)
  await seedCart(LINES)
  await seedForm(page)
  await standInForPayPal(page)

  const sent: SentPurchase[] = []
  await page.route('**/api/checkout/start', async (route) => {
    sent.push(sentPurchase(route))
    await placedForPayPal(route)
  })

  await page.goto('/commande')
  await placeForPayPal(page)
  const first = sent[0]!.idempotencyKey
  await expect.poll(() => storedKey(page)).toBe(first)

  // Nothing changed: a return retries into the order already placed.
  await page.reload()
  await placeForPayPal(page)
  expect(sent[1]!.idempotencyKey).toBe(first)

  // The street corrected: a new purchase, carrying the corrected street.
  await page.reload()
  await page.locator('input[autocomplete="address-line1"]').fill('Musterstrasse 2')
  await placeForPayPal(page)
  expect(sent[2]!.shippingAddress?.line1).toBe('Musterstrasse 2')
  expect(sent[2]!.idempotencyKey).not.toBe(first)

  // Then the email: a new one again — the receipt goes where the order says.
  await page.reload()
  await page.locator('input[autocomplete="email"]').fill('erika.mustermann@example.com')
  await placeForPayPal(page)
  expect(sent[3]!.email).toBe('erika.mustermann@example.com')
  expect(sent[3]!.idempotencyKey).not.toBe(sent[2]!.idempotencyKey)
})

test('a key restored after its order\'s hold has lapsed is not replayed', async ({ page, seedCart }) => {
  test.setTimeout(240_000)
  await seedCart(LINES)
  await seedForm(page)
  await standInForPayPal(page)

  const sent: string[] = []
  await page.route('**/api/checkout/start', async (route) => {
    sent.push(sentPurchase(route).idempotencyKey)
    await placedForPayPal(route)
  })

  await page.goto('/commande')
  await placeForPayPal(page)
  const first = sent[0]!
  await expect.poll(() => storedKey(page)).toBe(first)

  // The customer comes back thirty-one minutes later: the clock the mirror
  // keeps is moved back rather than waited for.
  await page.evaluate((key) => {
    const saved = JSON.parse(window.sessionStorage.getItem(key) ?? 'null')
    saved.keyMintedAt -= 31 * 60_000
    window.sessionStorage.setItem(key, JSON.stringify(saved))
  }, STORE)
  await page.reload()
  await placeForPayPal(page)

  expect(sent).toHaveLength(2)
  expect(sent[1]).not.toBe(first)
  expect(sent[1]).toMatch(/^[0-9a-f-]{36}$/)
})
