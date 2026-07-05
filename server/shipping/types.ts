/**
 * Shipping carrier adapter contract (U-X1, MASTER_REBUILD_PLAN §3.4).
 *
 * Mirrors the payment adapter pattern (server/payments/types.ts): the rest of
 * the app only knows this interface, never carrier specifics. To plug in any
 * carrier or aggregator API (Sendcloud, Boxtal, Colissimo direct, ...):
 *
 *   1. Create the adapter under server/shipping/adapters/<code>.ts
 *   2. Register it in server/shipping/registry.ts behind an ENABLE_* env flag
 *   3. Configure its methods/zones in Sanity (shippingMethod documents)
 *
 * The active carrier quotes rates at checkout; label creation and tracking
 * are optional capabilities — the manual adapter (default) supports neither
 * and the admin panel's manual tracking-number entry covers that path.
 */

import type { H3Event } from 'h3'

export interface QuoteInput {
  /** ISO country code of the destination (FR, BE, NL, DE, ES, ...). */
  country: string
  /** Cart subtotal in EUR — used for freeAbove thresholds. */
  subtotal: number
  /** Destination postal code — methods may be scoped to postal prefixes
   *  (owner 2026-07-05: FR own-fleet delivery covers dept 86 only for now;
   *  NRW-Germany will use the same mechanism). */
  postalCode?: string
}

export interface ShippingRate {
  code: string
  name: unknown
  description?: unknown
  estimatedDays?: string | null
  price: number
  freeAbove?: number | null
  zones?: string[]
  /** If set, the rate only applies to postal codes starting with one of these. */
  postalCodePrefixes?: string[] | null
}

export interface QuoteResult {
  rates: ShippingRate[]
  /** True when the requested zone had no configuration and FR rates were returned instead. */
  zoneFallback?: boolean
}

export interface CreateLabelInput {
  orderNumber: string
  shippingCode: string
  shippingAddress: Record<string, unknown>
  items: Array<{ sku: string; quantity: number }>
}

export interface CreateLabelResult {
  trackingNumber: string
  labelUrl?: string
  carrier?: string
}

export interface TrackResult {
  status: string
  events?: Array<{ at: string; label: string }>
}

export interface CarrierAdapter {
  /** Unique short code ('manual', 'sendcloud', 'boxtal', ...). */
  code: string
  /** Rates available for a destination. Always implemented. */
  quote(input: QuoteInput): Promise<QuoteResult>
  /** Optional: generate a shipping label + tracking number after an order. */
  createLabel?(input: CreateLabelInput): Promise<CreateLabelResult>
  /** Optional: live tracking lookup. */
  track?(trackingNumber: string): Promise<TrackResult>
  /** Optional: carrier webhook (delivery status pushes → order status updates). */
  onWebhook?(event: H3Event): Promise<{ ok: boolean; orderNumber?: string; newStatus?: string }>
}
