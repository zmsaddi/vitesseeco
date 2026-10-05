/**
 * The customer is told what actually went wrong.
 *
 * Every page used to read the error payload one level too high and fell back
 * to "an error on our side" — a wrong password told the customer the shop was
 * broken. This drives the real form against the real route and reads the
 * message a person would read.
 */
import { test, expect } from '../helpers/test'

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
