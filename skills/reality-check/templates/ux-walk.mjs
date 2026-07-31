/**
 * The funnel, walked with eyes — TEMPLATE.
 *
 * The structural simulator (simulate.mjs) asserts what a machine can assert:
 * status codes, raw keys, hydration, console errors. It is BLIND TO PAINT. It
 * once passed 114 page loads while the shop's entire design system was missing
 * from the CSS bundle — every button transparent, every input a borderless
 * white box. Functionally perfect, visually broken, and no assertion anywhere
 * that could have said so.
 *
 * This walks the critical journey the way a customer does, takes a screenshot
 * at every step on a desktop AND a mobile viewport, and records friction facts
 * along the way. Then a person — or a vision model — LOOKS at the pictures and
 * judges what a stranger would judge:
 *
 *   · is the primary action unmissable, above the fold, on both viewports?
 *   · do numbers read correctly for the locale — "950,00 €", not "950.00 €"?
 *   · does anything look wrong that no assertion names: duplicate items, a
 *     wireframe where a design should be, empty space where an image belongs?
 *
 * The screenshots ARE the output. The ledger is the appendix.
 *
 *   node ux-walk.mjs http://127.0.0.1:3000
 *
 * Requires: npm i -D @playwright/test  &&  npx playwright install chromium
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import process from 'node:process'

// ─── CONFIG — adapt the journey to YOUR product ────────────────────────────
const CONFIG = {
  outDir: '.simshots',
  locale: 'fr-FR',
  timezone: 'Europe/Paris',
  viewports: [
    { name: 'desktop', viewport: { width: 1366, height: 768 }, isMobile: false },
    { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true },
  ],
  /** The journey, step by step. Each step: land somewhere, then measure. */
  steps: {
    listing: '/products',
    productLinkSelector: 'a[href*="/products/"]',
    addToCartText: /cart|panier|winkelwagen|warenkorb|carrito|السلة/i,
    cart: '/cart',
    checkout: '/checkout',
    checkoutCtaText: /commander|checkout|caisse|order/i,
    submitText: /confirmer|payer|valider|commander|pay|place order/i,
    /** Words that mean the basket is empty — seeing them after adding is a defect. */
    emptyCartText: /empty|vide|leeg|leer|vacío|فارغ/i,
  },
}
// ───────────────────────────────────────────────────────────────────────────

const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
mkdirSync(CONFIG.outDir, { recursive: true })

const ledger = []
const log = (step, facts) => {
  ledger.push({ step, ...facts })
  console.log('##', step, JSON.stringify(facts))
}

async function walk({ name, viewport, isMobile }) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport, isMobile, hasTouch: isMobile,
    locale: CONFIG.locale, timezoneId: CONFIG.timezone,
  })
  const page = await ctx.newPage()
  const shot = (n) => page.screenshot({ path: `${CONFIG.outDir}/${name}-${n}.png` })
  const s = CONFIG.steps

  // 1 ── landing: what does a stranger see in the first viewport?
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await shot('1-home')
  log(`${name}: landing`, {
    h1: await page.locator('h1').first().innerText().catch(() => '(no h1)'),
  })

  // 2 ── to the catalogue: is it one obvious click away?
  const toShop = page.locator(`a[href$="${s.listing}"]`).first()
  const oneClick = await toShop.isVisible().catch(() => false)
  if (oneClick) await toShop.click()
  else await page.goto(BASE + s.listing)
  await page.waitForTimeout(2500)
  await shot('2-listing')
  log(`${name}: listing`, {
    productLinks: await page.locator(s.productLinkSelector).count(),
    oneClickFromHome: oneClick,
  })

  // 3 ── the product: price, availability and the buy button in one glance?
  await page.locator(s.productLinkSelector).first().click()
  await page.waitForTimeout(2500)
  await shot('3-product')
  const addBtn = page.locator('button').filter({ hasText: s.addToCartText }).first()
  const addVisible = await addBtn.isVisible().catch(() => false)
  const bb = addVisible ? await addBtn.boundingBox() : null
  log(`${name}: product`, {
    addToCartVisible: addVisible,
    // Below the fold on mobile is where buy buttons go to die.
    addAboveFold: !!bb && bb.y < viewport.height,
  })

  // 4 ── add: does ANYTHING tell the customer it worked?
  if (addVisible) { await addBtn.click(); await page.waitForTimeout(1500) }
  await shot('4-added')

  // 5 ── the basket: honest total, obvious next step?
  await page.goto(BASE + s.cart)
  await page.waitForTimeout(2500)
  await shot('5-cart')
  const cartText = await page.locator('body').innerText()
  const checkoutBtn = page
    .locator(`a[href*="${s.checkout}"], button`)
    .filter({ hasText: s.checkoutCtaText })
    .first()
  log(`${name}: cart`, {
    looksEmptyAfterAdding: s.emptyCartText.test(cartText),
    checkoutCtaVisible: await checkoutBtn.isVisible().catch(() => false),
  })

  // 6 ── checkout: count every decision the customer must make.
  await page.goto(BASE + s.checkout)
  await page.waitForTimeout(3500)
  await shot('6-checkout-top')
  const fields = await page.locator('input:visible, select:visible, textarea:visible').count()
  const forcedLogin = /must (log|sign) in|connexion obligatoire/i.test(await page.locator('body').innerText())
  await page.keyboard.press('End')
  await page.waitForTimeout(800)
  await shot('7-checkout-bottom')
  log(`${name}: checkout`, {
    visibleFields: fields,
    guestPossible: !forcedLogin,
    submitFound: await page
      .locator('button').filter({ hasText: s.submitText }).last()
      .isVisible().catch(() => false),
  })

  await browser.close()
}

for (const device of CONFIG.viewports) await walk(device)

console.log(`\n${ledger.length} steps recorded. Now LOOK at ${CONFIG.outDir}/ — the`)
console.log('pictures are the deliverable; this ledger is only the appendix.')
console.log('LEDGER=' + JSON.stringify(ledger))
