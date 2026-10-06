/**
 * A purchase that has closed is forgotten — in memory and in the saved form.
 *
 * The checkout keeps one purchase key per attempt, mirrored to sessionStorage so
 * that a customer returning from a failed payment retries INTO the order they
 * already have. When that order has closed (abandoned and swept, or cancelled by
 * the shop) the server answers errors.order_closed and the key must go: kept,
 * every press replays the closed order. The page dropped it from memory only,
 * so the mirror brought it back on the next visit; and a PayPal capture refused
 * for a closed order dropped it nowhere at all.
 *
 * The server's answers are the ones it really gives (shape and message key, as
 * the route wrapper serialises them) — fulfilled here, because a closed order
 * cannot be reached from a browser without waiting out the sweep. PayPal's SDK
 * is replaced by a stand-in that approves on click; the candidate rig has no
 * PayPal account, and the page only needs Buttons().render().
 */
import { test, expect } from '../helpers/test'
import { displayProduct } from '../helpers/catalogue'

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

/** The basket every case buys: one read-only fixture bike, never actually ordered. */
const LINES = [{ productId: displayProduct._id, quantity: 1 }]

/** The form as the mirror holds it after an earlier attempt. Synthetic identity only. */
function savedForm(purchaseKey: string) {
  const fingerprint = JSON.stringify({
    lines: LINES,
    promo: null,
    shipping: 'free-86',
    payment: 'stripe',
    country: 'FR',
    postalCode: '86000',
  })
  return {
    country: 'FR',
    postalCode: '86000',
    city: 'Poitiers',
    email: 'max.mustermann@example.com',
    phone: '+436601234567',
    firstName: 'Max',
    lastName: 'Mustermann',
    purchaseKey,
    keyBelongsTo: purchaseKey ? fingerprint : '',
    address: { line1: 'Musterstrasse 1', line2: '' },
    shipping: 'free-86',
    payment: 'stripe',
  }
}

/** Seeds the mirror once per tab, so a reload reads what the page itself wrote. */
async function seedForm(page: import('@playwright/test').Page, purchaseKey: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem('test.form-seeded')) return
      window.sessionStorage.setItem(key as string, value as string)
      window.sessionStorage.setItem('test.form-seeded', '1')
    },
    [STORE, JSON.stringify(savedForm(purchaseKey))]
  )
}

async function storedKey(page: import('@playwright/test').Page): Promise<string | undefined> {
  return page.evaluate((key) => JSON.parse(window.sessionStorage.getItem(key) ?? 'null')?.purchaseKey, STORE)
}

async function confirmWhenArmed(page: import('@playwright/test').Page): Promise<void> {
  const confirm = page.getByRole('button', { name: 'Confirmer la commande' })
  await expect(confirm, 'Turnstile test key should arm the confirm button').toBeEnabled({ timeout: 90_000 })
  await confirm.click()
}

test('a closed order\'s purchase key is dropped from the saved form, not only from memory', async ({ page, seedCart }) => {
  test.setTimeout(240_000)
  const dead = crypto.randomUUID()
  await seedCart(LINES)
  await seedForm(page, dead)

  const sent: string[] = []
  await page.route('**/api/checkout/start', async (route) => {
    sent.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey)
    await route.fulfill({ status: 409, contentType: 'application/json', body: closed(route.request().url()) })
  })

  await page.goto('/commande')
  await confirmWhenArmed(page)

  await expect(page.getByRole('alert')).toHaveText(CLOSED_MESSAGE)
  // The mirror restored the earlier attempt's key, and that is what was replayed.
  expect(sent).toEqual([dead])
  // Gone from the mirror as well: otherwise the next visit brings it back.
  await expect.poll(() => storedKey(page)).toBe('')

  await page.reload()
  await confirmWhenArmed(page)
  await expect.poll(() => sent.length).toBe(2)
  expect(sent[1]).not.toBe(dead)
  expect(sent[1]).toMatch(/^[0-9a-f-]{36}$/)
})

test('a PayPal capture refused because the order closed starts the next press afresh', async ({ page, seedCart }) => {
  test.setTimeout(240_000)
  await seedCart(LINES)
  await seedForm(page, '')
  // Stands in for PayPal's SDK: the buttons approve on click.
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

  const sent: string[] = []
  await page.route('**/api/checkout/start', async (route) => {
    sent.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey)
    await route.fulfill({
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
  })
  await page.route('**/api/checkout/paypal-capture', (route) =>
    route.fulfill({ status: 409, contentType: 'application/json', body: closed(route.request().url()) })
  )

  await page.goto('/commande')
  await confirmWhenArmed(page)
  await page.getByRole('button', { name: 'PayPal (stand-in)' }).click()

  await expect(page.getByRole('alert')).toHaveText(CLOSED_MESSAGE)
  await expect.poll(() => storedKey(page)).toBe('')

  await confirmWhenArmed(page)
  await expect.poll(() => sent.length).toBe(2)
  expect(sent[1]).not.toBe(sent[0])
})
