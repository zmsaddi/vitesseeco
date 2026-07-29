/**
 * Inventory, as it really is.
 *
 * Shows what is on the shelf, what is held by checkouts in flight, and what is
 * therefore sellable. The old Studio badge showed a single number that had
 * drifted from all three.
 */
import { z } from 'zod'
import { defineRoute } from '../../security/handler'
import { db } from '../../db/client'
import { findLowStock } from '../../services/stock'

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: z.object({ lowStockBelow: z.coerce.number().int().min(0).max(1000).default(1000) }).strict(),
  handler: async ({ query }) => {
    const rows = await findLowStock(db(), query.lowStockBelow)
    return {
      items: rows,
      // The two numbers the owner acts on: what to reorder, and what is at risk.
      outOfStock: rows.filter((row) => row.available <= 0).length,
      lowStock: rows.filter((row) => row.available > 0 && row.available <= 5).length,
    }
  },
})
