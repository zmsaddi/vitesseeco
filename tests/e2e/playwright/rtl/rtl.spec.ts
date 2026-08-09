/**
 * Arabic is a first-class storefront, not a dir attribute.
 *
 * `dir="rtl"` on <html> proves nothing on its own, so the assertions here are
 * geometric and content-level: the shell actually mirrors, the things that
 * must NOT mirror stay put (logo artwork, digits, phone numbers), and the
 * funnel pages carry their Arabic content end to end.
 */
import { test, expect } from '../helpers/test'
import { displayDecimal, displayProduct } from '../helpers/catalogue'

async function centerX(locator: import('@playwright/test').Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no box')
  return box.x + box.width / 2
}

/**
 * Click a control whose handler Vue attaches at hydration. A click that lands
 * on the server-rendered button before hydration does nothing — the exact
 * false negative the old simulator produced — so the click retries until the
 * thing it opens is actually there.
 */
async function openUntilVisible(
  page: import('@playwright/test').Page,
  buttonName: string,
  opened: import('@playwright/test').Locator
): Promise<void> {
  await expect(async () => {
    if (await opened.isVisible()) return
    await page.getByRole('button', { name: buttonName }).click()
    await expect(opened).toBeVisible({ timeout: 1_500 })
  }).toPass({ timeout: 20_000 })
}

test('the html element declares Arabic and rtl', async ({ page }) => {
  await page.goto('/ar')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  // And French declares the opposite — the attribute is per-locale, not global.
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
})

test('the header mirrors: brand and basket swap sides', async ({ page }) => {
  await page.goto('/')
  const brand = page.locator('header a[href="/"]').first()
  const cartFr = page.locator('header a[href$="/panier"]')
  expect(await centerX(brand)).toBeLessThan(await centerX(cartFr))

  await page.goto('/ar')
  const brandAr = page.locator('header a[href="/ar"]').first()
  const cartAr = page.locator('header a[href$="/panier"]')
  expect(await centerX(brandAr)).toBeGreaterThan(await centerX(cartAr))
})

test('inline icon/text order mirrors in the mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/')
  const rowFr = page.locator('header nav a[href$="/favoris"]')
  await openUntilVisible(page, 'Ouvrir le menu', rowFr)
  const iconFr = rowFr.locator('span, svg').first()
  expect(await centerX(iconFr)).toBeLessThan(await centerX(rowFr))

  await page.goto('/ar')
  const rowAr = page.locator('header nav a[href$="/favoris"]')
  await openUntilVisible(page, 'فتح القائمة', rowAr)
  const iconAr = rowAr.locator('span, svg').first()
  expect(await centerX(iconAr)).toBeGreaterThan(await centerX(rowAr))
})

test('the brand artwork itself is never mirrored', async ({ page }) => {
  await page.goto('/ar')
  const marks = page.locator('header a svg')
  const count = await marks.count()
  expect(count).toBeGreaterThan(0)
  for (let index = 0; index < count; index++) {
    const transform = await marks
      .nth(index)
      .evaluate((element) => getComputedStyle(element).transform)
    expect(transform === 'none' || !transform.includes('-1')).toBe(true)
  }
})

test('the Arabic funnel carries Arabic content: PDP, basket, checkout shell', async ({
  page,
  seedCart,
}) => {
  await seedCart([{ productId: displayProduct._id, quantity: 1 }])

  await page.goto(`/ar/produits/${displayProduct.slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(displayProduct.name.ar)
  await expect(page.getByRole('button', { name: 'أضف إلى السلة' }).first()).toBeVisible()

  const priced = page.waitForResponse('**/api/cart/price')
  await page.goto('/ar/panier')
  const body = (await (await priced).json()) as { total: string }
  await expect(page.getByRole('heading', { name: 'سلتك' })).toBeVisible()
  await expect(page.getByText(displayProduct.name.ar).first()).toBeVisible()
  // The price renders in the Arabic number system, in logical digit order —
  // computed with the same Intl contract the app pins, so this is byte-exact.
  await expect(page.getByText(displayDecimal(body.total, 'ar')).first()).toBeVisible()

  await page.goto('/ar/commande')
  await expect(page.getByRole('heading', { name: 'إتمام الطلب' })).toBeVisible()
  await expect(page.locator('input[autocomplete="postal-code"]')).toBeVisible()
})

test('phone numbers stay left-to-right inside Arabic pages', async ({ page }) => {
  await page.goto('/ar/contact')
  const phones = page.locator('a[href^="tel:"]')
  expect(await phones.count()).toBeGreaterThan(0)
  // The number is wrapped in an explicit LTR isolate; without it, bidi would
  // reorder "+33 7 45…" around the plus sign.
  const isolated = page.locator('a[href^="tel:"] bdi, a[href^="tel:"] [dir="ltr"]')
  expect(await isolated.count()).toBeGreaterThan(0)
})

test('the language switcher popover aligns to its logical end', async ({ page }) => {
  await page.goto('/')
  const popFr = page.locator('header ul.absolute')
  await openUntilVisible(page, 'Changer de langue', popFr)
  const trigger = page.getByRole('button', { name: 'Changer de langue' })
  const popBoxFr = await popFr.boundingBox()
  const triggerBoxFr = await trigger.boundingBox()
  // LTR: the popover's right edge tracks the trigger's right edge.
  expect(Math.abs(popBoxFr!.x + popBoxFr!.width - (triggerBoxFr!.x + triggerBoxFr!.width))).toBeLessThan(8)

  await page.goto('/ar')
  const popAr = page.locator('header ul.absolute')
  await openUntilVisible(page, 'تغيير اللغة', popAr)
  const triggerAr = page.getByRole('button', { name: 'تغيير اللغة' })
  const popBoxAr = await popAr.boundingBox()
  const triggerBoxAr = await triggerAr.boundingBox()
  // RTL: end-0 must resolve to the LEFT edge instead.
  expect(Math.abs(popBoxAr!.x - triggerBoxAr!.x)).toBeLessThan(8)
})
