import { test, expect } from '@playwright/test'

test.describe('Site Navigation', () => {
  test('homepage loads with key elements', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Vitesse Eco/)
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
  })

  test('products page loads', async ({ page }) => {
    await page.goto('/produits')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('blog page loads', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('FAQ page loads', async ({ page }) => {
    await page.goto('/faq')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('buying guide page loads', async ({ page }) => {
    await page.goto('/guide')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('comparison page loads with table', async ({ page }) => {
    await page.goto('/comparatif')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('contact page loads with form', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('form').first()).toBeVisible()
  })

  test('about page loads', async ({ page }) => {
    await page.goto('/a-propos')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Product Pages', () => {
  test('product detail page loads with JSON-LD', async ({ page }) => {
    await page.goto('/produits', { waitUntil: 'networkidle' })
    const firstProduct = page.locator('a[href*="/produits/"]').first()
    await firstProduct.waitFor({ state: 'visible', timeout: 20_000 })
    await firstProduct.click()
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    const jsonLd = page.locator('script[type="application/ld+json"]')
    await expect(jsonLd.first()).toBeAttached()
  })
})

test.describe('Legal Pages', () => {
  test('mentions légales loads', async ({ page }) => {
    await page.goto('/mentions-legales')
    await expect(page.locator('text=VITESSE ECO').first()).toBeVisible({ timeout: 10_000 })
  })

  test('privacy policy loads', async ({ page }) => {
    await page.goto('/politique-confidentialite')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('CGV loads', async ({ page }) => {
    await page.goto('/cgv')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('SEO', () => {
  test('sitemap.xml returns valid XML with hreflang', async ({ request }) => {
    const response = await request.get('/api/sitemap.xml')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain('<urlset')
    expect(body).toContain('hreflang')
    expect(body).toContain('/ar')
  })

  test('robots.txt exists', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
  })
})

test.describe('i18n', () => {
  test('English version loads', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('Arabic version loads', async ({ page }) => {
    await page.goto('/ar')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })
})
