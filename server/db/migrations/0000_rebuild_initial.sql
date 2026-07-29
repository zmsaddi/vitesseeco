CREATE TYPE "public"."actor_type" AS ENUM('system', 'customer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('stripe', 'cod', 'in_store');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"line1" text NOT NULL,
	"line2" text,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "actor_type" DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"admin_note" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"locale" text DEFAULT 'fr' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"customer_id" uuid,
	"session_id" text,
	"payload" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"product_id" text PRIMARY KEY NOT NULL,
	"sku" text,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_on_hand_non_negative" CHECK ("inventory"."on_hand" >= 0)
);
--> statement-breakpoint
CREATE TABLE "oauth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"sku" text,
	"name_snapshot" text NOT NULL,
	"color_snapshot" text,
	"image_snapshot" text,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_non_negative" CHECK ("order_items"."unit_price_cents" >= 0),
	CONSTRAINT "order_items_line_total_is_consistent" CHECK ("order_items"."line_total_cents" = "order_items"."unit_price_cents" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"customer_id" uuid,
	"guest_email" text,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"market_country" text DEFAULT 'FR' NOT NULL,
	"vat_rate_bp" integer DEFAULT 2000 NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"promo_code" text,
	"shipping_method_code" text NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"shipping_address" jsonb,
	"billing_address" jsonb,
	"customer_snapshot" jsonb,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"tracking_number" text,
	"carrier" text,
	"notes" text,
	"admin_notes" text,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_subtotal_non_negative" CHECK ("orders"."subtotal_cents" >= 0),
	CONSTRAINT "orders_discount_non_negative" CHECK ("orders"."discount_cents" >= 0),
	CONSTRAINT "orders_shipping_non_negative" CHECK ("orders"."shipping_cents" >= 0),
	CONSTRAINT "orders_total_non_negative" CHECK ("orders"."total_cents" >= 0),
	CONSTRAINT "orders_vat_rate_sane" CHECK ("orders"."vat_rate_bp" >= 0 and "orders"."vat_rate_bp" <= 10000),
	CONSTRAINT "orders_vat_within_total" CHECK ("orders"."vat_cents" >= 0 and "orders"."vat_cents" <= "orders"."total_cents"),
	CONSTRAINT "orders_total_is_consistent" CHECK ("orders"."total_cents" = "orders"."subtotal_cents" - "orders"."discount_cents" + "orders"."shipping_cents"),
	CONSTRAINT "orders_discount_within_subtotal" CHECK ("orders"."discount_cents" <= "orders"."subtotal_cents"),
	CONSTRAINT "orders_have_an_owner" CHECK ("orders"."customer_id" is not null or "orders"."guest_email" is not null)
);
--> statement-breakpoint
CREATE TABLE "promo_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"discount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_redemptions_discount_non_negative" CHECK ("promo_redemptions"."discount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"bucket" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_quantity_positive" CHECK ("stock_reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_inventory_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."inventory"("product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_customer_idx" ON "addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_default_per_customer" ON "addresses" USING btree ("customer_id") WHERE "addresses"."is_default";--> statement-breakpoint
CREATE INDEX "audit_action_time_idx" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "contact_messages_unread_idx" ON "contact_messages" USING btree ("is_read","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_key" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "events_type_time_idx" ON "events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "inventory_sku_idx" ON "inventory" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_account_key" ON "oauth_identities" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_customer_idx" ON "oauth_identities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_items_order_product_key" ON "order_items" USING btree ("order_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_stripe_session_key" ON "orders" USING btree ("stripe_session_id") WHERE "orders"."stripe_session_id" is not null;--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_guest_email_idx" ON "orders" USING btree ("guest_email");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_redemptions_order_key" ON "promo_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "promo_redemptions_code_idx" ON "promo_redemptions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "rate_limits_expiry_idx" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_customer_idx" ON "sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "reservations_product_live_idx" ON "stock_reservations" USING btree ("product_id") WHERE "stock_reservations"."settled_at" is null;--> statement-breakpoint
CREATE INDEX "reservations_expiry_idx" ON "stock_reservations" USING btree ("expires_at") WHERE "stock_reservations"."settled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_order_product_key" ON "stock_reservations" USING btree ("order_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_key" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status","received_at");