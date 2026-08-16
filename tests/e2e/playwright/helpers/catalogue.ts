/**
 * One source of truth for what the rig contains.
 *
 * Specs never invent an id, a price or a stock count: they read the same
 * committed fixture the server serves and the seed script writes, so a change
 * to the fixture moves every assertion with it — and a spec that disagrees
 * with the catalogue is a spec that was wrong, not a fixture that drifted.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Every fixture document is authored in all six locales, and typed so. */
type LocalizedText = Record<'fr' | 'en' | 'nl' | 'de' | 'es' | 'ar', string>

interface FixtureProduct {
  _id: string
  slug: string
  name: LocalizedText
  color: LocalizedText | null
  price: number
  compareAtPrice: number | null
  productType: string
  modelFamily: string | null
}

interface FixturePromo {
  code: string
  discountType: string
  discountValue: number
}

interface FixtureCatalogue {
  products: FixtureProduct[]
  promos: FixturePromo[]
  inventory: Record<string, { sku: string; onHand: number }>
}

const catalogue = JSON.parse(
  readFileSync(join(here, '..', '..', '..', '..', 'server', 'catalog', 'fixture-catalogue.json'), 'utf8')
) as FixtureCatalogue

export const fixtureProducts = catalogue.products

const firstPromo = catalogue.promos[0]
if (!firstPromo) throw new Error('fixture-catalogue.json declares no promo code')
export const fixturePromo: FixturePromo = firstPromo

function bySlugOrThrow(id: string): FixtureProduct {
  const product = catalogue.products.find((p) => p._id === id)
  if (!product) throw new Error(`fixture-catalogue.json no longer holds ${id}`)
  return product
}

/** The one product the checkout journey buys. Owned by journey.spec.ts alone. */
export const journeyProduct = bySlugOrThrow('fixture-bike-in-stock')
/** Read-only product for PDP/a11y/RTL/visual specs — no spec ever orders it. */
export const displayProduct = bySlugOrThrow('fixture-bike-sibling')
export const outOfStockProduct = bySlugOrThrow('fixture-bike-out-of-stock')

export function onHand(id: string): number {
  const row = catalogue.inventory[id]
  if (!row) throw new Error(`fixture-catalogue.json declares no inventory for ${id}`)
  return row.onHand
}

const FORMAT_LOCALE: Record<string, string> = { fr: 'fr-FR', ar: 'ar' }

/**
 * Euros (as authored in the fixture) → the exact string the UI renders.
 * Mirrors app/composables/useFormatPrice.ts: Intl currency, then every space
 * normalised to U+00A0 — the same normalisation that makes SSR and client HTML
 * byte-identical makes this expectation byte-exact.
 */
export function displayPrice(euros: number, locale: 'fr' | 'ar' = 'fr'): string {
  return new Intl.NumberFormat(FORMAT_LOCALE[locale], { style: 'currency', currency: 'EUR' })
    .format(euros)
    .replace(/\s/g, ' ')
}

/** The wire format of /api/cart/price ("2398.00"), rendered like the UI does. */
export function displayDecimal(decimal: string, locale: 'fr' | 'ar' = 'fr'): string {
  return displayPrice(Number(decimal), locale)
}

/** The localStorage payload useCart persists — ids and quantities, nothing else. */
export function cartStorage(lines: Array<{ productId: string; quantity: number }>): string {
  return JSON.stringify({ lines, promoCode: null })
}
