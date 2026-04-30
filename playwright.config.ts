import { defineConfig } from '@playwright/test'

/**
 * Two test suites live in this repo:
 *   - tests/e2e/      functional + a11y (run on every push)
 *   - tests/visual/   screenshot baselines (opt-in via --project=visual)
 *
 * Use `npm run test:e2e` for the e2e suite and `npm run test:visual` for
 * visual regression. Running `npx playwright test` with no project flag
 * runs both.
 */
export default defineConfig({
  // Top-level testDir is the parent so Playwright will discover both
  // tests/e2e and tests/visual. Each project below scopes its own dir.
  testDir: './tests',
  timeout: 60_000,
  retries: 2,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://vitesseeco.vercel.app',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { browserName: 'chromium' },
    },
    {
      name: 'visual',
      testDir: './tests/visual',
      use: { browserName: 'chromium' },
      // Stricter on diff so accidental drifts get caught
      expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
    },
  ],
})
