/**
 * The ONLINE money path, walked for real — through Stripe's own form.
 *
 * Seeds a basket, walks the real /commande page in a real browser, pays with
 * Stripe's 4242 test card inside the embedded form, and then waits for the
 * webhook to land: the order flips to paid and the shelf count drops. Every
 * claim is asserted in the DATABASE, because a "payment succeeded" screen with
 * no row behind it is exactly the failure this shop refuses to ship.
 *
 *   node tests/e2e/stripe-money-path.mjs https://preview-host postgres://...
 *
 * Needs the target booted with TEST keys on both sides: Stripe (sk_test/pk_test,
 * so 4242 is accepted) and Turnstile (the pass-everything sitekey, so an
 * automated walk can clear the captcha at all). The webhook endpoint must point
 * at the same host, or the order will sit in awaiting_payment forever — which
 * this test would then correctly report.
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import process from 'node:process'

const BASE = (process.argv[2] || '').replace(/\/$/, '')
const DB_URL = process.argv[3]
if (!BASE || !DB_URL) {
  console.error('usage: node tests/e2e/stripe-money-path.mjs <base-url> <database-url>')
  process.exit(2)
}

const SHOTS = '.simshots-stripe'
mkdirSync(SHOTS, { recursive: true })

const db = new pg.Client({ connectionString: DB_URL })
await db.connect()

let failures = 0
const ok = (label) => console.log(`  ✓ ${label}`)
const fail = (label, detail) => {
  failures++
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
}
const assert = (condition, label, detail) => (condition ? ok(label) : fail(label, detail))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Repeated walks burn the per-IP checkout budget — the limit doing its job.
// This harness owns the simulation database, so it clears the window instead
// of waiting. Never a thing to do anywhere real.
await db.query('DELETE FROM rate_limits')

// Give back the holds of earlier sim attempts: every walk that opened a Stripe
// session and never paid left a 30-minute reservation behind, and five of
// those in a row would dry the very shelf this test wants to watch drop.
await db.query(`
  DELETE FROM stock_reservations sr USING orders o
   WHERE sr.order_id = o.id AND sr.settled_at IS NULL
     AND o.status = 'awaiting_payment' AND o.payment_method = 'stripe'`)

console.log('\n1. A product with real stock')
const { rows: [product] } = await db.query(
  `SELECT product_id, on_hand FROM inventory WHERE on_hand >= 1 ORDER BY on_hand DESC LIMIT 1`
)
assert(!!product, `picked ${product?.product_id} with on_hand=${product?.on_hand}`)
const startOnHand = product.on_hand

console.log('\n2. Walk the real checkout page')
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' })
// The basket exactly as useCart persists it — ids and quantities, never a price.
await context.addInitScript(
  ([key, value]) => localStorage.setItem(key, value),
  ['vitesse.cart.v1', JSON.stringify({ lines: [{ productId: product.product_id, quantity: 1 }], promoCode: null })]
)
const page = await context.newPage()

// The order number comes from the server's own answer, not from scraping.
let startResponse = null
page.on('response', (res) => {
  if (res.url().includes('/api/checkout/start')) startResponse = res
})

// Not networkidle: the captcha widget keeps a connection alive forever.
await page.goto(`${BASE}/commande`, { waitUntil: 'domcontentloaded' })
await page.locator('select').first().waitFor({ timeout: 20_000 })
ok('checkout page rendered with a restored basket')

await page.locator('input[autocomplete="postal-code"]').fill('86000')
await page.locator('input[autocomplete="address-level2"]').fill('Poitiers')
await page.locator('input[type="email"]').fill('sim-stripe@vitesse-eco.test')

// Delivery options answer the address; prefer a real delivery over pickup so
// the address block and the van path are exercised too.
await page.locator('input[type="radio"]').first().waitFor({ timeout: 20_000 })
const radios = page.locator('section:has(h2:text-is("2. Livraison")) input[type="radio"], ul input[type="radio"]')
const values = await page.locator('input[type="radio"]').evaluateAll((els) => els.map((el) => el.value))
const shippingPick = values.find((v) => v !== 'pickup' && v !== 'stripe' && v !== 'cod' && v !== 'in_store') ?? values[0]
await page.locator(`input[type="radio"][value="${shippingPick}"]`).first().check()
ok(`shipping selected: ${shippingPick}`)

if (await page.locator('input[autocomplete="given-name"]').isVisible().catch(() => false)) {
  await page.locator('input[autocomplete="given-name"]').fill('Sim')
  await page.locator('input[autocomplete="family-name"]').fill('Stripe')
  await page.locator('input[autocomplete="address-line1"]').fill('32 Rue du Faubourg du Pont Neuf')
  await page.locator('input[autocomplete="tel"]').fill('+33745830049')
  ok('delivery address filled')
}

const stripeRadio = page.locator('input[type="radio"][value="stripe"]')
if (await stripeRadio.count()) await stripeRadio.check()
ok('online payment selected')

// The Turnstile test key resolves by itself; the button unlocking is the proof.
const confirmButton = page.locator('aside button.btn-primary')
await page.waitForFunction(
  () => {
    const btn = document.querySelector('aside button.btn-primary')
    return btn && !btn.disabled
  },
  { timeout: 45_000 }
)
ok('captcha cleared, confirm button armed')
await page.screenshot({ path: `${SHOTS}/01-checkout-form.png`, fullPage: true })

console.log('\n3. Open the embedded Stripe form')
await confirmButton.click()

// Either Stripe mounts, or our own error alert explains why. Both are answers.
// The form lives in the embedded-checkout-inner frame; loadStripe also injects
// metric/controller iframes that match a looser selector and hold nothing.
const stripeFrameEl = page.locator('iframe[src*="embedded-checkout-inner"]').first()
const errorAlert = page.locator('[role="alert"]')
await Promise.race([
  stripeFrameEl.waitFor({ timeout: 45_000 }),
  errorAlert.waitFor({ timeout: 45_000 }),
]).catch(() => {})
if (await errorAlert.isVisible().catch(() => false)) {
  await page.screenshot({ path: `${SHOTS}/02-error.png`, fullPage: true })
  fail('checkout/start refused', await errorAlert.textContent())
} else {
  assert(await stripeFrameEl.count(), 'embedded Stripe iframe mounted')
}

assert(!!startResponse, 'checkout/start was called')
const startBody = startResponse ? await startResponse.json().catch(() => null) : null
assert(startResponse?.status() === 200 && startBody?.mode === 'stripe',
  `order opened: ${startBody?.orderNumber} (${startBody?.total} €)`,
  JSON.stringify(startBody).slice(0, 200))
const orderNumber = startBody?.orderNumber
if (!orderNumber) {
  await page.screenshot({ path: `${SHOTS}/02-no-order.png`, fullPage: true })
  console.error('\n❌ no order was opened; nothing further to walk\n')
  await browser.close(); await db.end(); process.exit(1)
}

console.log('\n4. The database holds the order and the stock')
const { rows: [row] } = await db.query(
  `SELECT status, payment_method, market_country, vat_cents FROM orders WHERE order_number = $1`,
  [orderNumber]
)
assert(row?.status === 'awaiting_payment', `status is awaiting_payment (${row?.status})`)
assert(row?.payment_method === 'stripe', `payment method is stripe (${row?.payment_method})`)
assert(row?.market_country === 'FR', `market frozen (${row?.market_country}, ${row?.vat_cents} cents VAT)`)
const { rows: [hold] } = await db.query(
  `SELECT sr.quantity, sr.settled_at FROM stock_reservations sr
     JOIN orders o ON o.id = sr.order_id WHERE o.order_number = $1`,
  [orderNumber]
)
assert(hold?.quantity === 1 && hold?.settled_at === null, 'stock held: 1 unit, unsettled')

console.log('\n5. Pay with the 4242 card inside the Stripe form')
const frame = page.frameLocator('iframe[src*="embedded-checkout-inner"]')
const innerFrame = page.frames().find((f) => f.url().includes('embedded-checkout-inner'))
// The card fields render only after the Carte accordion entry is chosen, and
// its click surface defeats Playwright's actionability check — a plain DOM
// click inside the frame is what a wallet-first layout leaves us.
// The button is a zero-sized expanded-click-area overlay: never "visible" to
// Playwright, permanently clickable to the DOM.
await frame.locator('[data-testid="card-accordion-item-button"]').waitFor({ state: 'attached', timeout: 45_000 })
await innerFrame.evaluate(() => {
  document.querySelector('[data-testid="card-accordion-item-button"]')?.click()
})
const cardNumber = frame.locator('#cardNumber')
await cardNumber.waitFor({ timeout: 30_000 })
await cardNumber.fill('4242424242424242')
await frame.locator('#cardExpiry').fill('12 / 34')
await frame.locator('#cardCvc').fill('123')
const billingName = frame.locator('#billingName')
if (await billingName.isVisible().catch(() => false)) await billingName.fill('Sim Stripe')
const billingCountry = frame.locator('select#billingCountry')
if (await billingCountry.isVisible().catch(() => false)) await billingCountry.selectOption('FR').catch(() => {})
const billingPostal = frame.locator('#billingPostalCode')
if (await billingPostal.isVisible().catch(() => false)) await billingPostal.fill('86000')
ok('card 4242 filled')
await page.screenshot({ path: `${SHOTS}/03-stripe-filled.png`, fullPage: true })

const payButton = frame.locator('[data-testid="hosted-payment-submit-button"]')
await payButton.click({ timeout: 15_000 }).catch(async () => {
  await innerFrame.evaluate(() => {
    document.querySelector('[data-testid="hosted-payment-submit-button"]')?.click()
  })
})
ok('pay clicked')

// The return may land on the canonical domain rather than this preview host —
// the redirect is not this test's authority anyway; the database is.
await page.waitForURL('**/commande/confirmation**', { timeout: 90_000 }).catch(() => {})
await sleep(1500)
await page.screenshot({ path: `${SHOTS}/04-after-payment.png`, fullPage: true })
console.log(`  → landed on: ${page.url()}`)

console.log('\n6. The webhook lands: paid, settled, and the shelf drops')
let paidRow = null
for (let i = 0; i < 30; i++) {
  const { rows: [r] } = await db.query(
    `SELECT o.status, sr.settled_at, i.on_hand
       FROM orders o
       JOIN stock_reservations sr ON sr.order_id = o.id
       JOIN inventory i ON i.product_id = $2
      WHERE o.order_number = $1`,
    [orderNumber, product.product_id]
  )
  paidRow = r
  if (r?.status === 'paid') break
  await sleep(3000)
}
assert(paidRow?.status === 'paid', `order is paid via webhook (${paidRow?.status})`)
assert(paidRow?.settled_at !== null, 'reservation settled')
assert(paidRow?.on_hand === startOnHand - 1, `THE SHELF DROPPED: on_hand ${startOnHand} → ${paidRow?.on_hand}`)

await browser.close()
await db.end()
if (failures > 0) {
  console.error(`\n❌ ${failures} assertion(s) failed — screenshots in ${SHOTS}/\n`)
  process.exit(1)
}
console.log(`\n✅ The online money path holds: a real card form, a real webhook, a real row.\n`)
