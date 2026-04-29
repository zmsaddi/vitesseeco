/**
 * Price lock — server-signed cart snapshot (P3-05, fixes CHK-06).
 *
 * Problem: between cart/validate.post.ts (where the customer sees the total)
 * and orders/create.post.ts (where money is committed), the catalog price can
 * change. Without a price lock, the customer either sees one number and is
 * charged another, or the validate response has to be trusted on the create
 * side — which means a malicious client could downgrade prices.
 *
 * Solution: cart/validate.post.ts issues a signed snapshot:
 *   { items: [{ productId, price, quantity }], subtotal, expiresAt }
 * signed with HMAC-SHA256 using AUTH_SECRET. The client returns the snapshot
 * to orders/create.post.ts, which verifies the signature, checks expiresAt,
 * and uses the locked prices for the final total — never re-fetching them
 * from Sanity. If the snapshot is missing/expired/tampered, the order is
 * rejected with a 409 and the client is told to refresh.
 *
 * Lock TTL is short (15 min) so a stale snapshot never carries a wildly
 * outdated price into a real order.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const TTL_MS = 15 * 60 * 1000 // 15 minutes

export interface LockedItem {
  productId: string
  price: number
  quantity: number
}

export interface PriceSnapshot {
  items: LockedItem[]
  subtotal: number
  shippingCost: number
  discount: number
  total: number
  promoCode: string | null
  shippingCode: string | null
  issuedAt: number
  expiresAt: number
}

export interface SignedPriceSnapshot {
  payload: PriceSnapshot
  sig: string
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is not configured (must be ≥16 chars)')
  }
  return secret
}

function canonicalize(payload: PriceSnapshot): string {
  // Stable serialization — sorted keys, sorted items by productId, no extras.
  const sortedItems = [...payload.items]
    .map((i) => ({ productId: i.productId, price: i.price, quantity: i.quantity }))
    .sort((a, b) => a.productId.localeCompare(b.productId))
  const obj = {
    items: sortedItems,
    subtotal: payload.subtotal,
    shippingCost: payload.shippingCost,
    discount: payload.discount,
    total: payload.total,
    promoCode: payload.promoCode,
    shippingCode: payload.shippingCode,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  }
  return JSON.stringify(obj)
}

export function sign(input: Omit<PriceSnapshot, 'issuedAt' | 'expiresAt'>): SignedPriceSnapshot {
  const issuedAt = Date.now()
  const payload: PriceSnapshot = {
    ...input,
    issuedAt,
    expiresAt: issuedAt + TTL_MS,
  }
  const sig = createHmac('sha256', getSecret()).update(canonicalize(payload)).digest('base64url')
  return { payload, sig }
}

export type VerifyResult =
  | { ok: true; payload: PriceSnapshot }
  | { ok: false; reason: 'malformed' | 'invalid_signature' | 'expired' | 'shape_mismatch' }

export function verify(input: unknown): VerifyResult {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'malformed' }
  const obj = input as { payload?: unknown; sig?: unknown }
  if (typeof obj.sig !== 'string' || !obj.payload || typeof obj.payload !== 'object') {
    return { ok: false, reason: 'malformed' }
  }

  // Shape-check the payload before HMAC so a wildly malformed input is
  // rejected with a typed reason rather than a generic signature error.
  const p = obj.payload as Partial<PriceSnapshot>
  if (
    !Array.isArray(p.items) ||
    typeof p.subtotal !== 'number' ||
    typeof p.shippingCost !== 'number' ||
    typeof p.discount !== 'number' ||
    typeof p.total !== 'number' ||
    typeof p.issuedAt !== 'number' ||
    typeof p.expiresAt !== 'number'
  ) {
    return { ok: false, reason: 'shape_mismatch' }
  }
  for (const item of p.items) {
    if (!item || typeof (item as any).productId !== 'string' ||
        typeof (item as any).price !== 'number' ||
        typeof (item as any).quantity !== 'number') {
      return { ok: false, reason: 'shape_mismatch' }
    }
  }

  const expected = createHmac('sha256', getSecret()).update(canonicalize(p as PriceSnapshot)).digest('base64url')
  // Constant-time compare to avoid timing oracles.
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(obj.sig, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'invalid_signature' }
  }

  if (Date.now() > (p.expiresAt as number)) {
    return { ok: false, reason: 'expired' }
  }

  return { ok: true, payload: p as PriceSnapshot }
}
