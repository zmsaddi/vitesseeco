/**
 * Accessibility audit via axe-core (P5-03).
 *
 * Asserts zero critical/serious violations on the most-trafficked pages.
 * Less severe violations (moderate, minor) are reported but not failing —
 * they're tracked in the report and addressed incrementally.
 *
 * Requires `@axe-core/playwright` — installed lazily so the rest of the
 * test suite still works if it's missing.
 */
import { test, expect } from '@playwright/test'

const PAGES = ['/', '/produits', '/contact', '/a-propos', '/faq']

let AxeBuilder: any = null
async function loadAxe() {
  if (AxeBuilder) return AxeBuilder
  try {
    // String concat hides the specifier from TS so a missing dep doesn't fail
    // the typecheck CI step. The dep is genuinely optional — a11y suite is
    // a smoke check that's enabled once `npm i -D @axe-core/playwright` is run.
    const specifier = '@axe-core/' + 'playwright'
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const mod: any = await (Function('s', 'return import(s)') as any)(specifier)
    AxeBuilder = mod.default ?? mod.AxeBuilder
    return AxeBuilder
  } catch {
    return null
  }
}

for (const path of PAGES) {
  test(`a11y — ${path}`, async ({ page }) => {
    const Builder = await loadAxe()
    test.skip(!Builder, '@axe-core/playwright not installed — `npm i -D @axe-core/playwright` to enable')

    await page.goto(path, { waitUntil: 'networkidle' })

    const results = await new Builder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    const seriousOrCritical = results.violations.filter(
      (v: any) => v.impact === 'critical' || v.impact === 'serious'
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

    expect(seriousOrCritical, `Found ${seriousOrCritical.length} serious/critical a11y violations on ${path}`).toHaveLength(0)
  })
}
