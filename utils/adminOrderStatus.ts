/**
 * Shared status labels/styles for the admin panel (French-only UI, see
 * EXPERIENCE_RECONSTRUCTION_PLAN §3.3). Status values mirror the PG flow:
 * pending → paid → processing → shipped → delivered / cancelled.
 */

export const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  paid: 'Payée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
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
