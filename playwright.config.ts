/**
 * Playwright, pointed at the CANDIDATE build and nothing else.
 *
 * The predecessor of this file asserted against an already-deployed URL, so a
 * pull request could never be failed by its own regression — its code was
 * never the thing under test. This configuration refuses that mistake at the
 * root: the target must be a loopback address. There is no fallback to
 * vitesse-eco.fr or any deployment alias; a wrong TEST_BASE_URL fails here,
 * before a single browser opens.
 *
 * The expected rig (see docs/testing/BROWSER_GATES.md):
 *   PostgreSQL seeded by scripts/seed-candidate.mjs
 *   server built from THIS commit, booted with CATALOG_SOURCE=fixture
 *
 * global-setup verifies that rig actually answers with the fixture catalogue —
 * a missing catalogue must fail the gate, never skip it.
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000'

const host = new URL(baseURL).hostname
if (host !== '127.0.0.1' && host !== 'localhost') {
  throw new Error(
    `TEST_BASE_URL points at "${host}". Browser gates test the candidate artifact on ` +
      'loopback only — never a deployment. Build this commit, start it locally, and point ' +
      'TEST_BASE_URL at it (default http://127.0.0.1:3000).'
  )
}

export default defineConfig({
  testDir: 'tests/e2e/playwright',
  globalSetup: './tests/e2e/playwright/global-setup.ts',
  outputDir: 'test-results',
  // Deterministic gates get no second chances: a retry that turns red to green
  // is a flake being hidden, and a hidden flake is a gate nobody trusts.
  retries: 0,
  fullyParallel: true,
  // Local cap, measured not guessed: at this machine's default of 12 workers,
  // back-to-back full runs exhausted the HOST's own sockets — navigations
  // died with net::ERR_INSUFFICIENT_RESOURCES before reaching the server.
  // Six keeps a full run under the host's limits with headroom; CI runners
  // resolve to 1-2 workers on their own and are unaffected.
  workers: process.env.CI ? undefined : 6,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.001,
    },
  },
  // Baselines are committed for Linux (the CI runner). {platform} keeps a local
  // Windows/macOS run from fighting over them.
  snapshotPathTemplate:
    '{testDir}/visual/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'functional',
      testMatch: /functional\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'a11y',
      testMatch: /a11y\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'rtl',
      testMatch: /rtl\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // DPR 1 everywhere: a device-pixel-ratio above 1 multiplies every
        // baseline's size and couples it to emulation details that add nothing
        // to what these screenshots protect.
        deviceScaleFactor: 1,
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
})
