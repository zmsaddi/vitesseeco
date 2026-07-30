/**
 * The simulator — TEMPLATE. Edit the CONFIG block, delete what does not apply.
 *
 * Not a unit test and not a happy-path e2e run. This drives a real browser
 * through the application the way a user does and reports everything that would
 * have gone wrong QUIETLY: a request that 500s, a page that renders a raw
 * translation key, a hydration mismatch, a console error, a value that changes
 * between two screens that must agree, a form that cannot be completed.
 *
 * Point it at the PRODUCTION BUILD, not the dev server. A dev server that renders
 * client-side cannot show you a server-side rendering defect.
 *
 *   node simulate.mjs http://127.0.0.1:3000
 *   node simulate.mjs https://example.com --locales fr,nl,de --headed
 *
 * Exits non-zero on any HIGH finding, so it can gate CI.
 *
 * Requires: npm i -D @playwright/test  &&  npx playwright install chromium
 */
import { chromium } from '@playwright/test'
import process from 'node:process'

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
  /** Every page that must serve in every locale. */
  pages: ['/', '/products', '/cart', '/checkout', '/contact', '/login', '/about'],

  /** Files consumed by machines: sitemaps, feeds, manifests, robots. */
  machineRoutes: ['/sitemap.xml', '/robots.txt', '/manifest.webmanifest'],

  /** The locale that lives at the bare path. Others are prefixed: /nl/products */
  defaultLocale: 'en',

  /** Top-level i18n namespaces. A raw `namespace.key` in the output is a defect. */
  i18nNamespaces: ['common', 'nav', 'cart', 'checkout', 'product', 'account', 'errors'],

  /** Console noise that is NOT ours and must never fail a run. Keep this tight:
   *  every entry is a blind spot you are choosing. */
  ignorableConsole:
    /WebGL|OTS parsing|powerPreference|requestAdapter|runtime\.lastError|challenges\.cloudflare|Download the .* Devtools|third-party cookie/i,

  /** Browser context — deliberately DIFFERENT from the server's, to expose
   *  timezone and locale bugs rather than hide them. */
  browserLocale: 'fr-FR',
  timezone: 'Europe/Paris',

  /** Set to null to skip the transaction walk. */
  purchase: {
    listing: '/products',
    productLinkSelector: 'a[href*="/products/"]',
    addToCartText: /cart|panier|winkelwagen|warenkorb|carrito|السلة/i,
    cart: '/cart',
    emptyCartText: /empty|vide|leeg|leer|vacío|فارغ/i,
    checkout: '/checkout',
    /** Regex capturing a money amount, used to prove the price does not drift. */
    pricePattern: /(\d[\d\s  .,]*)\s*(?:€|\$|£)/,
  },

  /** A cheap probe that says whether the backing data exists in this environment.
   *  Without it, running on a machine with no data credentials reports the whole
   *  application as broken — and a tool that cries wolf gets switched off. */
  dataProbe: { path: '/api/products?perPage=1', expect: /"items"\s*:\s*\[\s*\{/ },
  /** Findings that only exist BECAUSE there is no data get demoted, not dropped. */
  dataDependent: /feed|no product links|basket is empty|price on the product page|add-to-cart/i,
}
// ───────────────────────────────────────────────────────────────────────────

const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const LOCALES = flag('locales', CONFIG.defaultLocale).split(',')
const HEADED = process.argv.includes('--headed')

const RAW_KEY = new RegExp(
  `(?:^|[\\s>"'])((?:${CONFIG.i18nNamespaces.join('|')})\\.[a-z0-9_]+)(?:[\\s<"']|$)`
)

const findings = []
const record = (severity, area, detail) => findings.push({ severity, area, detail })

const localised = (path, locale) =>
  locale === CONFIG.defaultLocale ? path : path === '/' ? `/${locale}` : `/${locale}${path}`

/** Attach the listeners that catch what a green test never looks at. */
async function watch(page, label) {
  page.on('console', (msg) => {
    const text = msg.text()
    if (CONFIG.ignorableConsole.test(text)) return
    if (/hydrat|mismatch/i.test(text)) record('high', label, `hydration: ${text.slice(0, 160)}`)
    else if (msg.type() === 'error') record('high', label, `console error: ${text.slice(0, 160)}`)
  })
  page.on('pageerror', (e) => record('high', label, `uncaught: ${String(e).slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 500) record('high', label, `HTTP ${r.status()} ${r.url().replace(BASE, '')}`)
    else if (r.status() >= 400 && r.url().includes('/api/')) {
      record('medium', label, `HTTP ${r.status()} ${r.url().replace(BASE, '')}`)
    }
  })
}

async function checkPage(context, path, locale) {
  const label = `${locale}${path}`
  const page = await context.newPage()
  await watch(page, label)

  let status = 0
  try {
    const res = await page.goto(BASE + localised(path, locale), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    status = res?.status() ?? 0
  } catch (e) {
    record('high', label, `navigation failed: ${String(e).slice(0, 120)}`)
    await page.close()
    return
  }
  await page.waitForTimeout(1800) // let client-side rendering settle

  if (status >= 400) record('high', label, `page returned ${status}`)

  const title = await page.title()
  if (!title || title.trim().length < 3) record('medium', label, 'no page title')
  if (RAW_KEY.test(title)) record('high', label, `title is a raw key: ${title}`)

  const body = await page.locator('body').innerText().catch(() => '')
  const raw = body.match(RAW_KEY)
  if (raw) record('high', label, `raw translation key rendered: ${raw[1]}`)

  // 200 with nothing on it is a soft 404 to a crawler and a dead end to a user.
  if (body.replace(/\s+/g, '').length < 120) record('high', label, 'page body is essentially empty')

  const lang = await page.getAttribute('html', 'lang')
  if (lang && !lang.startsWith(locale)) record('medium', label, `html lang is "${lang}", expected ${locale}`)

  const canonical = await page.getAttribute('link[rel=canonical]', 'href').catch(() => null)
  if (!canonical) record('medium', label, 'no canonical link')

  await page.close()
}

async function checkMachineRoutes(context) {
  // Fetched, not navigated: a file with a Content-Disposition makes page.goto
  // abort with "Download is starting", which looks like a failure and is not.
  for (const path of CONFIG.machineRoutes) {
    try {
      const res = await context.request.get(BASE + path, { timeout: 30_000 })
      const text = await res.text().catch(() => '')
      if (res.status() !== 200) record('high', path, `returned ${res.status()}`)
      else if (text.length < 80) record('high', path, `served ${text.length} bytes — effectively empty`)
      else if (path.endsWith('.xml') && !text.trimStart().startsWith('<?xml')) record('high', path, 'not XML')
    } catch (e) {
      record('high', path, `failed: ${String(e).slice(0, 110)}`)
    }
  }
}

/** The one journey where a defect costs money rather than a ranking. */
async function checkPurchasePath(context) {
  const c = CONFIG.purchase
  const page = await context.newPage()
  await watch(page, 'purchase')

  await page.goto(BASE + c.listing, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const first = page.locator(c.productLinkSelector).first()
  if ((await first.count()) === 0) {
    record('high', 'purchase', 'no product links on the listing page')
    await page.close()
    return
  }
  await page.goto(BASE + (await first.getAttribute('href')), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // The price the customer is shown, which every later screen must match.
  const match = (await page.locator('body').innerText()).match(c.pricePattern)
  const shown = match ? match[1].replace(/[\s  ]/g, '') : null
  if (!shown) record('high', 'purchase', 'no price on the product page')

  const addBtn = page.locator('button').filter({ hasText: c.addToCartText }).first()
  if ((await addBtn.count()) === 0) {
    record('high', 'purchase', 'no add-to-cart button on the product page')
    await page.close()
    return
  }
  await addBtn.click().catch((e) => record('high', 'purchase', `add to cart failed: ${String(e).slice(0, 100)}`))
  await page.waitForTimeout(2000)

  await page.goto(BASE + c.cart, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const cartText = await page.locator('body').innerText()
  if (c.emptyCartText.test(cartText)) record('high', 'purchase', 'basket is empty after adding a product')
  if (shown && !cartText.replace(/[\s  ]/g, '').includes(shown)) {
    record('high', 'purchase', `basket price differs from the product page (${shown} not found)`)
  }

  await page.goto(BASE + c.checkout, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  // A checkout that collects nothing cannot complete an order. This exact check
  // caught a shop that had been declared finished and could not sell.
  if ((await page.locator('form input, input[required]').count()) === 0) {
    record('high', 'purchase', 'checkout shows no input fields')
  }

  await page.close()
}

// ─── run ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: !HEADED })
const context = await browser.newContext({
  locale: CONFIG.browserLocale,
  timezoneId: CONFIG.timezone,
})

let dataAvailable = true
if (CONFIG.dataProbe) {
  const res = await context.request.get(BASE + CONFIG.dataProbe.path).catch(() => null)
  const text = res ? await res.text().catch(() => '') : ''
  dataAvailable = res?.status() === 200 && CONFIG.dataProbe.expect.test(text)
}

console.log(`\nSimulating ${BASE} — ${LOCALES.length} locale(s), ${CONFIG.pages.length} pages each`)
console.log(dataAvailable ? '  data: reachable\n' : '  data: UNREACHABLE — data-dependent findings demoted to info\n')

for (const locale of LOCALES) {
  process.stdout.write(`  ${locale} `)
  for (const path of CONFIG.pages) {
    await checkPage(context, path, locale)
    process.stdout.write('.')
  }
  process.stdout.write('\n')
}

process.stdout.write('  machine routes ')
await checkMachineRoutes(context)
process.stdout.write('done\n')

if (CONFIG.purchase) {
  process.stdout.write('  purchase path ')
  await checkPurchasePath(context)
  process.stdout.write('done\n')
}

await browser.close()

// A finding caused only by this environment lacking data is information, not a
// defect — demoted rather than dropped, so a genuine outage still surfaces.
if (!dataAvailable) {
  for (const f of findings) {
    if (CONFIG.dataDependent.test(`${f.area} ${f.detail}`)) f.severity = 'info'
  }
}

const by = (s) => findings.filter((f) => f.severity === s)
console.log(`\n${'─'.repeat(70)}`)
if (findings.length === 0) {
  console.log('✅ Nothing found.')
  process.exit(0)
}
const show = (list, heading) => {
  if (!list.length) return
  console.log(`\n${heading} (${list.length})`)
  const counted = new Map()
  for (const f of list) {
    const key = `${f.area} :: ${f.detail}`
    counted.set(key, (counted.get(key) ?? 0) + 1)
  }
  for (const [key, n] of counted) console.log(`   ${key}${n > 1 ? `  ×${n}` : ''}`)
}
show(by('high'), '🔴 HIGH')
show(by('medium'), '🟠 MEDIUM')
show(by('info'), 'ℹ️  INFO — environment lacks data, not a defect')
console.log('')
process.exit(by('high').length > 0 ? 1 : 0)
