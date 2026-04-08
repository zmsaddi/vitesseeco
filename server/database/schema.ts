import { pgTable, text, timestamp, integer, boolean, decimal, jsonb, uuid } from 'drizzle-orm/pg-core'

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

// === ORDERS ===
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id),
  guestEmail: text('guest_email'),
  status: text('status').notNull().default('pending'),
  // pending → paid → processing → shipped → delivered / cancelled
  items: jsonb('items').notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal('shipping_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  discount: decimal('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  promoCode: text('promo_code'),
  shippingMethod: text('shipping_method'),
  shippingAddress: jsonb('shipping_address'),
  stripePaymentId: text('stripe_payment_id'),
  trackingNumber: text('tracking_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// === SESSIONS ===
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
