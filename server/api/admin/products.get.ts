/**
 * The catalogue as the owner manages it: what it costs, and how many we have.
 *
 * Price comes from Sanity, which owns catalogue content; sellable quantity comes
 * from Postgres, which owns stock. Joining them here means one screen answers
 * both questions without the owner holding two tools open.
 *
 * A market may be named, in which case each row also carries what that market
 * currently charges and whether that figure is a hand-set override or the
 * catalogue-wide rule doing its work. Seeing the difference matters: an override
 * stops following the base price, so a product that has one will not move when
 * the owner re-prices everything else.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { sanity } from '../../catalog/client'
import { MARKET_PRICING_QUERY } from '../../catalog/queries'
import { parseMarketRules } from '../../catalog/parse'
import { db } from '../../db/client'
import { readAvailability } from '../../services/stock'
import { fromEuros, toEuros } from '../../../shared/money'
import {
  defaultMarket,
  getMarket,
  isServableMarket,
  marketPrice,
  servableMarkets,
  vatNeutralPrice,
} from '../../../shared/markets'

interface Row {
  id: string
  slug: string
  name: string
  color: string | null
  image: string | null
  price: number
  compareAtPrice: number | null
  pricesByCountry: Array<{ country: string; price: number; compareAtPrice: number | null }> | null
  isAvailable: boolean
  productType: string | null
}

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: z
    .object({
      search: z.string().trim().max(80).optional(),
      lowStockOnly: z.coerce.boolean().optional(),
      /**
       * Which market's prices to show alongside the base ones. Restricted to
       * markets a URL can reach — pricing one that cannot be addressed would
       * write a number nothing is able to display.
       */
      market: z
        .string()
        .trim()
        .toUpperCase()
        .refine((value) => isServableMarket(value), 'unknown or unaddressable market')
        .optional(),
    })
    .strict(),
  handler: async ({ query }) => {
    const client = sanity()

    // Drafts are excluded: an unpublished edit is not what the shop is selling.
    const [rows, ruleDocuments] = await Promise.all([
      client.fetch<Row[]>(
        `*[_type == "product" && defined(slug.current)${query.search ? ' && (name.fr match $term || sku match $term)' : ''}]
        | order(coalesce(sortOrder, 0) asc, name.fr asc) [0...500] {
          "id": _id,
          "slug": slug.current,
          "name": coalesce(name.fr, name.en),
          "color": color.fr,
          "image": images[0].asset->url,
          price,
          compareAtPrice,
          "pricesByCountry": pricesByCountry[]{ country, price, compareAtPrice },
          isAvailable,
          productType
        }`,
        query.search ? { term: `${query.search}*` } : {}
      ),
      client.fetch<unknown>(MARKET_PRICING_QUERY),
    ])

    const availability = await readAvailability(
      db(),
      rows.map((row) => row.id)
    )

    const base = defaultMarket()
    const market = getMarket(query.market)
    const rule = market ? (parseMarketRules(ruleDocuments).get(market.country) ?? null) : null

    const items = rows.map((row) => {
      const override = market
        ? (row.pricesByCountry ?? []).find(
            (entry) => entry.country?.trim().toUpperCase() === market.country
          )
        : undefined

      const basePrice = fromEuros(row.price)

      return {
        ...row,
        onHand: availability.get(row.id)?.onHand ?? 0,
        reserved: availability.get(row.id)?.reserved ?? 0,
        available: availability.get(row.id)?.available ?? 0,
        market: market
          ? {
              country: market.country,
              /** What this market charges today. */
              price: toEuros(override ? fromEuros(override.price) : marketPrice(basePrice, rule)),
              /** True when the owner set the figure by hand. */
              isOverride: Boolean(override),
              /** The price that would net the same after VAT — a suggestion only. */
              vatNeutral: toEuros(vatNeutralPrice(basePrice, base, market)),
            }
          : null,
      }
    })

    return {
      items: query.lowStockOnly ? items.filter((item) => item.available <= 5) : items,
      total: items.length,
      markets: servableMarkets().map((entry) => entry.country),
    }
  },
})
