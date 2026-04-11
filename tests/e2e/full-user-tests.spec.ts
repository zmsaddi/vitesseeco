import { test, expect } from '@playwright/test'

const BASE = process.env.TEST_BASE_URL || 'https://vitesseeco.vercel.app'
const LOAD = { waitUntil: 'domcontentloaded' as const, timeout: 30_000 }

// ══════════════════════════════════════════════════════════════════
// HOMEPAGE
// ══════════════════════════════════════════════════════════════════

test.describe('Homepage', () => {
  test('loads with title, hero, header, footer', async ({ page }) => {
    await page.goto(BASE, LOAD)
    await expect(page).toHaveTitle(/Vitesse Eco/)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
  })

  test('trust badges visible', async ({ page }) => {
    await page.goto(BASE, LOAD)
    await expect(page.locator('text=/Paiement|payment/i').first()).toBeVisible({ timeout: 5_000 })
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto(BASE, LOAD)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })

  test('meta description exists', async ({ page }) => {
    await page.goto(BASE, LOAD)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/)
  })

  test('OG tags present', async ({ page }) => {
    await page.goto(BASE, LOAD)
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Vitesse/)
  })
})

// ══════════════════════════════════════════════════════════════════
// PRODUCTS LISTING
// ══════════════════════════════════════════════════════════════════

test.describe('Products Listing', () => {
  test('page loads with h1', async ({ page }) => {
    await page.goto(`${BASE}/produits`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('type filter updates URL', async ({ page }) => {
    await page.goto(`${BASE}/produits`, LOAD)
    await page.waitForTimeout(2_000)
    const bikesTab = page.locator('button').filter({ hasText: '🚲' }).first()
    if (await bikesTab.isVisible({ timeout: 5_000 })) {
      await bikesTab.click()
      await page.waitForTimeout(500)
      expect(page.url()).toContain('type=bike')
    }
  })

  test('search updates URL with debounce', async ({ page }) => {
    await page.goto(`${BASE}/produits`, LOAD)
    await page.waitForTimeout(2_000)
    const searchInput = page.locator('input[placeholder]').first()
    if (await searchInput.isVisible({ timeout: 5_000 })) {
      await searchInput.fill('ouxi')
      await page.waitForTimeout(500)
      expect(page.url()).toContain('q=ouxi')
    }
  })

  test('sort updates URL', async ({ page }) => {
    await page.goto(`${BASE}/produits`, LOAD)
    await page.waitForTimeout(2_000)
    const sortSelect = page.locator('select').last()
    if (await sortSelect.isVisible({ timeout: 5_000 })) {
      await sortSelect.selectOption('price_asc')
      await page.waitForTimeout(300)
      expect(page.url()).toContain('sort=price_asc')
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// PRODUCT DETAIL
// ══════════════════════════════════════════════════════════════════

test.describe('Product Detail', () => {
  const PRODUCT = `${BASE}/produits/ouxi-v8-ultra-mini-noir`

  test('loads with name, price, image', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=€').first()).toBeVisible()
    await expect(page.locator('img[alt]').first()).toBeVisible()
  })

  test('breadcrumb visible', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('nav').filter({ hasText: /Accueil|Home/ }).first()).toBeVisible()
  })

  test('specifications section visible', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=/Fiche Technique|Specifications/i').first()).toBeVisible()
  })

  test('other colors section shows color dots', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    const dots = page.locator('a.rounded-full[style*="background"]')
    expect(await dots.count()).toBeGreaterThan(0)
  })

  test('JSON-LD Product schema present', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    const jsonLd = page.locator('script[type="application/ld+json"]')
    expect(await jsonLd.count()).toBeGreaterThan(0)
    const content = await jsonLd.first().textContent()
    expect(content).toContain('"@type"')
  })

  test('action button visible (add to cart or out of stock)', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    const btn = page.locator('button').filter({ hasText: /panier|cart|stock/i }).first()
    await expect(btn).toBeVisible()
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })

  test('all images have alt text', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    const missing = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).filter(i => !i.alt && !i.closest('[aria-hidden]')).length
    )
    expect(missing).toBe(0)
  })

  test('buttons have accessible names', async ({ page }) => {
    await page.goto(PRODUCT, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    const unlabeled = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).filter(b => !b.textContent?.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length
    )
    expect(unlabeled).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════
// CART
// ══════════════════════════════════════════════════════════════════

test.describe('Cart', () => {
  test('empty cart shows message and CTA', async ({ page }) => {
    await page.goto(`${BASE}/panier`, LOAD)
    await expect(page.locator('text=/vide|empty/i').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('a[href*="/produits"]').first()).toBeVisible()
  })
})

// ══════════════════════════════════════════════════════════════════
// CHECKOUT
// ══════════════════════════════════════════════════════════════════

test.describe('Checkout', () => {
  test('empty cart state on checkout', async ({ page }) => {
    await page.goto(`${BASE}/commande`, LOAD)
    await expect(page.locator('h1').or(page.locator('text=/vide|empty/i')).first()).toBeVisible({ timeout: 10_000 })
  })
})

// ══════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════

test.describe('Auth Pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto(`${BASE}/connexion`, LOAD)
    await expect(page.locator('h1').or(page.locator('h2')).first()).toBeVisible({ timeout: 15_000 })
  })

  test('register page loads', async ({ page }) => {
    await page.goto(`${BASE}/inscription`, LOAD)
    await expect(page.locator('h1').or(page.locator('h2')).first()).toBeVisible({ timeout: 15_000 })
  })

  test('account page requires auth', async ({ page }) => {
    await page.goto(`${BASE}/compte`, LOAD)
    await page.waitForTimeout(3_000)
    const url = page.url()
    expect(url.includes('connexion') || url.includes('login') || await page.locator('input[type="password"]').isVisible()).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// CONTENT PAGES
// ══════════════════════════════════════════════════════════════════

test.describe('Content Pages', () => {
  test('blog', async ({ page }) => {
    await page.goto(`${BASE}/blog`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('FAQ with category tabs', async ({ page }) => {
    await page.goto(`${BASE}/faq`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('button').filter({ hasText: /Toutes|All/ }).first()).toBeVisible()
  })

  test('guide', async ({ page }) => {
    await page.goto(`${BASE}/guide`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('about with SIREN', async ({ page }) => {
    await page.goto(`${BASE}/a-propos`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=100 732 247').first()).toBeVisible()
  })

  test('contact page loads', async ({ page }) => {
    await page.goto(`${BASE}/contact`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
  })

  test('comparatif', async ({ page }) => {
    await page.goto(`${BASE}/comparatif`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })
})

// ══════════════════════════════════════════════════════════════════
// LEGAL
// ══════════════════════════════════════════════════════════════════

test.describe('Legal Pages', () => {
  test('mentions légales', async ({ page }) => {
    await page.goto(`${BASE}/mentions-legales`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('privacy policy', async ({ page }) => {
    await page.goto(`${BASE}/politique-confidentialite`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  test('CGV', async ({ page }) => {
    await page.goto(`${BASE}/cgv`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })
})

// ══════════════════════════════════════════════════════════════════
// SEO
// ══════════════════════════════════════════════════════════════════

test.describe('SEO', () => {
  test('sitemap.xml valid with hreflang', async ({ request }) => {
    const res = await request.get(`${BASE}/api/sitemap.xml`)
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body).toContain('hreflang')
  })

  test('robots.txt exists', async ({ request }) => {
    expect((await request.get(`${BASE}/robots.txt`)).status()).toBe(200)
  })

  test('canonical + hreflang links on homepage', async ({ page }) => {
    await page.goto(BASE, LOAD)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /vitesse-eco/)
    expect(await page.locator('link[hreflang]').count()).toBeGreaterThanOrEqual(5)
  })
})

// ══════════════════════════════════════════════════════════════════
// i18n
// ══════════════════════════════════════════════════════════════════

test.describe('i18n', () => {
  test('English', async ({ page }) => { await page.goto(`${BASE}/en`, LOAD); await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 }) })
  test('Spanish', async ({ page }) => { await page.goto(`${BASE}/es`, LOAD); await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 }) })
  test('German', async ({ page }) => { await page.goto(`${BASE}/de`, LOAD); await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 }) })
  test('Dutch', async ({ page }) => { await page.goto(`${BASE}/nl`, LOAD); await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 }) })
  test('Arabic with RTL', async ({ page }) => {
    await page.goto(`${BASE}/ar`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
    expect(await page.locator('[dir="rtl"]').count()).toBeGreaterThan(0)
  })
  test('language switcher visible', async ({ page }) => {
    await page.goto(BASE, LOAD)
    await expect(page.locator('button').filter({ hasText: /🇫🇷|FR/ }).first()).toBeVisible({ timeout: 5_000 })
  })
})

// ══════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ══════════════════════════════════════════════════════════════════

test.describe('API', () => {
  test('shipping methods', async ({ request }) => {
    const r = await request.get(`${BASE}/api/shipping/methods?zone=FR`)
    expect(r.status()).toBe(200)
    expect((await r.json()).methods).toBeDefined()
  })

  test('payment methods', async ({ request }) => {
    const r = await request.get(`${BASE}/api/payment/methods`)
    expect(r.status()).toBe(200)
    expect((await r.json()).methods).toBeDefined()
  })

  test('cart validate rejects empty', async ({ request }) => {
    expect((await request.post(`${BASE}/api/cart/validate`, { data: { items: [] } })).status()).toBe(400)
  })

  test('contact rejects missing fields', async ({ request }) => {
    expect((await request.post(`${BASE}/api/contact`, { data: { name: '' } })).status()).toBe(400)
  })

  test('auth/me rejects unauthenticated', async ({ request }) => {
    expect((await request.get(`${BASE}/api/auth/me`)).status()).toBe(401)
  })

  test('my-orders rejects unauthenticated', async ({ request }) => {
    expect((await request.get(`${BASE}/api/orders/my-orders`)).status()).toBe(401)
  })

  test('login rejects wrong password', async ({ request }) => {
    expect((await request.post(`${BASE}/api/auth/login`, { data: { email: 'fake@test.com', password: 'wrong' } })).status()).toBe(401)
  })

  test('delete-account rejects unauthenticated', async ({ request }) => {
    expect((await request.post(`${BASE}/api/auth/delete-account`, { data: {} })).status()).toBe(401)
  })
})

// ══════════════════════════════════════════════════════════════════
// SECURITY
// ══════════════════════════════════════════════════════════════════

test.describe('Security', () => {
  test('security headers present', async ({ request }) => {
    const h = (await request.get(BASE)).headers()
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('CSP header present', async ({ request }) => {
    const csp = (await request.get(BASE)).headers()['content-security-policy']
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
  })

  test('rate limiting works on contact endpoint', async ({ request }) => {
    const results = []
    for (let i = 0; i < 7; i++) {
      results.push((await request.post(`${BASE}/api/contact`, { data: { name: 'test' } })).status())
    }
    expect(results).toContain(429)
  })
})

// ══════════════════════════════════════════════════════════════════
// MOBILE (small viewport)
// ══════════════════════════════════════════════════════════════════

test.describe('Mobile Viewport', () => {
  test('homepage no overflow', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.goto(BASE, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    await ctx.close()
  })

  test('product page no overflow + image visible', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/produits/ouxi-v8-ultra-mini-noir`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    await expect(page.locator('img[alt]').first()).toBeVisible()
    await ctx.close()
  })

  test('color dots tappable size >= 40px', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/produits/ouxi-v8-ultra-mini-noir`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
    const dots = page.locator('span.rounded-full[style*="background"], a.rounded-full[style*="background"]')
    if (await dots.count() > 0) {
      const box = await dots.first().boundingBox()
      if (box) { expect(box.width).toBeGreaterThanOrEqual(40); expect(box.height).toBeGreaterThanOrEqual(40) }
    }
    await ctx.close()
  })

  test('empty cart message', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/panier`, LOAD)
    await expect(page.locator('text=/vide|empty/i').first()).toBeVisible({ timeout: 10_000 })
    await ctx.close()
  })
})

// ══════════════════════════════════════════════════════════════════
// PERFORMANCE
// ══════════════════════════════════════════════════════════════════

test.describe('Performance', () => {
  test('homepage under 5 seconds', async ({ page }) => {
    const t = Date.now()
    await page.goto(BASE, LOAD)
    expect(Date.now() - t).toBeLessThan(5_000)
  })

  test('product page under 5 seconds', async ({ page }) => {
    const t = Date.now()
    await page.goto(`${BASE}/produits/ouxi-v8-ultra-mini-noir`, LOAD)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
    expect(Date.now() - t).toBeLessThan(5_000)
  })

  test('no console errors on homepage', async ({ page }) => {
    const errs: string[] = []
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    await page.goto(BASE, LOAD)
    await page.waitForTimeout(2_000)
    expect(errs.filter(e => !e.includes('favicon') && !e.includes('404') && !e.includes('blocked') && !e.includes('ERR_'))).toEqual([])
  })
})
