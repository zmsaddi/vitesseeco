/**
 * Pricing.
 *
 * The single place a basket becomes an amount of money. Every total the system
 * ever charges comes from here, computed from ids and quantities the client
 * sent and prices the client never saw. There is no signed snapshot to verify
 * and no locked price to expire, because nothing the browser sends is capable
 * of influencing the total in the first place.
 *
 * That is the difference from the previous build, which carried a hand-rolled
 * HMAC over a price list — 133 lines of cryptography protecting a number that
 * should never have left the server.
 */
import {
  ZERO,
  add,
  allocateProportionally,
  applyPercentage,
  atLeastZero,
  multiply,
  subtract,
  type Cents,
} from '../../shared/money'
import { AppError, ERROR_CODES } from '../../shared/errors'
import type { LocaleCode } from '../../shared/locales'
import { getProductsByIds, getPromo, shippingMethodsFor } from '../catalog'
import type { ProductSummary, ShippingMethod } from '../catalog/types'
import { db } from '../db/client'
import { readAvailability } from './stock'
import { countPromoRedemptions } from './promo'

export interface RequestedLine {
  productId: string
  quantity: number
}

export interface PricedLine {
  productId: string
  slug: string
  name: string
  sku: string | null
  color: string | null
  image: string | null
  unitPrice: Cents
  quantity: number
  lineTotal: Cents
  /** This line's share of a basket-level discount. */
  discount: Cents
  available: number
}

export interface PriceBreakdown {
  lines: PricedLine[]
  subtotal: Cents
  discount: Cents
  shipping: Cents
  total: Cents
  promo: { code: string; applied: boolean; reason?: string } | null
  shippingMethod: { code: string; name: string } | null
}

export interface PriceRequest {
  lines: RequestedLine[]
  locale: LocaleCode
  promoCode?: string
  shipping?: {
    methodCode: string
    country: string
    postalCode?: string
  }
}

/**
 * Price a basket.
 *
 * Throws when a line refers to something unbuyable, because a basket the
 * customer cannot actually order should be corrected before they reach a
 * payment form, not after.
 */
export async function priceBasket(request: PriceRequest): Promise<PriceBreakdown> {
  if (request.lines.length === 0) {
    throw new AppError(ERROR_CODES.CART_EMPTY)
  }

  const productIds = [...new Set(request.lines.map((line) => line.productId))]
  if (productIds.length !== request.lines.length) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
      internal: 'priceBasket: the same product appears on more than one line',
    })
  }

  const products = await getProductsByIds(productIds, request.locale)
  const missing = productIds.filter((id) => !products.has(id))
  if (missing.length > 0) {
    throw new AppError(ERROR_CODES.NOT_FOUND, {
      details: { unavailable: missing },
      internal: `priceBasket: ${missing.join(', ')} are not purchasable`,
    })
  }

  const availability = await readAvailability(db(), productIds)

  const lines: PricedLine[] = request.lines.map((line) => {
    const product = products.get(line.productId) as ProductSummary
    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      sku: null,
      color: product.color,
      image: product.image?.url ?? null,
      unitPrice: product.price,
      quantity: line.quantity,
      lineTotal: multiply(product.price, line.quantity),
      discount: ZERO,
      available: availability.get(product.id)?.available ?? 0,
    }
  })

  const subtotal = add(...lines.map((line) => line.lineTotal))

  const promo = await resolvePromo(request.promoCode, subtotal)
  const discount = promo.discount

  // Attribute the basket discount across lines by value, so a refund or a
  // partial cancellation later has a per-line figure that sums back exactly.
  if (discount > 0) {
    const shares = allocateProportionally(discount, lines.map((line) => line.lineTotal))
    lines.forEach((line, index) => {
      line.discount = shares[index] ?? ZERO
    })
  }

  const shipping = await resolveShipping(request, subtotal, discount)

  const total = atLeastZero(add(subtract(subtotal, discount), shipping.price))

  return {
    lines,
    subtotal,
    discount,
    shipping: shipping.price,
    total,
    promo: promo.summary,
    shippingMethod: shipping.method ? { code: shipping.method.code, name: shipping.method.name } : null,
  }
}

interface ResolvedPromo {
  discount: Cents
  summary: { code: string; applied: boolean; reason?: string } | null
}

/**
 * Work out what a promotion is worth right now.
 *
 * A code that cannot be applied is reported, never silently ignored: the
 * previous build dropped a failed promotion and charged the customer the higher
 * total they had not agreed to.
 */
async function resolvePromo(code: string | undefined, subtotal: Cents): Promise<ResolvedPromo> {
  if (!code) return { discount: ZERO, summary: null }

  const normalized = code.trim().toUpperCase()
  const reject = (reason: string): ResolvedPromo => ({
    discount: ZERO,
    summary: { code: normalized, applied: false, reason },
  })

  const definition = await getPromo(normalized)
  if (!definition) return reject('unknown')
  if (!definition.isActive) return reject('inactive')

  const now = new Date()
  if (definition.validFrom && now < definition.validFrom) return reject('not_yet_valid')
  if (definition.validUntil && now > definition.validUntil) return reject('expired')
  if (definition.minOrderValue !== null && subtotal < definition.minOrderValue) {
    return reject('below_minimum')
  }

  // The counter is in Postgres because only a relational database can settle
  // "the last remaining use" between two simultaneous checkouts.
  if (definition.maxUses !== null) {
    const used = await countPromoRedemptions(normalized)
    if (used >= definition.maxUses) return reject('exhausted')
  }

  const discount =
    definition.discountType === 'percentage'
      ? applyPercentage(subtotal, definition.value)
      : (Math.min(definition.value, subtotal) as Cents)

  return { discount, summary: { code: normalized, applied: true } }
}

interface ResolvedShipping {
  price: Cents
  method: ShippingMethod | null
}

/**
 * Work out delivery cost.
 *
 * The method is re-fetched and re-checked against the destination here, so a
 * client cannot name a method that does not serve the address — the free
 * own-fleet rate is scoped to Poitiers and the Benelux, and asking for it from
 * Madrid must not work.
 */
async function resolveShipping(
  request: PriceRequest,
  subtotal: Cents,
  discount: Cents
): Promise<ResolvedShipping> {
  if (!request.shipping) return { price: ZERO, method: null }

  const eligible = await shippingMethodsFor(
    {
      country: request.shipping.country,
      ...(request.shipping.postalCode ? { postalCode: request.shipping.postalCode } : {}),
    },
    request.locale
  )

  const method = eligible.find((entry) => entry.code === request.shipping?.methodCode)
  if (!method) {
    throw new AppError(ERROR_CODES.UNKNOWN_SHIPPING_METHOD, {
      internal: `${request.shipping.methodCode} does not serve ${request.shipping.country} ${request.shipping.postalCode ?? ''}`.trim(),
    })
  }

  // Free-shipping thresholds are judged on what the customer actually pays, so
  // a discount cannot push a basket over the line it no longer reaches.
  const qualifying = subtract(subtotal, discount)
  const price = method.freeAbove !== null && qualifying >= method.freeAbove ? ZERO : method.price

  return { price, method }
}
