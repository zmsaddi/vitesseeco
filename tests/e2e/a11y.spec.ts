/**
 * Accessibility audit via axe-core (P5-03).
 *
 * Asserts zero critical/serious WCAG 2.1 AA violations on the most-trafficked
 * pages. Moderate/minor violations are logged but do not fail the suite —
 * they're addressed incrementally.
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PAGES = ['/', '/produits', '/contact', '/a-propos', '/faq']

for (const path of PAGES) {
  test(`a11y — ${path}`, async ({ page }) => {
    // Don't wait for networkidle — Turnstile, analytics widgets, and lazy-loaded
    // images can keep the network busy indefinitely on /contact and home. Using
    // domcontentloaded + h1 visible gives us a stable layout to audit without
    // false timeouts on third-party iframes.
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    if (seriousOrCritical.length > 0) {
      console.log(`\n[a11y violations on ${path}]:`)
      for (const v of seriousOrCritical) {
        console.log(`  ${v.impact} — ${v.id} — ${v.help}`)
        for (const node of v.nodes.slice(0, 3)) {
          console.log(`    target: ${node.target}`)
        }
      }
    }

    expect(
      seriousOrCritical,
      `Found ${seriousOrCritical.length} serious/critical a11y violations on ${path}`
    ).toHaveLength(0)
  })
}
