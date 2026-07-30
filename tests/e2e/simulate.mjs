/**
 * The simulator.
 *
 * Not a unit test and not a green-path e2e run. This drives a real browser
 * through the site the way a customer does and reports everything that would
 * have gone wrong quietly: a request that 500s, a page that renders a raw
 * translation key, a hydration mismatch, a console error, a price that changes
 * between two screens, a form that cannot be completed.
 *
 * It exists because every genuine defect found on this project was found by
 * running the thing, not by reading it. The build was green while the entire
 * site rendered raw i18n keys; the tests passed while stock was held forever;
 * typecheck was clean while every date was a day behind.
 *
 *   node tests/e2e/simulate.mjs http://127.0.0.1:3000
 *   node tests/e2e/simulate.mjs https://vitesse-eco.fr --locales fr,nl,de
 *
 * Exits non-zero when it finds something. Designed to be pointed at either
 * branch, so the rebuild can be compared against the live site directly.
 */
import { chromium } from '@playwright/test'
import process from 'node:process'

const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const LOCALES = flag('locales', 'fr,en,nl,de,es,ar').split(',')
const HEADED = process.argv.includes('--headed')

/** A raw i18n key that reached the page instead of a sentence. */
const RAW_KEY = /(?:^|[\s>"'])((?:common|nav|cart|checkout|product|products|account|auth|admin|footer|home|faq|about|cgv|privacy|mentions|withdrawal|contact|market|markets|errors|legal|order_status|a11y|confirmation)\.[a-z0-9_]+)(?:[\s<"']|$)/

/** Console noise that is not ours and must not fail a run. */
const IGNORABLE =
  /WebGL|OTS parsing|powerPreference|requestAdapter|No available adapters|runtime\.lastError|challenges\.cloudflare|Download the Vue Devtools|third-party cookie/i

const findings = []
const record = (severity, area, detail) => findings.push({ severity, area, detail })

/** Pages every locale must serve. Auth-gated ones are checked for a sane redirect. */
const PUBLIC_PAGES = [
  '/',
  '/produits',
  '/panier',
  '/commande',
  '/contact',
  '/faq',
  '/a-propos',
  '/cgv',
  '/mentions-legales',
  '/politique-confidentialite',
  '/retractation',
  '/impressum',
  '/batteries',
  '/connexion',
  '/inscription',
]

const MACHINE_ROUTES = [
  '/sitemap.xml',
  '/robots.txt',
  '/llms.txt',
  '/llms-full.txt',
  '/feeds/google-merchant.xml',
  '/feeds/google-merchant-nl.xml',
  '/feeds/google-merchant-de.xml',
  '/feeds/google-merchant-es.xml',
]

function localised(path, locale) {
  if (locale === 'fr') return path
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

async function watch(page, label) {
  page.on('console', (msg) => {
    const text = msg.text()
    if (IGNORABLE.test(text)) return
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
  const url = BASE + localised(path, locale)
  const label = `${locale}${path}`
  const page = await context.newPage()
  await watch(page, label)

  let status = 0
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    status = res?.status() ?? 0
  } catch (e) {
    record('high', label, `navigation failed: ${String(e).slice(0, 120)}`)
    await page.close()
    return
  }
  await page.waitForTimeout(1800)

  if (status >= 400) record('high', label, `page returned ${status}`)

  const title = await page.title()
  if (!title || title.trim().length < 3) record('medium', label, 'no page title')
  if (RAW_KEY.test(title)) record('high', label, `title is a raw key: ${title}`)

  const body = await page.locator('body').innerText().catch(() => '')
  const rawInBody = body.match(RAW_KEY)
  if (rawInBody) record('high', label, `raw translation key rendered: ${rawInBody[1]}`)

  // An empty page that answers 200 is a soft 404 to a crawler.
  if (body.replace(/\s+/g, '').length < 120) record('high', label, 'page body is essentially empty')

  const lang = await page.getAttribute('html', 'lang')
  if (lang && !lang.startsWith(locale)) record('medium', label, `html lang is "${lang}", expected ${locale}`)

  const canonical = await page.getAttribute('link[rel=canonical]', 'href').catch(() => null)
  if (!canonical) record('medium', label, 'no canonical link')

  await page.close()
}

async function checkMachineRoutes(context) {
  for (const path of MACHINE_ROUTES) {
    const page = await context.newPage()
    try {
      const res = await page.goto(BASE + path, { timeout: 30_000 })
      const status = res?.status() ?? 0
      const text = await res?.text().catch(() => '')
      if (status !== 200) record('high', path, `returned ${status}`)
      else if (!text || text.length < 80) record('high', path, `served ${text.length} bytes — effectively empty`)
      else if (path.endsWith('.xml') && !text.trimStart().startsWith('<?xml')) {
        record('high', path, 'not XML')
      }
    } catch (e) {
      record('high', path, `failed: ${String(e).slice(0, 110)}`)
    }
    await page.close()
  }
}

/**
 * The money path. The one journey where a defect costs an order rather than a
 * ranking, so it is walked rather than sampled.
 */
async function checkPurchasePath(context) {
  const page = await context.newPage()
  await watch(page, 'purchase')

  await page.goto(`${BASE}/produits`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const firstProduct = page.locator('a[href*="/produits/"]').first()
  if ((await firstProduct.count()) === 0) {
    record('high', 'purchase', 'no product links on the listing page')
    await page.close()
    return
  }
  const href = await firstProduct.getAttribute('href')
  await page.goto(BASE + href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // The price the customer is shown, which every later screen must match.
  const pdpPrice = (await page.locator('body').innerText()).match(/(\d[\d\s  .,]*)\s*€/)
  const shown = pdpPrice ? pdpPrice[1].replace(/[\s  ]/g, '') : null
  if (!shown) record('high', 'purchase', 'no price on the product page')

  const addBtn = page
    .locator('button')
    .filter({ hasText: /panier|cart|winkelwagen|warenkorb|carrito|السلة/i })
    .first()
  if ((await addBtn.count()) === 0) {
    record('high', 'purchase', 'no add-to-cart button on the product page')
    await page.close()
    return
  }
  await addBtn.click().catch((e) => record('high', 'purchase', `add to cart failed: ${String(e).slice(0, 100)}`))
  await page.waitForTimeout(2000)

  await page.goto(`${BASE}/panier`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const cartText = await page.locator('body').innerText()
  if (/vide|empty|leeg|leer|vacío|فارغ/i.test(cartText)) {
    record('high', 'purchase', 'basket is empty after adding a product')
  }
  if (shown && !cartText.replace(/[\s  ]/g, '').includes(shown)) {
    record('high', 'purchase', `basket price differs from the product page (${shown} not found)`)
  }

  await page.goto(`${BASE}/commande`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const inputs = await page.locator('form input, input[required]').count()
  if (inputs === 0) record('high', 'purchase', 'checkout shows no address fields')

  await page.close()
}

const browser = await chromium.launch({ headless: !HEADED })
const context = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris' })

/**
 * Is there a catalogue at all?
 *
 * Run against a machine without a Sanity token, everything that reads the
 * catalogue fails — and reporting those as site defects would make this tool
 * cry wolf until nobody read its output. So the state is established once, and
 * catalogue-dependent findings are demoted to information rather than dropped.
 */
let catalogueAvailable = false
{
  const page = await context.newPage()
  try {
    const res = await page.goto(`${BASE}/api/catalog/products?perPage=1`, { timeout: 20_000 })
    const body = await res?.text().catch(() => '')
    catalogueAvailable = (res?.status() ?? 0) === 200 && /"items"\s*:\s*\[\s*\{/.test(body)
  } catch { /* stays false */ }
  await page.close()
}

console.log(`\nSimulating ${BASE} — ${LOCALES.length} locale(s), ${PUBLIC_PAGES.length} pages each`)
console.log(
  catalogueAvailable
    ? '  catalogue: reachable\n'
    : '  catalogue: UNREACHABLE — catalogue-dependent findings will be reported as info\n'
)

for (const locale of LOCALES) {
  process.stdout.write(`  ${locale} `)
  for (const path of PUBLIC_PAGES) {
    await checkPage(context, path, locale)
    process.stdout.write('.')
  }
  process.stdout.write('\n')
}

process.stdout.write('  machine routes ')
await checkMachineRoutes(context)
process.stdout.write('done\n')

process.stdout.write('  purchase path ')
await checkPurchasePath(context)
process.stdout.write('done\n')

await browser.close()

// A finding that exists only because this environment has no catalogue is
// information, not a defect. Demoted rather than dropped, so a genuine
// catalogue outage in production still shows up.
const CATALOGUE_DEPENDENT = /feeds[/]|no product links|basket is empty|price on the product page|add-to-cart/i
if (!catalogueAvailable) {
  for (const f of findings) {
    if (CATALOGUE_DEPENDENT.test(`${f.area} ${f.detail}`)) f.severity = 'info'
  }
}

const high = findings.filter((f) => f.severity === 'high')
const medium = findings.filter((f) => f.severity === 'medium')
const info = findings.filter((f) => f.severity === 'info')

console.log(`\n${'─'.repeat(70)}`)
if (findings.length === 0) {
  console.log('✅ Nothing found.')
  process.exit(0)
}

const show = (list, heading) => {
  if (list.length === 0) return
  console.log(`\n${heading} (${list.length})`)
  const byArea = new Map()
  for (const f of list) {
    const key = `${f.area} :: ${f.detail}`
    byArea.set(key, (byArea.get(key) ?? 0) + 1)
  }
  for (const [key, count] of byArea) console.log(`   ${key}${count > 1 ? `  ×${count}` : ''}`)
}

show(high, '🔴 HIGH')
show(medium, '🟠 MEDIUM')
show(info, 'ℹ️  INFO — no catalogue in this environment, not a site defect')

console.log('')
process.exit(high.length > 0 ? 1 : 0)
