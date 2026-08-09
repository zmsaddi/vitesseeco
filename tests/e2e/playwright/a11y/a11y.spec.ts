/**
 * axe-core over the purchase path, blocking.
 *
 * Scope: WCAG 2.0/2.1 A + AA, on the six surfaces a customer must cross to
 * hand over money. Any violation in this scope fails CI.
 *
 * Exclusion policy: none exist today. If one ever becomes unavoidable it must
 * be scoped to a selector AND a rule, carry the reason, and reference the
 * finding that tracks it (see docs/testing/BROWSER_GATES.md) — a global
 * disable would turn this file into decoration.
 */
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '../helpers/test'
import { displayProduct } from '../helpers/catalogue'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

interface Surface {
  name: string
  path: string
  /** Signal that the client-rendered content this page hides behind ClientOnly is up. */
  ready?: string
  cart?: boolean
}

const SURFACES: Surface[] = [
  { name: 'home', path: '/' },
  { name: 'listing', path: '/produits' },
  { name: 'product', path: `/produits/${displayProduct.slug}` },
  { name: 'cart', path: '/panier', ready: 'li input[type="number"]', cart: true },
  { name: 'checkout', path: '/commande', ready: 'input[autocomplete="postal-code"]', cart: true },
  { name: 'login', path: '/connexion', ready: 'input[type="email"]' },
]

for (const surface of SURFACES) {
  test(`${surface.name} has zero WCAG A/AA violations`, async ({ page, seedCart }) => {
    if (surface.cart) await seedCart([{ productId: displayProduct._id, quantity: 1 }])
    await page.goto(surface.path)
    if (surface.ready) await page.locator(surface.ready).first().waitFor()

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()

    const readable = results.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
    }))
    expect(readable, `axe violations on ${surface.path}`).toEqual([])
  })
}
