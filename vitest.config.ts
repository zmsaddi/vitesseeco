import { defineConfig } from 'vitest/config'

/**
 * Unit and integration suites. Playwright owns the browser tests
 * (playwright.config.ts), so tests/e2e is deliberately outside this config and
 * the two runners never fight over the same files.
 *
 *   npm run test:unit         pure logic, no I/O
 *   npm run test:integration  needs TEST_DATABASE_URL
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts', 'tests/integration/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'node',
    globalSetup: ['tests/integration/globalSetup.ts'],
    // Integration files share one database and truncate between cases, so they
    // must not overlap. The unit suite is small enough that running it in the
    // same serial pass costs a couple of seconds.
    fileParallelism: false,
    // A test that hangs is a failing test.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.ts', 'server/**/*.ts'],
      exclude: ['**/*.spec.ts', 'server/db/migrations/**'],
      reporter: ['text-summary', 'lcov'],
    },
  },
})
