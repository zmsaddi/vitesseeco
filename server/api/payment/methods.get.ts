import { createClient } from '@sanity/client'
import { listEnabledAdapterCodes } from '~/server/payments/registry'

/**
 * List active payment methods (P4-04 / P4-05).
 *
 * Filters by:
 *   - Sanity `isActive == true` (admin can disable a method without deploy)
 *   - listEnabledAdapterCodes() (env-flag gate, e.g. ENABLE_STRIPE)
 *
 * Both gates must pass for a method to appear in checkout.
 */
export default defineEventHandler(async () => {
  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  const all = await client.fetch(
    `*[_type == "paymentMethod" && isActive == true] | order(sortOrder asc) {
      code, name, description, icon, instructions
    }`
  )

  const enabledCodes = new Set(listEnabledAdapterCodes())
  const methods = (all || []).filter((m: any) => enabledCodes.has(m.code))

  return { methods }
})
