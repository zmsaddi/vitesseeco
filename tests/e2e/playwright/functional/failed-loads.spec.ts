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
import { test, expect } from '../helpers/test'
import { message } from '../helpers/messages'
import { signUp } from '../helpers/requests'

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
