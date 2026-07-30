/**
 * The universal catalogue export.
 *
 * Merchant Center has its own XML; this is the format everything else reads —
 * a channel manager, a marketplace onboarding form, a price comparison site, an
 * accountant asking what is in stock. One file, one row per product, plain
 * enough that a spreadsheet opens it.
 *
 * Prices are the default market's, because a CSV has no notion of which market
 * is asking. The column is named accordingly rather than left ambiguous.
 */
import { defineEventHandler, setResponseHeader, createError } from 'h3'
import { sanity } from '../../catalog/client'
import { FEED_PRODUCTS_QUERY, MARKET_PRICING_QUERY } from '../../catalog/queries'
import { parseMarketRules, priceInMarket, translate } from '../../catalog/parse'
import { db } from '../../db/client'
import { readAvailability } from '../../services/stock'
import { toDecimalString } from '../../../shared/money'
import { localizedUrl, DEFAULT_LOCALE } from '../../../shared/locales'
import { defaultMarket } from '../../../shared/markets'

const COLUMNS = [
  'sku',
  'gtin_boxed',
  'gtin_assembled',
  'mpn',
  'name',
  'brand',
  'category',
  'colour',
  'model_family',
  'price_eur_fr',
  'compare_at_eur_fr',
  'stock',
  'availability',
  'url',
  'image',
] as const

/**
 * Escape a CSV cell.
 *
 * The leading-character guard is not decoration: a spreadsheet treats a cell
 * starting with =, +, - or @ as a formula, so a product name beginning with one
 * becomes executable content in whoever opens the file. Prefixing an apostrophe
 * is the standard defence.
 */
function cell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/["\n\r;,]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

/** Below this, the catalogue read is broken rather than the shop being empty. */
const MINIMUM_PLAUSIBLE_ROWS = 5

export default defineEventHandler(async (event) => {
  const client = sanity()

  let products: Array<Record<string, unknown>>
  let ruleDocuments: unknown
  try {
    ;[products, ruleDocuments] = await Promise.all([
      client.fetch<Array<Record<string, unknown>>>(FEED_PRODUCTS_QUERY),
      client.fetch<unknown>(MARKET_PRICING_QUERY),
    ])
  } catch (error) {
    console.error('[catalog.csv] catalogue read failed', error)
    throw createError({ statusCode: 503, statusMessage: 'CATALOGUE_UNAVAILABLE' })
  }

  const market = defaultMarket()
  const priceRule = parseMarketRules(ruleDocuments).get(market.country) ?? null
  const availability = await readAvailability(
    db(),
    products.map((p) => String(p._id))
  )

  const rows: string[] = []
  for (const raw of products) {
    const product = raw as {
      _id: string
      slug: string | null
      name: Record<string, string> | null
      price: number | null
      compareAtPrice: number | null
      pricesByCountry: Array<{ country: string; price: number; compareAtPrice?: number | null }> | null
      productType: string | null
      color: Record<string, string> | null
      modelFamily: string | null
      sku: string | null
      gtin: string | null
      gtinAssembled: string | null
      manufacturerMpn: string | null
      brand: { name: Record<string, string> | string | null } | null
      category: { name: Record<string, string> | null } | null
      images: Array<{ url: string | null } | null> | null
    }

    const name = translate(product.name, DEFAULT_LOCALE)
    if (!product.slug || !name || product.price == null) continue

    const { price, compareAtPrice } = priceInMarket(
      {
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        pricesByCountry: product.pricesByCountry,
      },
      market,
      priceRule
    )

    const stock = availability.get(product._id)?.available ?? 0
    const brand =
      typeof product.brand?.name === 'string'
        ? product.brand.name
        : translate(product.brand?.name ?? null, DEFAULT_LOCALE)

    rows.push(
      [
        product.sku,
        product.gtin,
        product.gtinAssembled,
        product.manufacturerMpn,
        name,
        brand,
        translate(product.category?.name ?? null, DEFAULT_LOCALE),
        translate(product.color, DEFAULT_LOCALE),
        product.modelFamily,
        toDecimalString(price),
        compareAtPrice === null ? '' : toDecimalString(compareAtPrice),
        stock,
        stock > 0 ? 'in_stock' : 'out_of_stock',
        localizedUrl(`/produits/${product.slug}`, DEFAULT_LOCALE),
        (product.images ?? []).find((image) => image?.url)?.url ?? '',
      ]
        .map(cell)
        .join(';')
    )
  }

  // Same refusal as the Merchant feed: a channel manager fed an empty catalogue
  // deactivates every listing, and recovering takes longer than waiting.
  if (rows.length < MINIMUM_PLAUSIBLE_ROWS) {
    console.error(`[catalog.csv] refusing to serve ${rows.length} rows`)
    throw createError({ statusCode: 503, statusMessage: 'CATALOGUE_INCOMPLETE' })
  }

  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', 'inline; filename="vitesse-eco-catalogue.csv"')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')

  // Semicolons and a BOM: Excel in a French locale opens a comma-separated file
  // as one column, and mangles the accents without the mark.
  return `﻿${[COLUMNS.join(';'), ...rows].join('\n')}\n`
})
