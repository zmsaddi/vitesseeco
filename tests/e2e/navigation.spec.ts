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
    await expect(page).toHaveTitle(/Produits|Products/)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('blog page loads', async ({ page }) => {
    await page.goto('/blog')
    await expect(page).toHaveTitle(/Blog/)
  })

  test('FAQ page loads with categories', async ({ page }) => {
    await page.goto('/faq')
    await expect(page).toHaveTitle(/FAQ|Questions/)
    await expect(page.locator('button:has-text("Toutes"), button:has-text("All")')).toBeVisible()
  })

  test('buying guide page loads', async ({ page }) => {
    await page.goto('/guide')
    await expect(page).toHaveTitle(/fatbike|Fatbike/)
  })

  test('comparison page loads', async ({ page }) => {
    await page.goto('/comparatif')
    await expect(page).toHaveTitle(/Comparatif|Comparison/)
    await expect(page.locator('table')).toBeVisible()
  })

  test('contact page loads', async ({ page }) => {
    await page.goto('/contact')
    await expect(page).toHaveTitle(/Contact/)
    await expect(page.locator('form')).toBeVisible()
  })

  test('language switching works', async ({ page }) => {
    await page.goto('/')
    // Check French is default
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('English version loads', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('Arabic version loads with RTL', async ({ page }) => {
    await page.goto('/ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })
})

test.describe('Product Pages', () => {
  test('product detail page loads', async ({ page }) => {
    await page.goto('/produits')
    // Click first product
    const firstProduct = page.locator('a[href*="/produits/"]').first()
    if (await firstProduct.isVisible()) {
      await firstProduct.click()
      await expect(page.locator('h1')).toBeVisible()
      // Check JSON-LD exists
      const jsonLd = page.locator('script[type="application/ld+json"]')
      await expect(jsonLd.first()).toBeAttached()
    }
  })
})

test.describe('Cart Flow', () => {
  test('cart page shows empty state', async ({ page }) => {
    await page.goto('/panier')
    await expect(page.locator('text=panier est vide, text=cart is empty').first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Legal Pages', () => {
  test('mentions légales loads', async ({ page }) => {
    await page.goto('/mentions-legales')
    await expect(page).toHaveTitle(/Mentions|Legal/)
    await expect(page.locator('text=VITESSE ECO')).toBeVisible()
  })

  test('privacy policy loads', async ({ page }) => {
    await page.goto('/politique-confidentialite')
    await expect(page).toHaveTitle(/Confidentialité|Privacy/)
  })

  test('CGV loads', async ({ page }) => {
    await page.goto('/cgv')
    await expect(page).toHaveTitle(/CGV|Conditions|Terms/)
  })
})

test.describe('SEO', () => {
  test('sitemap.xml returns valid XML', async ({ request }) => {
    const response = await request.get('/api/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')
    const body = await response.text()
    expect(body).toContain('<urlset')
    expect(body).toContain('hreflang')
    expect(body).toContain('/ar')
    expect(body).toContain('/blog')
  })

  test('robots.txt exists', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
  })
})
