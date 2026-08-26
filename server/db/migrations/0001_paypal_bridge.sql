-- The temporary direct PayPal bridge (server/payments/paypal.ts): a fourth
-- payment_method value and the two provider ids a refund or dispute needs.
--
-- Idempotent on purpose: the dev database and the candidate seed replay every
-- migration file on start, and production applies this by hand against Neon —
-- a second run must be a no-op, not an error. The enum value is permanent
-- (PostgreSQL cannot drop one); the columns simply stop being written when the
-- bridge is removed.
ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'paypal' BEFORE 'cod';
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paypal_order_id" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paypal_capture_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_paypal_order_key" ON "orders" ("paypal_order_id") WHERE "paypal_order_id" is not null;
