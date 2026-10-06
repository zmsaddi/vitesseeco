/**
 * The shared test harness: every spec imports `test`/`expect` from here.
 *
 * Three things happen behind every page this file hands out, all in service of
 * determinism:
 *
 * 1. **Catalogue images are served locally.** Fixture products carry
 *    cdn.sanity.io URLs (the shape @nuxt/image expects), but the bytes come
 *    from a committed PNG — no network, no flaky thumbnails, identical pixels
 *    on every run.
 *
 * 2. **The browser is watched.** An uncaught exception, an unexpected
 *    console.error, or a first-party 5xx fails the test that caused it — even
 *    if every visible assertion passed. The allowlist below is the ENTIRE
 *    tolerated list; anything added to it needs a reason next to it.
 *
 * 3. **Isolation is the default.** Playwright already gives each test a fresh
 *    context; `seedCart` exists so a spec that needs a basket writes its own,
 *    instead of inheriting one from a previous test — the context-reuse
 *    mistake that once produced a false purchase-path failure in the
 *    simulator. Each test is also its own visitor to the rate limiter: see
 *    `clientAddress` below.
 */
import { test as base, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cartStorage } from './catalogue'

const FIXTURE_IMAGE = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fixture-image.png')

/**
 * Console noise this harness tolerates. Exact, small, and each line justified —
 * a broad filter here would blind the gate it serves.
 */
const IGNORABLE_CONSOLE: Array<{ pattern: RegExp; reason: string }> = [
  {
    // Cloudflare's Turnstile widget logs its own chatter; third-party, outside
    // this codebase's control, and present on every checkout by design.
    pattern: /challenges\.cloudflare\.com|\[Cloudflare Turnstile\]/i,
    reason: 'Turnstile widget internals',
  },
  {
    // Headless Chromium without a GPU: WebGL fallback warnings from the
    // browser itself, not from application code.
    pattern: /WebGL|GPU stall|swiftshader/i,
    reason: 'headless-GPU fallback noise',
  },
  {
    // The browser's own network log writes a console.error for every response
    // ≥ 400. A 4xx is an expected contract answer here — the 404 page, a
    // refused tampered payload — and each one is asserted where it happens.
    // Real server faults stay fatal via the first-party 5xx watch below.
    pattern: /^Failed to load resource: the server responded with a status of 4\d\d/,
    reason: 'browser network log for asserted 4xx contract answers',
  },
  {
    // The TEST browser ran out of its own sockets under parallel-worker load
    // (observed on a 12-worker local run). The request never left the
    // machine, so it cannot witness anything about the candidate; a server
    // that actually failed still fails the test through the 5xx watch and
    // the page's own assertions.
    pattern: /net::ERR_INSUFFICIENT_RESOURCES/,
    reason: 'harness-side socket exhaustion — the candidate never saw the request',
  },
]

interface Harness {
  /** Write a basket — and, if given, a stored promo code — into localStorage before the first navigation. */
  seedCart: (lines: Array<{ productId: string; quantity: number }>, promoCode?: string) => Promise<void>
  /** Findings collected by the monitor; asserted empty at teardown. */
  browserErrors: string[]
  /**
   * The address this test's requests come from, as far as the candidate can
   * tell. Already applied to every first-party request the browser makes; a
   * spec that calls the API through `page.request` passes it as `x-real-ip`.
   */
  clientAddress: string
}

/**
 * Block until the page has hydrated — all of it.
 *
 * A click that lands on server-rendered HTML before hydration hits a button
 * with no handler and silently does nothing — under parallel load that window
 * widens to whole seconds, and it produced exactly the false negative the old
 * simulator was retired for. Vue marks its container with `__vue_app__` the
 * moment the app mounts, in production builds too — but a page's async setup
 * hydrates after that, and the mark alone let a search typed into the listing
 * go unheard, and a navigation pushed during it make Vue report a hydration
 * mismatch. Nuxt clears `isHydrating` once the last of it has resolved, so
 * that is the signal waited for.
 */
export async function waitForHydration(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (
        document.querySelector('#__nuxt') as {
          __vue_app__?: { $nuxt?: { isHydrating?: boolean } }
        } | null
      )?.__vue_app__?.$nuxt?.isHydrating === false,
    undefined,
    { timeout: 30_000 }
  )
}

export const test = base.extend<Harness>({
  browserErrors: async ({}, use) => {
    await use([])
  },

  /**
   * A fresh documentation-range IPv6 address per test (RFC 3849).
   *
   * The rate limiter keys its budgets on the caller's address, and the durable
   * ones outlive a run: login allows eight attempts in fifteen minutes, sign-up
   * five an hour. Every test came from the same loopback address, so rerunning
   * one spec a few times — `--repeat-each`, a UI-mode loop — spent the budget
   * and failed on "Trop de tentatives" instead of on what it was testing. The
   * rig's server reads `x-real-ip` exactly as it does behind Vercel's edge
   * (server/security/request.ts), so each test gets a budget of its own.
   */
  clientAddress: async ({}, use) => {
    const groups = randomBytes(12).toString('hex').match(/.{4}/g) ?? []
    await use(`2001:db8:${groups.join(':')}`)
  },

  context: async ({ context, baseURL, clientAddress }, use) => {
    await context.route('**/cdn.sanity.io/**', (route) =>
      route.fulfill({ path: FIXTURE_IMAGE, contentType: 'image/png' })
    )
    // First-party only: a custom header on a third-party request (Turnstile's
    // iframe) would turn its fetches into CORS preflights it never asked for.
    const firstParty = new URL(baseURL ?? 'http://127.0.0.1:3000').origin
    await context.route(`${firstParty}/**`, (route) =>
      route.continue({ headers: { ...route.request().headers(), 'x-real-ip': clientAddress } })
    )
    await use(context)
  },

  page: async ({ page, baseURL, browserErrors }, use) => {
    const firstPartyHost = new URL(baseURL ?? 'http://127.0.0.1:3000').host

    page.on('pageerror', (error) => {
      browserErrors.push(`pageerror: ${error.message}`)
    })
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (IGNORABLE_CONSOLE.some((entry) => entry.pattern.test(text))) return
      browserErrors.push(`console.error on ${page.url()}: ${text.slice(0, 300)}`)
    })
    page.on('response', (response) => {
      const url = new URL(response.url())
      if (url.host === firstPartyHost && response.status() >= 500) {
        browserErrors.push(`first-party ${response.status()}: ${url.pathname}`)
      }
    })

    // Every goto also waits for hydration, so a spec's first interaction never
    // races Vue's mount. Full-page navigations a CLICK causes (rather than a
    // goto) still need an explicit waitForHydration where they happen.
    const originalGoto = page.goto.bind(page)
    page.goto = (async (url: string, options?: Parameters<typeof originalGoto>[1]) => {
      const response = await originalGoto(url, options)
      await waitForHydration(page)
      return response
    }) as typeof page.goto

    await use(page)

    expect(browserErrors, 'the browser saw errors no assertion looked at').toEqual([])
  },

  seedCart: async ({ context }, use) => {
    await use(async (lines, promoCode) => {
      const payload = cartStorage(lines, promoCode ?? null)
      await context.addInitScript(
        ([key, value]) => {
          window.localStorage.setItem(key as string, value as string)
        },
        ['vitesse.cart.v1', payload]
      )
    })
  },
})

export { expect }
