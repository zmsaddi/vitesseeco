/**
 * Requests a spec makes for itself, and refusals it hands a page on purpose.
 *
 * Everything here goes through the page — its fetch, its router — rather than
 * through Playwright's own request client, for the reasons given on each.
 */
import type { Page } from '@playwright/test'
import { expect, waitForHydration } from './test'

/** A synthetic identity no real customer can have. */
export function newAccount(): { email: string; password: string; firstName: string; lastName: string } {
  return {
    email: `max.mustermann.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'Musterstrasse-1-Wien',
    firstName: 'Max',
    lastName: 'Mustermann',
  }
}

/**
 * POST from inside the page, answering the status.
 *
 * The session cookie is `Secure`. Over the rig's plain-http loopback the
 * browser still sends it — 127.0.0.1 is a trustworthy origin to Chromium — but
 * Playwright's own request client does not, so anything signed in goes
 * through the page's fetch.
 */
export async function post(page: Page, path: string, body: unknown): Promise<number> {
  return page.evaluate(
    async ([url, payload]) =>
      (
        await fetch(url as string, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
      ).status,
    [path, body] as const
  )
}

/** A fresh synthetic customer, signed in from inside the page. */
export async function signUp(page: Page): Promise<ReturnType<typeof newAccount>> {
  const account = newAccount()
  await page.goto('/')
  expect(await post(page, '/api/auth/register', { ...account, locale: 'fr', captchaToken: 'pw.DUMMY.TOKEN' })).toBe(200)
  return account
}

/**
 * A refusal exactly as h3 sends one, for a request a spec makes fail on
 * purpose. A 429, because it is a refusal the rig can be asked for at any time
 * — an outage cannot be — and because the browser harness rightly fails any
 * first-party 5xx it sees.
 */
export function rateLimited(url: string): { status: number; contentType: string; body: string } {
  return {
    status: 429,
    contentType: 'application/json',
    body: JSON.stringify({
      error: true,
      url,
      statusCode: 429,
      statusMessage: 'RATE_LIMITED',
      message: 'RATE_LIMITED',
      data: { code: 'RATE_LIMITED', messageKey: 'errors.rate_limited', details: { retryAfterSeconds: 45 } },
    }),
  }
}

/**
 * Go to a page through the app's own router, the way a link inside it does.
 *
 * A page's first render happens on the server, where no browser route can
 * reach its requests. Arriving from inside the app makes them the browser's
 * own, so a spec can answer them — which is how a failure that only an outage
 * produces is put in front of a page on demand.
 */
export async function navigateInApp(page: Page, path: string): Promise<void> {
  // Never mid-hydration: a route pushed then is reported by Vue as a mismatch.
  await waitForHydration(page)
  await page.evaluate(async (target) => {
    type Router = { push: (to: string) => Promise<unknown> }
    const root = document.querySelector('#__nuxt') as {
      __vue_app__?: { config: { globalProperties: { $router: Router } } }
    } | null
    const app = root?.__vue_app__
    if (!app) throw new Error('the app has not mounted')
    await app.config.globalProperties.$router.push(target)
  }, path)
}
