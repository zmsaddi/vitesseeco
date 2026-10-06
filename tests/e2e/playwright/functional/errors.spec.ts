/**
 * The customer is told what actually went wrong.
 *
 * Every page used to read the error payload one level too high and fell back
 * to "an error on our side" — a wrong password told the customer the shop was
 * broken. This drives the real form against the real route and reads the
 * message a person would read.
 */
import { test, expect } from '../helpers/test'
import { displayProduct } from '../helpers/catalogue'
import { message, messagePattern } from '../helpers/messages'
import { newAccount, post } from '../helpers/requests'

test('a wrong password says so, not that the shop failed', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/connexion')
  await page.locator('input[type=email]').fill('nobody-here@vitesse-eco.test')
  await page.locator('input[type=password]').fill('Wrong-Password-123!')
  const submit = page.locator('form button[type=submit]').first()
  // Turnstile's test key arms the button after a round trip.
  await expect(submit).toBeEnabled({ timeout: 30_000 })
  await submit.click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Email ou mot de passe incorrect')
  await expect(alert).not.toContainText('de notre côté')
})

test('signing up with an address that has an account says what to do, in words', async ({
  page,
  clientAddress,
}) => {
  test.setTimeout(90_000)
  const account = newAccount()
  const first = await page.request.post('/api/auth/register', {
    headers: { 'x-real-ip': clientAddress },
    data: { ...account, locale: 'fr', captchaToken: 'pw.DUMMY.TOKEN' },
  })
  expect(first.status()).toBe(200)
  // That call signed this context in; the second attempt is a visitor's.
  await page.context().clearCookies()

  await page.goto('/inscription')
  await page.locator('input[autocomplete="given-name"]').fill(account.firstName)
  await page.locator('input[autocomplete="family-name"]').fill(account.lastName)
  await page.locator('input[type=email]').fill(account.email)
  await page.locator('input[type=password]').fill(account.password)
  const submit = page.locator('form button[type=submit]')
  await expect(submit).toBeEnabled({ timeout: 30_000 })
  await submit.click()

  // The server's own key, translated — before the fix the page printed the
  // key itself under the email field.
  await expect(page.getByText(message('errors.email_unavailable'))).toBeVisible()
  await expect(page.getByText('errors.email_unavailable')).toHaveCount(0)
})

test('the address limit is stated in words, even from a page that is out of date', async ({ page }) => {
  test.setTimeout(120_000)
  const account = newAccount()
  await page.goto('/')
  expect(await post(page, '/api/auth/register', { ...account, locale: 'fr', captchaToken: 'pw.DUMMY.TOKEN' })).toBe(200)

  const address = {
    firstName: account.firstName,
    lastName: account.lastName,
    line1: 'Musterstrasse 1',
    postalCode: '1010',
    city: 'Wien',
    country: 'AT',
  }
  for (let i = 1; i <= 9; i++) {
    expect(await post(page, '/api/account/addresses', { ...address, label: `Adresse ${i}` })).toBe(200)
  }

  // Nine saved: the page offers the form. A tenth then arrives from another tab
  // or device, so the limit is reached behind this page's back.
  await page.goto('/compte/adresses')
  expect(await post(page, '/api/account/addresses', { ...address, label: 'Adresse 10' })).toBe(200)

  await page.getByRole('button', { name: message('addresses.add') }).click()
  await page.locator('input[autocomplete="address-line1"]').fill('Musterstrasse 1')
  await page.locator('input[autocomplete="postal-code"]').fill('86000')
  await page.locator('input[autocomplete="address-level2"]').fill('Poitiers')
  await page.getByRole('button', { name: message('addresses.save') }).click()

  await expect(page.getByRole('alert').first()).toHaveText(message('errors.too_many_addresses'))
  await expect(page.getByText('errors.too_many_addresses')).toHaveCount(0)
})

test('a field the server refuses is explained in the page language, never in zod English', async ({ page }) => {
  test.setTimeout(120_000)
  for (const [path, locale] of [
    ['/contact', 'fr'],
    ['/ar/contact', 'ar'],
  ] as const) {
    await page.goto(path)
    await page.locator('input[autocomplete="name"]').fill('Max Mustermann')
    // A domain without a dot passes the browser's type=email and fails the
    // server's check — so the server is the one that has to say why.
    await page.locator('input[type=email]').fill('max.mustermann@example')
    await page.locator('form input[type=text]:not([autocomplete])').fill('Essai')
    await page.locator('form textarea').fill('Bonjour')
    const submit = page.locator('form button[type=submit]')
    await expect(submit).toBeEnabled({ timeout: 30_000 })
    await submit.click()

    await expect(page.getByRole('alert').filter({ hasText: message('errors.invalid_email', {}, locale) })).toBeVisible()
    await expect(page.getByText('Invalid email address')).toHaveCount(0)
  }
})

test('a rate limit says how long it lasts, not "in a moment"', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/connexion')
  await page.locator('input[type=email]').fill('max.mustermann@example.com')
  const submit = page.locator('form button[type=submit]').first()

  // Login allows eight attempts in fifteen minutes; the ninth is refused for
  // whatever is left of the window — about a quarter of an hour, here.
  for (let attempt = 1; attempt <= 9; attempt++) {
    await page.locator('input[type=password]').fill(`Wrong-Password-${attempt}`)
    await expect(submit).toBeEnabled({ timeout: 30_000 })
    const answered = page.waitForResponse('**/api/auth/login')
    await submit.click()
    expect((await answered).status()).toBe(attempt <= 8 ? 401 : 429)
  }

  await expect(page.getByRole('alert')).toHaveText(
    messagePattern('errors.rate_limited_for', 'wait', '1[45] minutes')
  )
})

test('checkout says which detail is wrong, not that "some details are incorrect"', async ({
  page,
  seedCart,
}) => {
  test.setTimeout(180_000)
  await seedCart([{ productId: displayProduct._id, quantity: 1 }])
  await page.goto('/commande')

  await page.locator('input[autocomplete="postal-code"]').fill('86000')
  await page.locator('input[autocomplete="address-level2"]').fill('Poitiers')
  await page.locator('input[autocomplete="given-name"]').fill('Max')
  await page.locator('input[autocomplete="family-name"]').fill('Mustermann')
  await page.locator('input[type="email"]').fill('max.mustermann@example.com')
  // Letters in a phone number: refused by the server, never by this form.
  await page.locator('input[autocomplete="tel"]').fill('+43 660 1234567 (Büro)')
  await page.locator('input[type="radio"][value="pickup"]').check()
  await page.locator('input[type="radio"][value="in_store"]').check()

  const confirm = page.getByRole('button', { name: message('checkout.confirm') })
  await expect(confirm).toBeEnabled({ timeout: 90_000 })
  const answered = page.waitForResponse('**/api/checkout/start')
  await confirm.click()
  expect((await answered).status()).toBe(400)
  await expect(page.getByRole('alert')).toHaveText(message('errors.invalid_phone'))
})
