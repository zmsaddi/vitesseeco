/**
 * CSV export of the order queue.
 *
 * Every cell is escaped twice over: once for CSV quoting, and once against
 * formula injection. A customer whose name is `=HYPERLINK(...)` is a legal
 * name, so the defence belongs here rather than in the validator that would
 * otherwise turn a real person away — the old build rejected neither and
 * executed the formula in the admin's spreadsheet.
 */
import { and, desc, eq, gte, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { setResponseHeader } from 'h3'
import { defineRoute } from '../../../security/handler'
import { db } from '../../../db/client'
import { orders } from '../../../db/schema'
import { orderStatusSchema } from '../../../../shared/schemas'
import { cents, toDecimalString } from '../../../../shared/money'
import { audit } from '../../../services/audit'

/**
 * Neutralise a cell.
 *
 * A leading =, +, - or @ makes a spreadsheet treat the value as a formula, and
 * a tab or carriage return can smuggle one in. Prefixing an apostrophe makes it
 * literal text without changing what the reader sees.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/["\n\r;,]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

const COLUMNS = [
  'Numéro',
  'Date',
  'Statut',
  'Paiement',
  'Livraison',
  'Client',
  'Email',
  'Ville',
  'Pays',
  'Total EUR',
  'Suivi',
] as const

export default defineRoute({
  access: 'admin',
  rateLimit: 'standard',
  query: z
    .object({
      status: orderStatusSchema.optional(),
      since: z.coerce.date().optional(),
      limit: z.coerce.number().int().min(1).max(5000).default(1000),
    })
    .strict(),
  handler: async ({ event, query, customer }) => {
    const conditions: SQL[] = []
    if (query.status) conditions.push(eq(orders.status, query.status))
    if (query.since) conditions.push(gte(orders.createdAt, query.since))

    const rows = await db()
      .select()
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(query.limit)

    const lines = [COLUMNS.join(';')]
    for (const row of rows) {
      const snapshot = (row.customerSnapshot ?? {}) as { name?: string; email?: string }
      const address = (row.shippingAddress ?? {}) as { city?: string; country?: string }
      lines.push(
        [
          row.orderNumber,
          row.createdAt.toISOString(),
          row.status,
          row.paymentMethod,
          row.shippingMethodCode,
          snapshot.name ?? '',
          snapshot.email ?? row.guestEmail ?? '',
          address.city ?? '',
          address.country ?? '',
          toDecimalString(cents(row.totalCents)),
          row.trackingNumber ?? '',
        ]
          .map(csvCell)
          .join(';')
      )
    }

    // Exporting customer data is worth a record of who did it and when.
    await audit({
      action: 'orders.export',
      actorType: 'admin',
      actorId: customer!.email,
      metadata: { rows: rows.length, status: query.status ?? 'all' },
    })

    const stamp = new Date().toISOString().slice(0, 10)
    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="commandes-${stamp}.csv"`)
    // Excel reads a semicolon file as UTF-8 only when it sees a byte-order mark.
    return `﻿${lines.join('\r\n')}`
  },
})

export { csvCell }
