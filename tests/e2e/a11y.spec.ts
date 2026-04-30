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
    await page.goto(path, { waitUntil: 'networkidle' })

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
