import { pgTable, text, timestamp, integer, boolean, decimal, jsonb, uuid, index } from 'drizzle-orm/pg-core'

// === CUSTOMERS ===
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  postalCode: text('postal_code'),
  country: text('country').default('FR'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// === ADDRESSES ===
export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  label: text('label').notNull().default('home'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  address: text('address').notNull(),
  addressLine2: text('address_line2'),
  city: text('city').notNull(),
  postalCode: text('postal_code').notNull(),
  country: text('country').notNull().default('FR'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// === ORDERS ===
// Status flow: pending → paid → processing → shipped → delivered / cancelled
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: text('order_number').unique(), // ORD-XXX (SEC-09: PG becomes source of truth in P0-11)
  customerId: uuid('customer_id').references(() => customers.id),
  guestEmail: text('guest_email'),
  status: text('status').notNull().default('pending'),
  paymentMethod: text('payment_method'), // ADR-07: code resolved by adapter registry
  items: jsonb('items').notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal('shipping_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  discount: decimal('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  promoCode: text('promo_code'),
  shippingMethod: text('shipping_method'),
  shippingAddress: jsonb('shipping_address'),
  billingAddress: jsonb('billing_address'),
  customerSnapshot: jsonb('customer_snapshot'), // name/email/phone at time of order
  stripePaymentId: text('stripe_payment_id'),
  trackingNumber: text('tracking_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  orderNumberIdx: index('orders_order_number_idx').on(t.orderNumber),
  customerIdx: index('orders_customer_idx').on(t.customerId),
  statusCreatedIdx: index('orders_status_created_idx').on(t.status, t.createdAt),
}))

// === SESSIONS ===
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// === INVENTORY ===
// PG-primary stock (P0-10/P0-11/P0-13). Backfilled from Sanity in initial sync.
// Rows are LOCKed by SELECT FOR UPDATE during order creation to prevent oversell.
export const inventory = pgTable('inventory', {
  productId: text('product_id').primaryKey(), // matches Sanity _id
  sku: text('sku'), // for human readability in queries
  stock: integer('stock').notNull().default(0),
  reserved: integer('reserved').notNull().default(0), // future: cart holds, etc.
  version: integer('version').notNull().default(0), // bump on every change for downstream sync
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  skuIdx: index('inventory_sku_idx').on(t.sku),
}))

// === OUTBOX ===
// Async sync of order/inventory changes to Sanity (ADR-001, P0-12).
// Workers drain pending entries; failures retry with exponential backoff.
export const outbox = pgTable('outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: text('kind').notNull(), // 'sanity.order.create' | 'sanity.inventory.patch' | ...
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'), // pending | done | failed
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  scheduledAt: timestamp('scheduled_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  pendingIdx: index('outbox_pending_idx').on(t.status, t.scheduledAt),
}))

// === AUDIT LOG ===
// Records every state change worth investigating after the fact (P0-17).
// Append-only. Cleanup by age (e.g., 365 days) via cron later.
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorType: text('actor_type').notNull().default('system'), // 'system' | 'customer' | 'admin'
  actorId: text('actor_id'), // customer_id, admin email, or null for system
  action: text('action').notNull(), // 'order.create' | 'order.failed' | 'promo.release' | 'auth.password_reset' | ...
  resourceType: text('resource_type'), // 'order' | 'customer' | 'promo' | 'product' | ...
  resourceId: text('resource_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  actionTimeIdx: index('audit_log_action_time_idx').on(t.action, t.createdAt),
  resourceIdx: index('audit_log_resource_idx').on(t.resourceType, t.resourceId),
}))

// === EVENTS ===
// Business funnel telemetry (P0-18, ADR-05). GDPR-aware: ip_hash only, no raw IP.
// Cleanup by age (e.g., 90 days) via cron later.
export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventType: text('event_type').notNull(), // 'add_to_cart' | 'checkout_started' | 'order_created' | 'order_failed' | ...
  customerId: uuid('customer_id').references(() => customers.id),
  sessionId: text('session_id'), // anonymous correlation
  payload: jsonb('payload'),
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  typeTimeIdx: index('events_type_time_idx').on(t.eventType, t.createdAt),
  customerIdx: index('events_customer_idx').on(t.customerId),
}))

// === PASSWORD RESET TOKENS ===
// Used by P0-06/P0-07 (deferred until Resend is wired in P0-04).
// Token is stored hashed; the raw token is delivered via email and never persisted in clear.
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  customerIdx: index('password_reset_tokens_customer_idx').on(t.customerId),
  expiresIdx: index('password_reset_tokens_expires_idx').on(t.expiresAt),
}))
