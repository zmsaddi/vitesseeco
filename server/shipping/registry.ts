/**
 * Carrier adapter registry (U-X1) — mirrors server/payments/registry.ts.
 *
 * One active carrier at a time (env-selected). Adding an aggregator later
 * (Sendcloud/Boxtal — U-X2) means: write the adapter, add its case here,
 * set SHIPPING_CARRIER=sendcloud in Vercel. No call-site changes.
 */

import type { CarrierAdapter } from '~/server/shipping/types'
import { manualAdapter } from '~/server/shipping/adapters/manual'

const adapters: Record<string, CarrierAdapter> = {
  manual: manualAdapter,
}

export function getActiveCarrier(): CarrierAdapter {
  const code = (process.env.SHIPPING_CARRIER || 'manual').trim().toLowerCase()
  return adapters[code] ?? manualAdapter
}

export function getCarrier(code: string): CarrierAdapter | undefined {
  return adapters[code]
}
