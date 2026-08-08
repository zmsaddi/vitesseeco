/**
 * CSV export of the order queue.
 *
 * Every cell is escaped twice over: once for CSV quoting, and once against
 * formula injection. A customer whose name is `=HYPERLINK(...)` is a legal
 * name, so the defence belongs here rather than in the validator that would
 * otherwise turn a real person away — the old build rejected neither and
 * executed the formula in the admin's spreadsheet.
 */
import { and, desc, eq, gte, inArray, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { setResponseHeader } from 'h3'
import { defineRoute } from '../../../security/handler'
import { db } from '../../../db/client'
import { orderItems, orders } from '../../../db/schema'
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

/**
 * The street address and the line items are here because an export without them
 * cannot be used to pack or to deliver anything — which is most of what an
 * export is for in a shop that drives its own van.
 *
 * These headers stay French while the rest of the panel follows the admin's
 * language, and that is a decision rather than an oversight: the file feeds the
 * accounting of a French SAS, and a column name is a key someone's spreadsheet
 * formula or import mapping already points at. Translating them would silently
 * break every sheet built on a previous export. If a second language is ever
 * needed here, add the labels to i18n/locales as `admin.export.*` and resolve
 * them against the caller's locale — do not rename these in place.
 */
const COLUMNS = [
  'Numéro',
  'Date',
  'Statut',
  'Paiement',
  'Livraison',
  'Client',
  'Email',
  'Téléphone',
  'Adresse',
  'Complément',
  'Code postal',
  'Ville',
  'Pays',
  'Articles',
  'Sous-total EUR',
  'Remise EUR',
  'Frais de port EUR',
  'Total EUR',
  'TVA EUR',
  'Taux TVA %',
  'Marché',
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

    // One query for every order's items rather than one per row: an export of a
    // thousand orders should not be a thousand round trips.
    const itemsByOrder = new Map<string, string[]>()
    if (rows.length > 0) {
      const lineRows = await db()
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, rows.map((row) => row.id)))
      for (const item of lineRows) {
        const list = itemsByOrder.get(item.orderId) ?? []
        list.push(`${item.quantity}× ${item.nameSnapshot}${item.sku ? ` [${item.sku}]` : ''}`)
        itemsByOrder.set(item.orderId, list)
      }
    }

    const lines = [COLUMNS.join(';')]
    for (const row of rows) {
      const snapshot = (row.customerSnapshot ?? {}) as { name?: string; email?: string }
      const address = (row.shippingAddress ?? {}) as {
        firstName?: string
        lastName?: string
        phone?: string
        line1?: string
        line2?: string
        postalCode?: string
        city?: string
        country?: string
      }
      const recipient =
        snapshot.name || [address.firstName, address.lastName].filter(Boolean).join(' ')

      lines.push(
        [
          row.orderNumber,
          row.createdAt.toISOString(),
          row.status,
          row.paymentMethod,
          row.shippingMethodCode,
          recipient,
          snapshot.email ?? row.guestEmail ?? '',
          address.phone ?? '',
          address.line1 ?? '',
          address.line2 ?? '',
          address.postalCode ?? '',
          address.city ?? '',
          address.country ?? '',
          (itemsByOrder.get(row.id) ?? []).join(' | '),
          toDecimalString(cents(row.subtotalCents)),
          toDecimalString(cents(row.discountCents)),
          toDecimalString(cents(row.shippingCents)),
          toDecimalString(cents(row.totalCents)),
          toDecimalString(cents(row.vatCents)),
          String(row.vatRateBp / 100),
          row.marketCountry,
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
