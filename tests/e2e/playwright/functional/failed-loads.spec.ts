/**
 * A request that failed is not an empty answer.
 *
 * The pages read only the data a fetch returned, and Nuxt empties it when the
 * fetch fails — so a refusal or an outage drew each page's empty state: an
 * admin panel with "Aucun produit.", an account with no orders, a catalogue
 * with no results, a checkout that did not deliver to Poitiers, a customer
 * signed out by a database blip. Each test here makes a request fail on
 * purpose and reads what the page then says.
 *
 * The failure is a 429 (see `rateLimited`). A page whose first render happens
 * on the server is reached through the app's own router, so that its request
 * is the browser's and can be answered.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../helpers/test'
import { displayPrice, displayProduct } from '../helpers/catalogue'
import { message, messagePattern } from '../helpers/messages'
import { navigateInApp, rateLimited, signUp } from '../helpers/requests'

/** What every refusal below reads as: the server's own rate-limit sentence, with its wait. */
const REFUSED = messagePattern('errors.rate_limited_for', 'wait', '1 minute')

/** Refuse every request whose path matches, until the function this returns is called. */
async function refuse(page: Page, pathname: (path: string) => boolean): Promise<() => Promise<void>> {
  const matches = (url: URL): boolean => pathname(url.pathname)
  await page.route(matches, (route) => route.fulfill(rateLimited(new URL(route.request().url()).pathname)))
  return () => page.unroute(matches)
}

test('an admin page that is refused says so, rather than drawing an empty shop', async ({ page }) => {
  test.setTimeout(120_000)
  // Signed in and not on the allowlist, so every admin request answers 403 —
  // the answer an allowlisted address also gets until its Google sign-in. The
  // pages read only `data`, and showed "Aucun produit.", "Aucune commande.",
  // "Aucun message." with the reason nowhere.
  await signUp(page)

  for (const [path, empty] of [
    ['/admin', null],
    ['/admin/stock', 'admin.no_products'],
    ['/admin/commandes', 'admin.no_orders'],
    ['/admin/commandes/ORD-PW000001', 'admin.no_orders'],
    ['/admin/messages', 'admin.no_messages'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('alert').filter({ hasText: message('errors.forbidden') })).toBeVisible()
    if (empty) await expect(page.getByText(message(empty))).toHaveCount(0)
  }
})

test('the admin search asks once typing pauses, not at every keystroke', async ({ page }) => {
  test.setTimeout(120_000)
  // Each keystroke was a request of its own, against a budget of sixty a
  // minute that every save's refresh also draws on.
  await signUp(page)

  for (const [path, api] of [
    ['/admin/stock', '/api/admin/products'],
    ['/admin/commandes', '/api/admin/orders'],
  ] as const) {
    await page.goto(path)
    const asked: string[] = []
    const matches = (url: URL): boolean => url.pathname === api
    await page.route(matches, (route) => {
      asked.push(new URL(route.request().url()).searchParams.get('search') ?? '')
      return route.continue()
    })

    await page.locator('input[type=search]').pressSequentially('ouxi v8', { delay: 60 })
    await expect.poll(() => asked).toEqual(['ouxi v8'])
    // Nothing was queued behind it either.
    await page.waitForTimeout(1_000)
    expect(asked).toEqual(['ouxi v8'])
    await page.unroute(matches)
  }
})

test('checkout says when it could not ask about delivery, and asks again', async ({ page, seedCart }) => {
  test.setTimeout(120_000)
  await seedCart([{ productId: displayProduct._id, quantity: 1 }])
  await page.goto('/commande')

  // A lookup that failed drew "Pas de livraison à domicile ici" with no option
  // at all, collection included — to an address the shop delivers to.
  const allow = await refuse(page, (path) => path === '/api/catalog/shipping')
  await page.locator('input[autocomplete="postal-code"]').fill('86000')
  await expect(page.getByRole('alert')).toHaveText(REFUSED)
  await expect(page.getByText(message('checkout.no_delivery_here'))).toHaveCount(0)

  await allow()
  await page.getByRole('button', { name: message('common.retry') }).click()
  await expect(page.locator('input[type="radio"][value="pickup"]')).toBeVisible()
})

test('a postcode the server cannot read is said as such, with nothing to retry', async ({ page, seedCart }) => {
  test.setTimeout(120_000)
  await seedCart([{ productId: displayProduct._id, quantity: 1 }])
  await page.goto('/commande')

  // The town typed after the postcode: longer than any postcode the server
  // reads, and the page said the shop did not deliver there.
  await page.locator('input[autocomplete="postal-code"]').fill('86000 Poitiers')
  await expect(page.getByRole('alert')).toHaveText(message('errors.invalid_postal_code'))
  await expect(page.getByText(message('checkout.no_delivery_here'))).toHaveCount(0)
  // Asking again would only repeat it; correcting the field asks by itself.
  await expect(page.getByRole('button', { name: message('common.retry') })).toHaveCount(0)

  await page.locator('input[autocomplete="postal-code"]').fill('86000')
  await expect(page.locator('input[type="radio"][value="pickup"]')).toBeVisible()
})

test('a late answer for an earlier postcode does not replace the options on screen', async ({
  page,
  seedCart,
}) => {
  test.setTimeout(120_000)
  await seedCart([{ productId: displayProduct._id, quantity: 1 }])
  await page.goto('/commande')

  // The lookup for the postcode as it stood one keystroke earlier is held back,
  // then answers "nothing delivers here" — after the full postcode's answer.
  const early = (url: URL): boolean =>
    url.pathname === '/api/catalog/shipping' && url.searchParams.get('postalCode') === '8600'
  await page.route(early, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ methods: [] }) })
  })

  const postcode = page.locator('input[autocomplete="postal-code"]')
  await postcode.fill('8600')
  await postcode.fill('86000')
  await expect(page.locator('input[type="radio"][value="pickup"]')).toBeVisible()

  await page.waitForTimeout(2_500)
  await expect(page.locator('input[type="radio"][value="pickup"]')).toBeVisible()
  await expect(page.getByText(message('checkout.no_delivery_here'))).toHaveCount(0)
})

test('totals for an earlier delivery choice do not land over the current one', async ({ page, seedCart }) => {
  test.setTimeout(120_000)
  await seedCart([{ productId: displayProduct._id, quantity: 1 }])
  await page.goto('/commande')
  // Outside the 86: collection and paid delivery, nothing in between.
  await page.locator('input[autocomplete="postal-code"]').fill('75001')

  // The paid delivery's totals are held back, so they land after collection's.
  const paid = (url: URL): boolean => url.pathname === '/api/cart/price'
  await page.route(paid, async (route) => {
    const body = route.request().postDataJSON() as { shipping?: { methodCode?: string } }
    if (body.shipping?.methodCode === 'standard-fr') await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.continue()
  })

  await page.locator('input[type="radio"][value="standard-fr"]').check()
  await page.locator('input[type="radio"][value="pickup"]').check()
  const summary = page.locator('aside dl')
  await expect(summary).toContainText(message('checkout.free'))

  // Long enough for the held-back answer to arrive: collection stays free.
  await page.waitForTimeout(2_500)
  await expect(summary).toContainText(message('checkout.free'))
  await expect(summary).not.toContainText(displayPrice(19.9))
})

test('the account area says when it could not ask, instead of "signed out" or "nothing yet"', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await signUp(page)

  // Each step starts from a page loaded afresh, with no alert on it: the page
  // being left stays on screen until the next one is ready, and an alert it
  // still showed would answer an assertion meant for the next.
  await test.step('a failed address book is not an empty one', async () => {
    await page.goto('/compte')
    const allow = await refuse(page, (path) => path === '/api/account/addresses')
    await page.getByRole('link', { name: message('account.manage_addresses') }).click()
    await expect(page.getByRole('alert')).toHaveText(REFUSED)
    await expect(page.getByText(message('addresses.empty'))).toHaveCount(0)
    // Nor is the form opened to type in again an address that may be saved.
    await expect(page.getByRole('button', { name: message('addresses.save') })).toHaveCount(0)
    await allow()
  })

  await test.step('a failed order history is not an empty one', async () => {
    await page.goto('/compte/adresses')
    const allow = await refuse(page, (path) => path === '/api/account/orders')
    await navigateInApp(page, '/compte')
    await expect(page.getByRole('alert')).toHaveText(REFUSED)
    await expect(page.getByText(message('account.no_orders'))).toHaveCount(0)
    await allow()
  })

  await test.step('an order that could not be read is not "Introuvable."', async () => {
    await page.goto('/compte')
    const allow = await refuse(page, (path) => path.startsWith('/api/account/orders/'))
    await navigateInApp(page, '/compte/orders/ORD-PW000001')
    await expect(page.getByRole('alert')).toHaveText(REFUSED)
    await expect(page.getByText(message('errors.not_found'))).toHaveCount(0)
    await allow()

    // While one that is not there still says so.
    await navigateInApp(page, '/compte/orders/ORD-PW000002')
    await expect(page.getByText(message('errors.not_found'))).toBeVisible()
  })

  await test.step('a failed sign-out says so, and the customer stays where they are', async () => {
    await page.goto('/compte')
    const allow = await refuse(page, (path) => path === '/api/auth/logout')
    await page.getByRole('button', { name: message('account.sign_out') }).click()
    await expect(page.getByRole('alert')).toHaveText(REFUSED)
    await expect(page).toHaveURL(/\/compte$/)
    await allow()
  })

  await test.step('a session check that fails is not read as being signed out', async () => {
    // The guard sent every such failure to the login form, as a guest.
    await refuse(page, (path) => path === '/api/auth/me')
    await page.getByRole('link', { name: message('account.manage_addresses') }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(message('errors.rate_limited'))
    await expect(page).not.toHaveURL(/\/connexion/)
  })
})

test('a catalogue that could not be read is not "no results"', async ({ page }) => {
  await test.step('the product listing', async () => {
    await page.goto('/')
    const allow = await refuse(page, (path) => path === '/api/catalog/products')
    await navigateInApp(page, '/produits?q=velo')
    await expect(page.getByRole('alert')).toHaveText(REFUSED)
    await expect(page.getByText(message('products.no_results'))).toHaveCount(0)
    await allow()
  })

  await test.step('the comparison picker', async () => {
    await page.goto('/')
    const allow = await refuse(page, (path) => path === '/api/catalog/products')
    await navigateInApp(page, '/comparatif')
    await expect(page.getByRole('alert')).toHaveText(REFUSED)
    await expect(page.getByText(message('products.no_results'))).toHaveCount(0)
    await allow()
  })

  await test.step('the blog', async () => {
    await page.goto('/produits')
    const allow = await refuse(page, (path) => path === '/api/content/articles')
    await navigateInApp(page, '/blog')
    await expect(page.getByRole('alert')).toHaveText(REFUSED)
    await expect(page.getByText(message('blog.empty'))).toHaveCount(0)
    await allow()
  })
})

test('a comparison whose details could not be read is not "no longer available"', async ({ page }) => {
  await page.goto('/comparatif')
  // One of the two models answers; the other is refused.
  await refuse(page, (path) => path === '/api/catalog/products/fixture-velo-cargo-vert')
  const models = page.locator('button[aria-pressed]')
  await expect(models).toHaveCount(2)
  await models.nth(0).click()
  await models.nth(1).click()

  await expect(page.getByRole('alert')).toHaveText(REFUSED)
  await expect(page.getByText(message('compare.unavailable'))).toHaveCount(0)
})

test('an article that could not be read is not "page not found"', async ({ page }) => {
  // A 404 tells a search engine the article is gone; an afternoon with the
  // catalogue unreachable would have deindexed the blog. The product page
  // already answered 503 for this; the article page now does too.
  await page.goto('/blog')
  await refuse(page, (path) => path.startsWith('/api/content/articles/'))
  await page.locator('a[href$="/blog/fixture-entretenir-sa-batterie"]').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(message('errors.service_unavailable'))
  await expect(page.getByText('503')).toBeVisible()
})

test('saved products that could not be read say why', async ({ page, context }) => {
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    ['vitesse.wishlist.v1', JSON.stringify({ ids: [displayProduct._id] })]
  )
  await refuse(page, (path) => path === '/api/catalog/products')
  await page.goto('/favoris')

  // It said "Une erreur est survenue de notre côté." whatever the server said.
  await expect(page.getByRole('alert')).toHaveText(REFUSED)
  await expect(page.getByText(message('errors.internal'))).toHaveCount(0)
})
