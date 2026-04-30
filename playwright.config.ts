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
      // Cross-platform snapshots: drop the {platform} segment so a baseline
      // generated on Windows (test:visual:update locally) matches the Ubuntu
      // CI run. Without this, Playwright appends -win32 / -linux to filenames
      // and CI fails with "snapshot doesn't exist". Trade-off: font / sub-pixel
      // rendering can differ between OSes — that's why maxDiffPixelRatio is
      // 0.02. Generate baselines on Linux (CI or WSL) for best fidelity.
      snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
    },
  ],
})
