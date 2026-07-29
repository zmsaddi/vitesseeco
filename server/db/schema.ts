/**
 * The relational schema.
 *
 * Postgres owns everything transactional: customers, sessions, orders, stock,
 * money. Sanity owns catalogue content and nothing else, so no row here is a
 * copy of a document there and there is nothing to keep in sync.
 *
 * Rules that are enforced by the database rather than by remembering:
 *  - every amount is an integer number of cents, and cannot be negative
 *  - every quantity is at least one
 *  - a session stores only the hash of its token
 *  - an order number, an idempotency key and a provider event id are unique,
 *    so a retry, a double click and a redelivered webhook are all no-ops
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// ── enumerations ──────────────────────────────────────────────────────────────
// Declared in the database so an impossible value cannot be written at all,
// including by a migration script or by hand in a console.

export const orderStatusEnum = pgEnum('order_status', [
  'draft',
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
])

export const paymentMethodEnum = pgEnum('payment_method', ['stripe', 'cod', 'in_store'])

export const actorTypeEnum = pgEnum('actor_type', ['system', 'customer', 'admin'])

export const webhookStatusEnum = pgEnum('webhook_status', ['received', 'processed', 'failed'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

// ── identity ──────────────────────────────────────────────────────────────────

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Stored already lower-cased and trimmed, so one person is one account. */
    email: text('email').notNull(),
    /** Null for an account created purely through an OAuth provider. */
    passwordHash: text('password_hash'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    locale: text('locale').notNull().default('fr'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('customers_email_key').on(t.email)]
)

/**
 * External identities, one row per provider account. Kept separate from
 * `customers` so adding a second provider is a row, not a column, and so a
 * provider id can never collide with an email lookup.
 */
export const oauthIdentities = pgTable(
  'oauth_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('oauth_provider_account_key').on(t.provider, t.providerAccountId),
    index('oauth_customer_idx').on(t.customerId),
  ]
)

/**
 * Sessions store the SHA-256 of the token, never the token. A leaked database
 * dump therefore cannot be replayed as a login.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    /** Shown in "your active sessions"; hashed IP only, never the address. */
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
    index('sessions_customer_idx').on(t.customerId),
    index('sessions_expires_idx').on(t.expiresAt),
  ]
)

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    label: text('label'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    line1: text('line1').notNull(),
    line2: text('line2'),
    postalCode: text('postal_code').notNull(),
    city: text('city').notNull(),
    country: text('country').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('addresses_customer_idx').on(t.customerId),
    // At most one default per customer, enforced by the database.
    uniqueIndex('addresses_one_default_per_customer')
      .on(t.customerId)
      .where(sql`${t.isDefault}`),
  ]
)

// ── inventory ─────────────────────────────────────────────────────────────────

/**
 * The only place stock exists. `onHand` is what is physically in the warehouse;
 * what is sellable is `onHand` minus the live reservations below.
 */
export const inventory = pgTable(
  'inventory',
  {
    /** Sanity product `_id`. The catalogue describes it; this row counts it. */
    productId: text('product_id').primaryKey(),
    sku: text('sku'),
    onHand: integer('on_hand').notNull().default(0),
    /** Bumped on every change, so a concurrent admin edit is detectable. */
    version: integer('version').notNull().default(0),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [index('inventory_sku_idx').on(t.sku), check('inventory_on_hand_non_negative', sql`${t.onHand} >= 0`)]
)

/**
 * A hold placed while payment is in flight.
 *
 * Authorization holds cannot serve this purpose: Stripe supports manual capture
 * on cards and Klarna only, and our Dutch and Belgian customers pay with iDEAL
 * and Bancontact. So the hold lives here, always carries an expiry, and is
 * released by the webhook, by the sweep, or by the expiry — three independent
 * paths, because a missed webhook must never strand stock forever.
 */
export const stockReservations = pgTable(
  'stock_reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => inventory.productId, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Set when the hold is consumed by payment or given back. Null while live. */
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('reservations_product_live_idx').on(t.productId).where(sql`${t.settledAt} is null`),
    index('reservations_expiry_idx').on(t.expiresAt).where(sql`${t.settledAt} is null`),
    uniqueIndex('reservations_order_product_key').on(t.orderId, t.productId),
    check('reservations_quantity_positive', sql`${t.quantity} > 0`),
  ]
)

// ── orders ────────────────────────────────────────────────────────────────────

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNumber: text('order_number').notNull(),
    /**
     * Supplied by the client and unique, so a double-clicked pay button or a
     * retried request resolves to the order that already exists.
     */
    idempotencyKey: text('idempotency_key').notNull(),

    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    /** Only for guests; a registered customer's email lives on their record. */
    guestEmail: text('guest_email'),

    status: orderStatusEnum('status').notNull().default('draft'),
    locale: text('locale').notNull().default('fr'),
    currency: text('currency').notNull().default('EUR'),

    /**
     * Which market's price list this order was placed against, and the VAT that
     * was inside the total on the day. Both are frozen: rates change by law, and
     * an invoice reprinted next year has to show what actually applied.
     */
    marketCountry: text('market_country').notNull().default('FR'),
    vatRateBp: integer('vat_rate_bp').notNull().default(2000),
    vatCents: integer('vat_cents').notNull().default(0),

    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').notNull().default(0),
    shippingCents: integer('shipping_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),

    promoCode: text('promo_code'),
    shippingMethodCode: text('shipping_method_code').notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),

    shippingAddress: jsonb('shipping_address'),
    billingAddress: jsonb('billing_address'),
    /** Name, email and phone as they were when the order was placed. */
    customerSnapshot: jsonb('customer_snapshot'),

    stripeSessionId: text('stripe_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),

    trackingNumber: text('tracking_number'),
    carrier: text('carrier'),
    /** Written by the customer at checkout. */
    notes: text('notes'),
    /** Written by staff; never shown to the customer. */
    adminNotes: text('admin_notes'),

    paidAt: timestamp('paid_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('orders_order_number_key').on(t.orderNumber),
    uniqueIndex('orders_idempotency_key').on(t.idempotencyKey),
    uniqueIndex('orders_stripe_session_key').on(t.stripeSessionId).where(sql`${t.stripeSessionId} is not null`),
    index('orders_customer_idx').on(t.customerId),
    index('orders_status_created_idx').on(t.status, t.createdAt),
    index('orders_guest_email_idx').on(t.guestEmail),
    check('orders_subtotal_non_negative', sql`${t.subtotalCents} >= 0`),
    check('orders_discount_non_negative', sql`${t.discountCents} >= 0`),
    check('orders_shipping_non_negative', sql`${t.shippingCents} >= 0`),
    check('orders_total_non_negative', sql`${t.totalCents} >= 0`),
    check('orders_vat_rate_sane', sql`${t.vatRateBp} >= 0 and ${t.vatRateBp} <= 10000`),
    // VAT is contained in the total, never added to it: EU consumer prices are
    // quoted gross, so a VAT figure above the total is a arithmetic mistake.
    check('orders_vat_within_total', sql`${t.vatCents} >= 0 and ${t.vatCents} <= ${t.totalCents}`),
    // The total is not an independent number: it is the other three.
    check(
      'orders_total_is_consistent',
      sql`${t.totalCents} = ${t.subtotalCents} - ${t.discountCents} + ${t.shippingCents}`
    ),
    // A discount cannot exceed what is being discounted.
    check('orders_discount_within_subtotal', sql`${t.discountCents} <= ${t.subtotalCents}`),
    // Every order is reachable: a guest order carries an email, a customer order a customer.
    check(
      'orders_have_an_owner',
      sql`${t.customerId} is not null or ${t.guestEmail} is not null`
    ),
  ]
)

/**
 * Order lines are rows, not a JSON blob, so they can be joined, aggregated and
 * constrained. Product name, colour and image are copied in at purchase time:
 * an order is a record of what was bought, and must not change when the
 * catalogue is edited two years later.
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(),
    sku: text('sku'),
    nameSnapshot: text('name_snapshot').notNull(),
    colorSnapshot: text('color_snapshot'),
    imageSnapshot: text('image_snapshot'),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    index('order_items_product_idx').on(t.productId),
    uniqueIndex('order_items_order_product_key').on(t.orderId, t.productId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
    check('order_items_unit_price_non_negative', sql`${t.unitPriceCents} >= 0`),
    check('order_items_line_total_is_consistent', sql`${t.lineTotalCents} = ${t.unitPriceCents} * ${t.quantity}`),
  ]
)

/**
 * Promotion usage. The definition lives in Sanity where the owner edits it; the
 * counter lives here because only a relational database can decrement a limited
 * quantity atomically. Counting rows is the count — there is no separate number
 * to drift.
 */
export const promoRedemptions = pgTable(
  'promo_redemptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    discountCents: integer('discount_cents').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    // One redemption per order, so a retry cannot consume a second use.
    uniqueIndex('promo_redemptions_order_key').on(t.orderId),
    index('promo_redemptions_code_idx').on(t.code),
    check('promo_redemptions_discount_non_negative', sql`${t.discountCents} >= 0`),
  ]
)

// ── inbound events ────────────────────────────────────────────────────────────

/**
 * Every webhook we receive, recorded before it is acted on. The unique index is
 * what makes replay harmless: a redelivered event collides and is skipped
 * instead of flipping an already-shipped order back to paid.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    type: text('type').notNull(),
    status: webhookStatusEnum('status').notNull().default('received'),
    payload: jsonb('payload').notNull(),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('webhook_events_provider_event_key').on(t.provider, t.eventId),
    index('webhook_events_status_idx').on(t.status, t.receivedAt),
  ]
)

// ── customer contact ──────────────────────────────────────────────────────────

/**
 * Contact messages live here, not in the catalogue store. They carry a name, an
 * email and free text — that is personal data, and personal data belongs in the
 * database nobody can query from a browser.
 */
export const contactMessages = pgTable(
  'contact_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    locale: text('locale').notNull().default('fr'),
    isRead: boolean('is_read').notNull().default(false),
    adminNote: text('admin_note'),
    ipHash: text('ip_hash'),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('contact_messages_unread_idx').on(t.isRead, t.createdAt)]
)

// ── operational ───────────────────────────────────────────────────────────────

/**
 * Rate limiting in the database rather than in process memory. A serverless
 * instance is recycled constantly and there are many of them, so an in-memory
 * counter is a limit in name only.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    /** `${identity}:${route}` — never anything the caller controls. */
    bucket: text('bucket').primaryKey(),
    count: integer('count').notNull().default(0),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('rate_limits_expiry_idx').on(t.expiresAt)]
)

/** Append-only record of every state change worth explaining afterwards. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorType: actorTypeEnum('actor_type').notNull().default('system'),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    metadata: jsonb('metadata'),
    ipHash: text('ip_hash'),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('audit_action_time_idx').on(t.action, t.createdAt),
    index('audit_resource_idx').on(t.resourceType, t.resourceId),
  ]
)

/** Funnel telemetry. Hashed IP only — never the address itself. */
export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: text('type').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    sessionId: text('session_id'),
    payload: jsonb('payload'),
    ipHash: text('ip_hash'),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('events_type_time_idx').on(t.type, t.createdAt)]
)

export type Customer = typeof customers.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Address = typeof addresses.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type InventoryRow = typeof inventory.$inferSelect
export type StockReservation = typeof stockReservations.$inferSelect
export type ContactMessage = typeof contactMessages.$inferSelect
