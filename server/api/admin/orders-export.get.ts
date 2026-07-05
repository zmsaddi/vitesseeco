/**
 * CSV export of admin orders — honors the exact same filters as the list
 * (status, q, payment, dateFrom, dateTo, sort). Semicolon-separated with
 * UTF-8 BOM so French Excel opens it correctly. Capped at 5000 rows.
 */
import { sql } from 'drizzle-orm'
import { useDBHttp } from '~/server/database/db'
import { orders } from '~/server/database/schema'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'
import { audit } from '~/server/utils/audit'
import { buildAdminOrderFilters, ORDER_SORTS } from '~/server/utils/adminOrderQuery'

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 10, windowMs: 60_000 })
  const admin = await requireAdmin(event)

  const q = getQuery(event)
  const { where, sort } = buildAdminOrderFilters(q)

  const db = useDBHttp()
  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt,
      customerName: sql<string>`${orders.customerSnapshot}->>'name'`,
      customerEmail: sql<string>`COALESCE(${orders.customerSnapshot}->>'email', ${orders.guestEmail})`,
      itemsCount: sql<number>`jsonb_array_length(${orders.items})`,
      subtotal: orders.subtotal,
      shippingCost: orders.shippingCost,
      discount: orders.discount,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      trackingNumber: orders.trackingNumber,
    })
    .from(orders)
    .where(where)
    .orderBy(...ORDER_SORTS[sort])
    .limit(5000)

  const header = [
    'Commande', 'Date', 'Client', 'Email', 'Articles',
    'Sous-total', 'Livraison', 'Remise', 'Total', 'Paiement', 'Statut', 'Suivi',
  ].join(';')

  const lines = rows.map((r) =>
    [
      r.orderNumber,
      r.createdAt ? new Date(r.createdAt).toLocaleString('fr-FR') : '',
      r.customerName,
      r.customerEmail,
      r.itemsCount,
      Number(r.subtotal).toFixed(2),
      Number(r.shippingCost).toFixed(2),
      Number(r.discount).toFixed(2),
      Number(r.total).toFixed(2),
      r.paymentMethod,
      r.status,
      r.trackingNumber,
    ]
      .map(csvCell)
      .join(';')
  )

  await audit({
    actorType: 'admin',
    actorId: admin.email,
    action: 'orders.admin_export',
    resourceType: 'order',
    metadata: { rows: rows.length, filters: { ...q } },
  })

  const csv = '﻿' + [header, ...lines].join('\r\n')
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`
  )
  return csv
})
