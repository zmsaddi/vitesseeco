import { chromium } from '@playwright/test'

const BASE = 'http://127.0.0.1:3141'
const OUT = '.simshots'
const ledger = []
const log = (step, facts) => { ledger.push({ step, ...facts }); console.log('##', step, JSON.stringify(facts)) }

async function walk(deviceName, viewport, isMobile) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  const page = await ctx.newPage()
  const shot = (name) => page.screenshot({ path: `${OUT}/${deviceName}-${name}.png`, fullPage: false })

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await shot('1-home')
  const heroText = await page.locator('h1').first().innerText().catch(() => '(no h1)')
  const ctas = await page.locator('a:visible, button:visible').filter({ hasText: /voir|decouvrir|acheter|produits|boutique/i }).count()
  log(deviceName + ': landing', { h1: heroText.slice(0, 60), visibleBuyCtas: ctas })

  const toShop = page.locator('a[href$="/produits"]').first()
  const shopVisible = await toShop.isVisible().catch(() => false)
  if (shopVisible) await toShop.click()
  else await page.goto(BASE + '/produits')
  await page.waitForTimeout(2500)
  await shot('2-listing')
  const cards = await page.locator('a[href*="/produits/"]').count()
  const pricesShown = await page.locator('text=/\d+\s*€/').count()
  const filters = await page.locator('select:visible, input[type=checkbox]:visible').count()
  log(deviceName + ': listing', { productLinks: cards, pricesVisible: pricesShown, filterControls: filters, oneClickFromHome: shopVisible })

  await page.locator('a[href*="/produits/"]').first().click()
  await page.waitForTimeout(2500)
  await shot('3-product')
  const body = await page.locator('body').innerText()
  const hasPrice = /\d+\s*€/.test(body)
  const stockWord = /en stock|disponible|stock/i.test(body)
  const addBtn = page.locator('button').filter({ hasText: /panier/i }).first()
  const addVisible = await addBtn.isVisible().catch(() => false)
  let addAboveFold = false
  if (addVisible) { const bb = await addBtn.boundingBox(); addAboveFold = !!bb && bb.y < viewport.height }
  log(deviceName + ': product', { priceVisible: hasPrice, stockShown: stockWord, addToCartVisible: addVisible, addAboveFold })

  if (addVisible) { await addBtn.click(); await page.waitForTimeout(1500) }
  await shot('4-added')

  await page.goto(BASE + '/panier')
  await page.waitForTimeout(2500)
  await shot('5-cart')
  const cartBody = await page.locator('body').innerText()
  const totalShown = /total/i.test(cartBody) && /\d+\s*€/.test(cartBody)
  const checkoutBtn = page.locator('a[href*="/commande"], button').filter({ hasText: /commander|commande|checkout/i }).first()
  const checkoutVisible = await checkoutBtn.isVisible().catch(() => false)
  log(deviceName + ': cart', { totalShown, checkoutCtaVisible: checkoutVisible })

  if (checkoutVisible) await checkoutBtn.click()
  else await page.goto(BASE + '/commande')
  await page.waitForTimeout(3500)
  await shot('6-checkout-top')
  const inputs = await page.locator('form input:visible, form select:visible, form textarea:visible').count()
  const radios = await page.locator('input[type=radio]:visible').count()
  const ctext = await page.locator('body').innerText()
  const guestPossible = !/connexion obligatoire|devez vous connecter/i.test(ctext)
  await page.keyboard.press('End'); await page.waitForTimeout(800)
  await shot('7-checkout-bottom')
  const submit = page.locator('button').filter({ hasText: /confirmer|payer|valider|commander/i }).last()
  const submitVisible = await submit.isVisible().catch(() => false)
  log(deviceName + ': checkout', { visibleFields: inputs, choiceRadios: radios, guestPossible, submitFound: submitVisible })

  await browser.close()
}

await walk('desktop', { width: 1366, height: 768 }, false)
await walk('mobile', { width: 390, height: 844 }, true)
console.log('LEDGER=' + JSON.stringify(ledger))
