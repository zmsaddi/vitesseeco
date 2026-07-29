import { defineConfig } from 'vitest/config'

/**
 * Unit and integration suites. Playwright owns the browser tests
 * (playwright.config.ts) — this config deliberately excludes tests/e2e and
 * tests/visual so the two runners never fight over the same files.
 *
 *   npm run test:unit         pure logic, no I/O
 *   npm run test:integration  needs TEST_DATABASE_URL
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts', 'tests/integration/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'tests/visual/**', 'node_modules/**'],
    environment: 'node',
    // A test that hangs is a failing test.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.ts', 'server/**/*.ts'],
      exclude: ['**/*.spec.ts', 'server/database/migrations/**'],
      reporter: ['text-summary', 'lcov'],
    },
  },
})
