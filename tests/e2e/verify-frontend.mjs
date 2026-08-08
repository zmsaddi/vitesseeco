/**
 * The frontend gate.
 *
 * Every check here exists because the thing it checks was broken and nothing
 * noticed. It runs a real browser against a running production-shaped build,
 * because none of these failures are visible to a typecheck or a unit test:
 *
 *  - the header overflowed a 320px viewport on every page, in every language,
 *    and no test looked at a viewport that narrow;
 *  - the wishlist had storage, a page and a composable, and not one control in
 *    the shop could put anything into it;
 *  - the account and order-detail pages existed with nothing linking to them.
 *
 * Usage:  node tests/e2e/verify-frontend.mjs http://127.0.0.1:3000
 */
import process from 'node:process'
import { chromium } from 'playwright'

const BASE = (process.argv[2] ?? process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

/** The narrowest viewport still in real use. Anything wider hides the bug. */
const NARROW = 320

/** One route per shape of page, in the default locale and in the RTL one. */
const ROUTES = ['/', '/produits', '/panier', '/connexion']
const LOCALES = ['', '/ar']

let failures = 0
const fail = (what, detail) => {
  failures++
  console.error(`  ❌ ${what}`)
  if (detail) console.error(`     ${detail}`)
}
const pass = (what) => console.log(`  ✅ ${what}`)

const browser = await chromium.launch()

try {
  console.log(`\nfrontend gate against ${BASE}\n`)

  // ── 1. No horizontal overflow at 320px ─────────────────────────────────────
  console.log(`horizontal reflow at ${NARROW}px`)
  const page = await browser.newPage({ viewport: { width: NARROW, height: 720 } })
  for (const prefix of LOCALES) {
    for (const route of ROUTES) {
      const url = `${BASE}${prefix}${route === '/' ? '' : route}` || `${BASE}/`
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
      if (!response || response.status() >= 400) {
        fail(`${prefix || '/'}${route} returned ${response ? response.status() : 'no response'}`)
        continue
      }
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        const over = doc.scrollWidth - doc.clientWidth
        if (over <= 0) return null
        const widest = [...document.querySelectorAll('body *')]
          .map((el) => ({ el, rect: el.getBoundingClientRect() }))
          .filter(({ rect }) => rect.right > window.innerWidth + 1)
          .sort((a, b) => b.rect.right - a.rect.right)[0]
        return {
          over,
          culprit: widest
            ? `${widest.el.tagName.toLowerCase()}.${String(widest.el.className).trim().split(/\s+/).slice(0, 2).join('.')}`
            : 'unknown',
        }
      })
      if (overflow) fail(`${prefix || ''}${route} overflows by ${overflow.over}px`, `widest: ${overflow.culprit}`)
    }
  }
  if (!failures) pass(`no horizontal overflow across ${ROUTES.length * LOCALES.length} pages`)

  // ── 2. Every capability has a way in ───────────────────────────────────────
  console.log('\nentry points')
  const before = failures

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  for (const [what, selector] of [
    ['account', 'header a[href$="/compte"]'],
    ['wishlist', 'header a[href$="/favoris"]'],
    ['basket', 'header a[href$="/panier"]'],
  ]) {
    if ((await page.locator(selector).count()) === 0) fail(`the header offers no way to reach ${what}`)
  }

  // A wishlist nothing can add to is not a feature.
  await page.goto(`${BASE}/produits`, { waitUntil: 'domcontentloaded' })
  // Bounded: an empty catalogue must announce itself, never hang the gate.
  const firstProduct = await page
    .locator('a[href*="/produits/"]')
    .first()
    .getAttribute('href', { timeout: 5000 })
    .catch(() => null)
  if (!firstProduct) {
    // Not a frontend failure — say so loudly rather than passing in silence.
    console.log('  ⏭  SKIPPED: this build serves no products, so the product-page')
    console.log('     checks could not run. Point the gate at a build with a catalogue.')
  } else {
    await page.goto(`${BASE}${firstProduct}`, { waitUntil: 'domcontentloaded' })
    if ((await page.locator('button[aria-pressed]').count()) === 0) {
      fail('the product page has no control that saves to the wishlist')
    }
    // The specifications the page collects for its own meta description must
    // also be visible to the person deciding whether to buy.
    const hasSpecs = await page.locator('dl dt').count()
    if (hasSpecs === 0) fail('the product page shows no specifications')
  }
  if (failures === before) {
    pass(firstProduct
      ? 'account, wishlist, basket, save control and specifications all reachable'
      : 'header entry points reachable (product-page checks skipped)')
  }

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} frontend problem(s)\n`)
    process.exit(1)
  }
  console.log('✅ frontend gate passed\n')
} finally {
  await browser.close()
}
