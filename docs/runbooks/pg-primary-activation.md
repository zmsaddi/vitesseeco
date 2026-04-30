# Runbook — PG-primary order activation

> **Status:** prerequisites landed (backfill script + dispatcher fix). Activation
> on Neon production has **not** started. `ENABLE_PG_PRIMARY_ORDERS` stays
> `false` until every verification step here passes.
>
> **Owner during activation:** the engineer running the steps. **No silent
> hand-offs** — each phase logs its outcome before the next begins.

This runbook flips order persistence from "Sanity-first dual-write" to
"PG-primary with async Sanity outbox" (ADR-001 / P0-11). It is reversible at
every step short of a malformed migration. Keep this file open in a terminal
window during execution and tick boxes as you go.

---

## Acceptance gate (must all be ✓ before Phase 0)

- [ ] CI green on master for the prerequisites commit (build / e2e / lighthouse).
- [ ] `npm run check:langs` exit 0
- [ ] `npm run check:hex` exit 0
- [ ] `npx nuxi typecheck` exit 0
- [ ] `npx nuxi build` exit 0
- [ ] `npm run test:e2e` against production base URL — all green.
- [ ] `node -c scripts/backfill-inventory.mjs` parses (the live dry-run is
      deferred to Phase 1 step 2 because it queries the `inventory` table that
      doesn't exist until the migration in Phase 1 step 1).

If any of the above is red, **stop**. Activation is not authorised.

---

## Phase 0 — Pre-flight

### 0a. Neon restore point

1. Open Neon Console → project → Branches.
2. Confirm `production` branch has a fresh restore point (≤5 minutes old, or
   create one explicitly via "New restore point").
3. Note the timestamp here: `_______________________`

If Neon's free tier doesn't expose explicit restore points, create a child
branch from `production` named `pre-pg-primary-<YYYYMMDD>` and keep it for at
least 7 days. That branch is the rollback-of-last-resort.

### 0b. Vercel state snapshot

```
vercel env ls production | grep -E "ENABLE_PG_PRIMARY_ORDERS|CRON_SECRET|SANITY_TOKEN|DATABASE_URL"
```

Expected before activation:
- `ENABLE_PG_PRIMARY_ORDERS` — **absent** (or `false`)
- `CRON_SECRET` — **absent**
- `SANITY_TOKEN` — present
- `DATABASE_URL` — present, pointing at Neon production

### 0c. Local guards

```
npm run check:langs && npm run check:hex \
  && npx nuxi typecheck && npx nuxi build
```

All four must exit 0. If any fails, fix and re-run; do not proceed.

---

## Phase 1 — Migration + Backfill

### 1. Apply migration 0002

The migration creates `inventory`, `outbox`, `audit_log`, `events`,
`password_reset_tokens` and adds nullable columns to `orders`. All additive;
no data loss possible.

Option A (preferred — uses Drizzle):

```
DATABASE_URL=<neon-production-url> npx drizzle-kit push --config=drizzle.config.ts
```

Option B (raw SQL, if drizzle-kit refuses interactive prompt):

```
psql "$DATABASE_URL" -f server/database/migrations/0002_moaning_moondragon.sql
```

**Verify:**

```sql
\dt
-- Expect: customers, addresses, orders, sessions, promo_codes, audit_log,
--         events, inventory, outbox, password_reset_tokens

\d orders
-- Expect: order_number (text, unique), payment_method, billing_address,
--         customer_snapshot columns present.
```

### 2. Backfill inventory from Sanity

**2a. Dry-run first** — depends on the `inventory` table existing, so this is
the earliest point at which it can be executed:

```
node --env-file=.env scripts/backfill-inventory.mjs --dry-run
```

Review the dry-run report. It must show:
- `Fetched N sellable products from Sanity` where N matches the published
  product count you expect.
- **Zero** "invalid/negative stock" entries. The script defaults to strict
  mode and will exit non-zero if any sellable product has bad stock — fix
  them in Sanity Studio before continuing. Only use
  `--allow-clamp-invalid-stock` after a deliberate decision.
- `would INSERT + would UPDATE + unchanged == Fetched`.
- `PG rows not in Sanity result: 0`. If non-zero, the live run will exit 6
  (extras detected) unless you investigate and either delete the orphans or
  pass `--allow-extra-rows`.

**2b. Live run** — only after the dry-run is clean:

```
node --env-file=.env scripts/backfill-inventory.mjs
```

The live script aborts (non-zero exit) if any of:
- final PG count < fetched Sanity count (rows lost — exit 4),
- final PG count > fetched Sanity count without `--allow-extra-rows` (exit 6),
- any row has `stock IS NULL OR stock < 0` post-write (exit 3),
- any individual upsert errors (exit 2),
- Sanity returns invalid stock without `--allow-clamp-invalid-stock` (exit 5).

If you hit exit 5 or 6, **do not pass the `--allow-*` flag without first
understanding what you're permitting**. The strict mode is what gives the
first activation a clean baseline.

The script aborts (non-zero exit) if any of:
- final PG count < fetched Sanity count,
- any row has `stock IS NULL OR stock < 0`,
- any individual upsert errors.

### 3. Verification queries (must all match)

```sql
-- a. row count matches sellable products
SELECT COUNT(*) FROM inventory;
-- expect: same as the script's "Fetched N" line

-- b. no NULL or negative stock
SELECT COUNT(*) FROM inventory WHERE stock IS NULL OR stock < 0;
-- expect: 0

-- c. orders.order_number column exists and is unique
SELECT COUNT(*) FROM orders WHERE order_number IS NULL;
-- legacy rows are NULL; that's fine. The unique constraint allows multiple NULLs.

-- d. unique constraint actually present
SELECT conname FROM pg_constraint
WHERE conrelid = 'orders'::regclass AND conname = 'orders_order_number_unique';
-- expect: 1 row

-- e. outbox is empty (clean slate)
SELECT COUNT(*) FROM outbox;
-- expect: 0
```

If any of (a)–(e) fail, **stop and rollback** — see Rollback section.

---

## Phase 2 — Cron + secret

The PG-primary path enqueues outbox entries that need to be drained. The
Vercel cron route is gated by `CRON_SECRET`; without it, route returns 503.

### 4. Generate and set CRON_SECRET

Generate a secret locally (do **not** commit):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In Vercel:
- Project → Settings → Environment Variables → Add
- Name: `CRON_SECRET`
- Value: `<the hex generated above>`
- Environments: **Production only**

### 5. Redeploy so the env var takes effect

```
vercel deploy --prod
```

(Or push an empty commit. Either works.)

**Verify:**

```
curl -i -X POST https://vitesse-eco.fr/api/cron/process-outbox
# expect: 401 Unauthorized

curl -i -X POST https://vitesse-eco.fr/api/cron/process-outbox \
     -H "x-cron-secret: <wrong>"
# expect: 401 Unauthorized

curl -i -X POST https://vitesse-eco.fr/api/cron/process-outbox \
     -H "x-cron-secret: <correct>"
# expect: 200 + {"ok":true,"processed":0,"succeeded":0,"failed":0,"permanentlyFailed":0}
```

### 6. Configure cron-job.org

- New job → URL: `https://vitesse-eco.fr/api/cron/process-outbox`
- Method: POST
- Headers: `x-cron-secret: <value>`
- Schedule: `*/10 * * * *` (every 10 minutes)
- Timeout: 30s
- Notifications on failure: enabled
- Click "Test run" → expect HTTP 200 with the same JSON.

Confirm the next scheduled run timestamp before leaving the cron-job.org page.

---

## Phase 3 — Activate

### 7. Flip the flag

In Vercel env (Production):
- `ENABLE_PG_PRIMARY_ORDERS=true`

```
vercel deploy --prod
```

Wait for the deployment to be live before step 8.

### 8. Place a single test order

- Browser, incognito, on `https://vitesse-eco.fr`
- Add one in-stock product to cart, proceed to checkout
- Pick **in_store** payment, fill address, submit
- Note the returned `orderNumber`: `_______________________`

### 9. Verification (within 5 minutes)

Run all queries against Neon production and check Sanity Studio.

```sql
-- a. Order persisted to PG with correct shape
SELECT order_number, status, total, payment_method, customer_id IS NOT NULL AS auth
FROM orders ORDER BY created_at DESC LIMIT 1;
-- expect: order_number matches; total matches the cart subtotal+shipping-discount

-- b. Inventory decremented
SELECT product_id, stock, version, updated_at
FROM inventory WHERE product_id = '<the product _id>';
-- expect: stock = pre_value - quantity; version bumped; updated_at recent

-- c. Outbox drained (or close to it — opportunistic flush handles most)
SELECT id, kind, status, attempts, last_error
FROM outbox ORDER BY created_at DESC LIMIT 5;
-- expect: rows with status='done'; pending rows allowed only if cron hasn't fired yet.
-- If any row has status='failed' OR attempts > 2, STOP — see rollback.

-- d. Audit log captured the create
SELECT action, resource_type, resource_id, created_at
FROM audit_log WHERE resource_id = '<orderNumber>' ORDER BY created_at DESC;
-- expect: 'order.create' present

-- e. Event log captured the create
SELECT event_type, payload, created_at
FROM events WHERE payload->>'orderNumber' = '<orderNumber>'
ORDER BY created_at DESC;
-- expect: 'order_created' with matching orderNumber and total
```

In Sanity Studio:
- **f.** Orders → confirm the new order doc is present with the same
  `orderNumber`, items, customer, addresses.
- **g.** Open the product → confirm `stock` matches PG `inventory.stock` (NOT
  just a decrement of 1 from the cached old value — the dispatcher reads PG
  fresh, so they must be equal).

If (a)–(g) all match: activation is verified. Tick this box and
move on to monitoring.

- [ ] Activation verified at: `_______________________`

### Post-activation monitoring (first 24h)

- Place 2–3 more orders across the day; rerun queries (a)–(g) for each.
- Watch outbox: a healthy table has 0 `failed` rows and 0 rows with
  `attempts > 2` after the cron has had a chance to run.
- Watch Vercel function logs for `[OUTBOX]` errors and `STOCK_UNAVAILABLE` 409s.
- Compare a few products' stock between PG `inventory` and Sanity — they must
  not drift. If they do, reduce cron interval to `*/5 * * * *` and investigate.

---

## Rollback

Trigger if **any** of the following appears during or after activation:
- Verification step in Phase 3 (a)–(g) fails.
- `outbox` accumulates `failed` entries that we cannot explain.
- Stock drift between PG and Sanity exceeds 1 unit on any product.
- Customer reports a successful checkout that doesn't appear in Sanity admin
  within 15 minutes.

### Immediate

1. Vercel env: set `ENABLE_PG_PRIMARY_ORDERS=false` (or delete the var).
2. `vercel deploy --prod` to push the rollback live.
3. Verify next order goes through the legacy Sanity-first path:

   ```sql
   SELECT payload->>'path' AS path FROM events
   WHERE event_type = 'order_created' ORDER BY created_at DESC LIMIT 1;
   -- expect: 'legacy'
   ```

### What we do NOT do during rollback

- **Do not drop the migration.** The new tables are inert on the legacy path
  (they exist but aren't read or written). Dropping them would forfeit any
  data captured during the activation window and require a fresh migration
  later.
- **Do not delete the outbox rows.** They're our forensic trail; we
  reconcile them by hand.
- **Do not touch the Sanity dataset's product stock** until reconciliation
  decides which value (PG vs Sanity) is right. PG is authoritative for the
  activation window; Sanity is authoritative before and after.

### Reconcile

1. Pull the failed outbox entries:

   ```sql
   SELECT id, kind, payload, attempts, last_error, created_at
   FROM outbox
   WHERE status = 'failed' OR attempts > 5
   ORDER BY created_at DESC;
   ```

2. For each `sanity.order.create` failure: confirm the order is in PG
   (`SELECT * FROM orders WHERE order_number = ...`). If it is, push the
   matching doc to Sanity manually using the same payload shape.

3. For each `sanity.inventory.patch` failure: re-read PG `inventory` for that
   `product_id` and patch Sanity to match
   (`sanity patch <id> --set "stock=<n>"` or via Studio).

4. Audit-log the manual fix:

   ```sql
   INSERT INTO audit_log (actor_type, actor_id, action, resource_type, resource_id, metadata)
   VALUES ('engineer', '<your-name>', 'manual.reconcile', 'outbox', '<entry-id>',
           '{"reason":"...", "ticket":"..."}'::jsonb);
   ```

5. Update the outbox entry to `status = 'done'` so the dashboard query stays
   clean.

---

## Post-activation cleanup (only after 7+ days of green)

- Remove the legacy Sanity-first path from
  [server/api/orders/create.post.ts](../../server/api/orders/create.post.ts)
  (the `// ── Legacy Sanity-first path` block).
- Delete `ENABLE_PG_PRIMARY_ORDERS` env var (always-on now).
- Update [docs/PRODUCTION_UPGRADE_PLAN.md](../PRODUCTION_UPGRADE_PLAN.md) —
  mark P0-11 / ADR-001 as completed with the activation date.

Until then, the legacy path is our parachute — leave it intact.
