# ADR-001: PostgreSQL is the primary store for orders

> Status: Accepted
> Date: 2026-04-29
> Related plan task: `P0-09` / `P0-10` / `P0-11` / `P0-12`
> Related issues: `SEC-01`, `SEC-03`, `SEC-09`

---

## Context

The current order creation flow (`server/api/orders/create.post.ts`) writes
the order to **Sanity first**, then attempts a secondary write to PostgreSQL
inside a silent try/catch. Stock decrement happens in Sanity using
`ifRevisionId` optimistic locking with a single retry.

This produces three real problems:

| ID | Problem |
|---|---|
| `SEC-01` | Stock race: `ifRevisionId` plus one retry is insufficient under concurrent traffic; the same SKU can be oversold. |
| `SEC-03` | Dual-write inversion: Sanity (a CMS) is the system of record for transactional financial data, while the relational store (PG) is treated as a best-effort mirror with a silent failure path. |
| `SEC-09` | If `SANITY_TOKEN` is missing, the order is created in PG only and the customer still sees success — silent partial-write data loss. |

Sanity's mutation API is optimistic-only. There is no cross-document
transaction primitive and no row-level pessimistic lock. We cannot solve
SEC-01 from the Sanity side alone.

---

## Decision

**Orders, inventory, and promo state become PostgreSQL-primary.**
Sanity continues to be the source of truth for catalog content (products,
images, descriptions, brands, categories, etc.) and serves as a synced
mirror for orders so that admins can keep using the existing Studio
dashboard.

Concretely:

1. The order creation request opens a single PG transaction that:
   a. Reads the relevant rows of a new `inventory` table with
      `SELECT … FOR UPDATE`.
   b. Validates that all requested quantities are still available.
   c. Inserts into `orders` (existing schema).
   d. Decrements `inventory.stock` for each line.
   e. Inserts a row into a new `outbox` table describing the Sanity
      payload to publish (order document + stock patches).
   f. Commits.
2. After the transaction commits, the route also attempts a synchronous
   "best-effort" outbox flush (see `P0-12`) so that admins typically
   see the new order within seconds. Failure here does not affect the
   customer — the entry remains in `outbox` and is retried.
3. A separate worker route is exposed for periodic outbox draining,
   triggered by an external free cron (e.g. `cron-job.org`) at 5–15min
   intervals. This complements the in-process flush from step 2.
4. Sanity remains authoritative for the **product catalog**. Stock in
   Sanity is downstream of `inventory` in PG: changes made in Studio are
   replicated into PG nightly (or on-demand). The catalog editor's
   experience does not change.
5. Promo `currentUses` (already addressed in `P0-01`) follows the same
   pattern: Sanity remains canonical for now (counter is small, low
   contention) but a follow-up may move this to PG if abuse becomes a
   concern.

---

## Consequences

### Positive

- Stock decrement becomes atomic with the order insert. Concurrent
  requests for the same SKU are serialized by the row lock; oversell is
  no longer possible (closes `SEC-01`).
- The customer can always see a deterministic outcome: either the
  transaction commits (success) or it rolls back (failure). No partial
  writes at the customer's point of view (closes `SEC-09`).
- Sanity outage no longer blocks order creation — the outbox absorbs the
  delay and the admin dashboard catches up when Sanity recovers.
- `orders.id` (UUID) is a stable, FK-enforced identifier for downstream
  features: refunds, status changes, tracking numbers, audit trails.

### Negative

- The catalog editor must understand that "stock" they see in Studio is
  a snapshot of the PG value as of the last sync. Editing stock in
  Studio is allowed but requires a sync-back step (manual or scripted).
  In Phase 0 we keep stock editing in Studio and sync `PG ← Sanity`
  nightly to avoid disruption; the inverse direction (`Sanity ← PG`)
  runs continuously through the outbox.
- Three new tables (`inventory`, `outbox`, `audit_log`) and one route
  (`/api/cron/process-outbox.post.ts`) are added.
- An external cron must be configured (cron-job.org) — documented in
  `docs/PRODUCTION_UPGRADE_PLAN.md` Q-08.

### Neutral

- The Neon free tier has plenty of headroom for the new tables (see
  Section 4 of the upgrade plan). No new monthly cost.
- Drizzle migrations exist already; adding tables is a single migration
  file.

---

## Alternatives considered

### A. Keep Sanity primary, add multiple retries

Pros: smallest change.
Cons: still racy under contention. Sanity has no document-level lock.
Multiple retries reduce the failure rate but do not eliminate it. Does
not address `SEC-09` (silent partial write when token absent).
**Rejected.**

### B. PG only, no Sanity orders sync

Pros: simplest model, no outbox.
Cons: admins lose the ability to view orders in Sanity Studio. Building
a parallel `/admin` UI (gated, role-aware, list/detail/state-change) is
weeks of work and is an explicit non-goal of Phase 0 (`Q-09`).
**Rejected.**

### C. Sanity mutation locks via a dedicated "mutex" document

Pros: keeps everything in Sanity.
Cons: hacky, hard to debug, the lock document itself is subject to
revision conflicts. Doesn't compose. Doesn't help with `SEC-09`.
**Rejected.**

### D. (Chosen) PG primary + outbox sync to Sanity

Standard pattern for "system of record + downstream search/CMS index"
architectures. Robust under failure of either side. Rolls back cleanly.
Catalog editing flow unchanged.

---

## Implementation outline

The implementation is intentionally split across multiple Phase 0 tasks
so that each is reviewable in isolation:

| Task | Deliverable |
|---|---|
| `P0-10` | Drizzle migration adding `inventory`, `outbox`, `audit_log`, `password_reset_tokens` tables, plus a backfill that seeds `inventory` from current Sanity stock. |
| `P0-11` | Refactor `orders/create.post.ts` to use the PG-primary transaction. Sanity write becomes an outbox enqueue. Existing endpoint contract preserved. |
| `P0-12` | Outbox processor: in-process best-effort flush + external-cron-driven draining route. Retry with exponential backoff. Sentry alert at attempt ≥ 5. |
| `P0-13` | Stock service (`server/utils/stock.ts`) that owns `SELECT … FOR UPDATE` semantics. Used by orders/create and any future flow that consumes inventory. |
| `P0-17` | Audit log helper that records every state change (orders, password resets, manual stock edits) with `actor`, `action`, `before`, `after`, `created_at`. |

Each task is gated behind a feature flag (`ENABLE_PG_PRIMARY_ORDERS`,
`ENABLE_PG_STOCK`) per the rollback plan in the upgrade doc, so we can
ship incrementally and disable any layer in seconds via Vercel env vars.

---

## Verification

The architecture must satisfy the following before the flag is flipped on
in production:

1. **Concurrent-order test** (extension of `P0-13` test): 10 parallel
   orders for a SKU with stock=3 must result in exactly 3 successful
   orders and `inventory.stock = 0`. No oversell.
2. **Sanity-outage simulation**: with the Sanity write-client mocked to
   throw, orders still commit to PG and accumulate in `outbox`. After
   un-mocking, the next cron tick drains the outbox cleanly.
3. **Token-missing simulation**: with `SANITY_TOKEN` absent, the order
   request still succeeds end-to-end (no silent partial write). The
   outbox grows and is later drained when the token returns.
4. **Catalog-edit interop**: editing stock in Studio still works without
   blocking customers. The next sync brings PG into line. Conflicting
   concurrent edits resolve in favor of the most recent write.
5. **Rollback drill**: setting `ENABLE_PG_PRIMARY_ORDERS=false`
   restores the previous Sanity-first flow within one redeploy. PG
   orders remain readable and replayable.

---

## References

- `docs/PRODUCTION_UPGRADE_PLAN.md` — sections 2.1 (`SEC-01/03/09`),
  3.ADR-01, 5.Phase 0, 6.P0-09 through P0-13, 9.Rollback Plan.
- Sanity docs on optimistic locking:
  https://www.sanity.io/docs/http-mutations#mutation-options
- Outbox pattern overview:
  https://microservices.io/patterns/data/transactional-outbox.html
