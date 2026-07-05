/**
 * Manual carrier adapter — today's behavior formalized (U-X1).
 *
 * Rates come from Sanity shippingMethod documents filtered by zone; labels and
 * tracking numbers are handled by the admin manually in /admin/commandes.
 *
 * Zone fallback: a destination whose zone has no configured methods gets the
 * FR methods instead of an empty list. This preserves the pre-U-X1 behavior
 * (zone was hardcoded to FR) so orders from BE/NL/DE/ES keep working until
 * the owner configures per-country zones + carrier pricing (U-K3).
 */

import { createClient } from '@sanity/client'
import type { CarrierAdapter, QuoteInput, QuoteResult, ShippingRate } from '~/server/shipping/types'

const KNOWN_ZONES = ['FR', 'BE', 'LU', 'NL', 'DE', 'ES']

function getClient() {
  const config = useRuntimeConfig()
  return createClient({
    projectId: (config.public as any).sanityProjectId || '2jvnjf0c',
    dataset: (config.public as any).sanityDataset || 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })
}

async function fetchZone(zone: string): Promise<ShippingRate[]> {
  const client = getClient()
  return await client.fetch(
    `*[_type == "shippingMethod" && isActive == true && $zone in zones] | order(sortOrder asc) {
      code, name, description, estimatedDays, price, freeAbove, zones
    }`,
    { zone }
  )
}

export const manualAdapter: CarrierAdapter = {
  code: 'manual',

  async quote(input: QuoteInput): Promise<QuoteResult> {
    const zone = KNOWN_ZONES.includes(input.country?.toUpperCase()) ? input.country.toUpperCase() : 'FR'

    let rates = await fetchZone(zone)
    let zoneFallback = false
    if (rates.length === 0 && zone !== 'FR') {
      rates = await fetchZone('FR')
      zoneFallback = true
    }

    return { rates, zoneFallback }
  },
}
