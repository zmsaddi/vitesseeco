/**
 * Shipping methods for checkout — quotes come from the active carrier
 * adapter (U-X1). Response shape unchanged ({ methods, zone }) so the
 * checkout keeps working as before; `zoneFallback` is additive.
 */
import { getActiveCarrier } from '~/server/shipping/registry'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const zone = ((query.zone as string) || 'FR').toUpperCase()
  const subtotal = Math.max(0, Number(query.subtotal) || 0)
  const postalCode = typeof query.postal === 'string' ? query.postal.slice(0, 12) : undefined

  const carrier = getActiveCarrier()
  const { rates, zoneFallback } = await carrier.quote({ country: zone, subtotal, postalCode })

  return { methods: rates, zone, zoneFallback: zoneFallback ?? false }
})
