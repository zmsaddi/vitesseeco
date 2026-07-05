/**
 * Shared status label KEYS/styles for the admin panel. Labels are i18n keys
 * (admin.* namespace, all 6 locales) — pages resolve them via t().
 * Status values mirror the PG flow:
 * pending → paid → processing → shipped → delivered / cancelled.
 */

export const STATUS_LABELS: Record<string, string> = {
  pending: 'admin.status_pending',
  paid: 'admin.status_paid',
  processing: 'admin.status_processing',
  shipped: 'admin.status_shipped',
  delivered: 'admin.status_delivered',
  cancelled: 'admin.status_cancelled',
}

export const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  paid: 'bg-sky-500/15 text-sky-300',
  processing: 'bg-indigo-500/15 text-indigo-300',
  shipped: 'bg-blue-500/15 text-blue-300',
  delivered: 'bg-accent/15 text-accent',
  cancelled: 'bg-danger/15 text-danger',
}

/** The normal forward transitions the UI proposes per current status. */
export const NEXT_STATUSES: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}
