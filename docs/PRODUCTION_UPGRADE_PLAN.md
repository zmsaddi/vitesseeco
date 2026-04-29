# Vitesse Eco — Production-Grade Commerce Upgrade Plan

> **Status:** Approved — official reference for all upgrade work
> **Created:** 2026-04-29
> **Last reviewed:** 2026-04-29
> **Owner:** zmsaddi
> **Target completion:** ~10-12 weeks (Phase 0 first, then iterative)
> **Working directory:** `D:\vitesseeco`
> **Branch strategy:** feature branches per task → review → merge to `master`

---

## Table of Contents

1. [Project Goal](#1-project-goal)
2. [Current Known Issues](#2-current-known-issues)
3. [Architecture Decisions (ADRs)](#3-architecture-decisions-adrs)
4. [Free Tier Strategy](#4-free-tier-strategy)
5. [Phase Plan](#5-phase-plan)
6. [Task Breakdown](#6-task-breakdown)
7. [Definition of Done](#7-definition-of-done)
8. [Test Plan](#8-test-plan)
9. [Rollback Plan](#9-rollback-plan)
10. [Open Questions](#10-open-questions)
11. [Change Log](#11-change-log)

---

## 1. Project Goal

Bring Vitesse Eco from "working prototype with known gaps" to **production-grade commerce** without:

- Changing the visual identity (dark, electric-green, technical brand stays)
- Introducing paid services prematurely
- Over-engineering for hypothetical future requirements
- Breaking existing customer flows

### Success means

| Pillar | Concrete signal |
|---|---|
| **Security** | No known critical/high security or financial bugs |
| **Reliability** | Order creation cannot lose data, oversell stock, or duplicate-charge |
| **UX** | A customer can go from product → checkout → confirmation without ambiguous blockers |
| **Extensibility** | New payment/shipping methods can be added via Sanity + adapter pattern, not a rewrite |
| **Observability** | Errors and key business events are visible in Sentry + PG events table |
| **Cost** | All Phase 0 work runs on free tiers |

### Non-goals (explicitly out of scope)

- Stripe live payments (deferred to v2 — adapter prepared but not wired)
- Cart abandonment recovery emails
- Newsletter automation (Resend used only for transactional)
- Multi-currency support
- Advanced shipping rule engine (zone × weight × value matrix)
- Migration off Vercel/Sanity/Neon

---

## 2. Current Known Issues

Each issue has an ID for cross-reference (e.g., `SEC-01`). Severity: 🔴 critical / 🟠 high / 🟡 medium / 🟢 low.

### 2.1 Security & Data Integrity

| ID | Severity | Issue | Location |
|---|---|---|---|
| `SEC-01` | 🔴 | Stock race condition: only 1 retry on `ifRevisionId` conflict; concurrent orders can oversell | [server/api/orders/create.post.ts:186-229](../server/api/orders/create.post.ts#L186-L229) |
| `SEC-02` | 🔴 | `promoCode.currentUses` never incremented after order — codes reusable indefinitely | [server/api/orders/create.post.ts:107-120](../server/api/orders/create.post.ts#L107-L120) |
| `SEC-03` | 🔴 | Dual-write inversion: Sanity is primary for orders (silent PG fallback) — wrong for transactional data | [server/api/orders/create.post.ts:142-184](../server/api/orders/create.post.ts#L142-L184) |
| `SEC-04` | 🟠 | No password reset flow exists | server/api/auth/ |
| `SEC-05` | 🟠 | User enumeration on register (`Email already registered`) | [server/api/auth/register.post.ts:41](../server/api/auth/register.post.ts#L41) |
| `SEC-06` | 🟡 | Inconsistent email regex: 3 different patterns across endpoints | register.post.ts, contact.post.ts, validation.ts |
| `SEC-07` | 🟡 | Google Places API key surface area (proxied but no per-IP throttle on places/* beyond global rate-limit) | [server/api/places/autocomplete.get.ts](../server/api/places/autocomplete.get.ts) |
| `SEC-08` | 🟡 | No CSRF tokens on POST endpoints (relies on httpOnly + SameSite=lax) | server/api/auth/*, /orders/*, /contact |
| `SEC-09` | 🟡 | Sanity order create silently skipped if `SANITY_TOKEN` missing → potential silent data loss | server/api/orders/create.post.ts:143 |
| `SEC-10` | 🟡 | Session token (UUID) not rotated on login or activity | server/database/schema.ts |

### 2.2 Checkout & Order UX

| ID | Severity | Issue |
|---|---|---|
| `CHK-01` | 🔴 | Single shipping method not auto-selected → user clicks Checkout → silent error |
| `CHK-02` | 🔴 | Single payment method not auto-selected → same silent error |
| `CHK-03` | 🟠 | Turnstile pending/failure shows no message, only disables submit |
| `CHK-04` | 🟠 | No clear reason shown when checkout button is disabled |
| `CHK-05` | 🟡 | Cart drawer +/− buttons too small for mobile (<44px touch target) |
| `CHK-06` | 🟡 | Price not locked between `cart/validate` and `orders/create` — stale price possible if catalog changes mid-session |

### 2.3 UI / Accessibility

| ID | Severity | Issue |
|---|---|---|
| `UI-01` | 🟠 | Arabic missing from `LanguageSwitcher` despite `/ar` routes working |
| `UI-02` | 🟡 | `LanguageBanner` overlay can cover header / language switcher click target |
| `UI-03` | 🟡 | `CookieConsent` covers large portion of mobile viewport |
| `UI-04` | 🟡 | Footer social links render even when href is `#` |
| `UI-05` | 🟡 | Some filter inputs missing `aria-label` |
| `UI-06` | 🟢 | No unified focus-visible style across components |
| `UI-07` | 🟢 | Raw hex colors used in some `.vue` files instead of Tailwind tokens |

### 2.4 i18n / RTL

| ID | Severity | Issue |
|---|---|---|
| `I18N-01` | 🟡 | Address `32 Rue du Faubourg du Pont Neuf, 86000 Poitiers` hardcoded in 6+ pages |
| `I18N-02` | 🟡 | SIREN/legal info hardcoded in `cgv.vue` and `mentions-legales.vue` |
| `I18N-03` | 🟢 | RTL spot-checks not part of automated testing |

### 2.5 Performance

| ID | Severity | Issue |
|---|---|---|
| `PERF-01` | 🟡 | No bundle size budget enforced (current ~12.5MB total gzipped build output) |
| `PERF-02` | 🟡 | No Lighthouse threshold in CI |
| `PERF-03` | 🟡 | No INP/CLS/LCP monitoring (Web Vitals) |

### 2.6 Monitoring & Observability

| ID | Severity | Issue |
|---|---|---|
| `OBS-01` | 🔴 | No error tracking (Sentry pending) |
| `OBS-02` | 🟠 | No business event logging (add_to_cart, order_created, order_failed) |
| `OBS-03` | 🟡 | No alerting on order/email failures |

### 2.7 Testing Gaps

| ID | Severity | Issue |
|---|---|---|
| `TEST-01` | 🟠 | No E2E test for full checkout (cart → shipping → payment → confirmation) |
| `TEST-02` | 🟡 | No concurrent-order test for stock race |
| `TEST-03` | 🟡 | RTL Arabic flow not in E2E |

### 2.8 Free-tier & Operational Risk

| ID | Severity | Issue |
|---|---|---|
| `OPS-01` | 🟡 | Vercel Hobby ToS: project is commercial; technically requires Pro ($20/mo) — risk of account suspension |
| `OPS-02` | 🟡 | Google Places: free $200 credit/month covers current usage but no upper-bound enforcement |
| `OPS-03` | 🟢 | Sanity order creation skipped if `SANITY_TOKEN` env var absent — see SEC-09 |
| `OPS-04` | 🟢 | Neon free tier auto-sleeps when idle → first request after sleep is slow |

---

## 3. Architecture Decisions (ADRs)

### ADR-01: PostgreSQL is the primary store for orders

| Field | Value |
|---|---|
| **Decision** | Orders are written to PostgreSQL first within a transaction. Sanity receives an async sync for admin viewing only. |
| **Why** | PG is transactional, has FK constraints, supports `SELECT ... FOR UPDATE` for stock locking. Sanity is a content CMS, not an OLTP store. |
| **Alternatives rejected** | (a) Sanity primary + PG mirror (current — causes SEC-03). (b) PG only, no Sanity sync (loses admin visibility). |
| **Risks** | Sanity admin order list goes stale if sync fails. Mitigation: outbox table + retry. |
| **Rollback** | Feature flag `ENABLE_PG_PRIMARY_ORDERS=false` falls back to Sanity-first. |

### ADR-02: Stock decrement uses PG row lock + Sanity sync

| Field | Value |
|---|---|
| **Decision** | Mirror `stock` to a PG `inventory` table. Decrement using `SELECT ... FOR UPDATE` inside the order transaction. Push the new value to Sanity asynchronously. |
| **Why** | Sanity's `ifRevisionId` is optimistic-only; under concurrent traffic a single retry is insufficient (see SEC-01). PG row locks are pessimistic and atomic with the order insert. |
| **Alternatives rejected** | (a) Retry-loop in Sanity (5+ attempts with backoff) — better than today but still racy at scale. (b) Sanity mutation locks via mutex doc — hacky, hard to debug. |
| **Risks** | Sanity `stock` field becomes downstream of PG. Catalog editors must edit stock via PG (or via a Studio plugin that writes PG). For Phase 0 we keep editing in Sanity manually and sync PG ← Sanity nightly. |
| **Rollback** | Feature flag `ENABLE_PG_STOCK=false` keeps current Sanity-only flow. |

### ADR-03: Resend (free tier) for transactional email

| Field | Value |
|---|---|
| **Decision** | Use Resend free tier (100/day, 3000/month) for password reset, order confirmation, contact notifications. |
| **Why** | Free tier covers expected volume for early stage. Simple API. EU data residency available. Domain verification enforces SPF/DKIM. |
| **Alternatives rejected** | (a) Sendgrid free (100/day) — similar but less developer-friendly. (b) AWS SES — cheaper at scale, more setup. (c) Skip email — blocks password reset. |
| **Risks** | Free tier hard cap at 100/day. Mitigation: alert when daily count > 80. |
| **Rollback** | All emails are non-blocking (logged and retried); falling back to "no email" doesn't break the order flow. |

### ADR-04: Sentry (free tier) for error monitoring

| Field | Value |
|---|---|
| **Decision** | Sentry free tier with `tracesSampleRate: 0.1` and no session replay. Critical errors trigger email alerts. |
| **Why** | Free tier (5K errors + 10K performance events/month) is sufficient for early traffic. Industry-standard tooling. |
| **Alternatives rejected** | (a) Highlight.io free (heavier on session replay quota). (b) Self-hosted GlitchTip (operational overhead). (c) Console logs only (no aggregation). |
| **Risks** | If sampling misconfigured, free tier exhausts in days. Mitigation: pin sampling at 10% globally, 100% only on `error` level. |
| **Rollback** | Sentry SDK can be disabled via env var `ENABLE_SENTRY=false`. |

### ADR-05: PG events table for analytics (no GA4/Plausible yet)

| Field | Value |
|---|---|
| **Decision** | A single `events` table in PG records business events: `add_to_cart`, `checkout_started`, `order_created`, `order_failed`, etc. Cleanup older than 90 days. |
| **Why** | GA4 requires CMP (GDPR). Plausible costs €9/mo. We need _conversion funnel visibility_ first; pretty dashboards later. |
| **Alternatives rejected** | (a) GA4 with CookieFirst CMP (~€10-30/mo CMP fees). (b) Plausible (€9/mo). (c) Vercel Web Analytics (Pro plan only). |
| **Risks** | Manual SQL queries for analysis (no UI). Acceptable in early stage. |
| **Rollback** | Drop table — no UI depends on it. |

### ADR-06: Env-based feature flags (no LaunchDarkly)

| Field | Value |
|---|---|
| **Decision** | Feature flags via Vercel environment variables. Examples: `ENABLE_PG_PRIMARY_ORDERS`, `ENABLE_STRIPE`, `ENABLE_PASSWORD_RESET`. |
| **Why** | Free, simple, redeploy-on-change is acceptable at our cadence. |
| **Alternatives rejected** | LaunchDarkly (paid). Custom DB-backed flags (over-engineering for now). |
| **Risks** | Flag changes require redeploy. Acceptable. |

### ADR-07: Payment & shipping use a thin adapter pattern

| Field | Value |
|---|---|
| **Decision** | A `paymentAdapter` registry maps `paymentMethod.code` → handler module. Each handler implements `validate()`, `prepareOrder()`, `onWebhook?()`. Same for shipping. |
| **Why** | Allows adding Stripe / PayPal / Bank Transfer later by writing one module + adding the document in Sanity. No rule engine. No conditional matrix. |
| **Alternatives rejected** | (a) Rule engine with conditions (over-engineering for 1-2 methods). (b) Inline `if (code === 'stripe')` everywhere (current; doesn't scale). |
| **Risks** | Slight indirection cost. Acceptable. |

### ADR-08: Stay on Vercel Hobby for now; migration plan ready

| Field | Value |
|---|---|
| **Decision** | Continue on Vercel Hobby. Document migration to Cloudflare Pages as fallback. Upgrade to Vercel Pro ($20/mo) once 5+ orders/month are stable. |
| **Why** | Zero cost during early-stage traffic. ToS exposure is a temporary accepted risk while traffic is low; migration/upgrade trigger is documented. |
| **Alternatives rejected** | (a) Pro now ($20/mo before revenue exists). (b) Cloudflare Pages now (1-day migration cost during a tight schedule). |
| **Risks** | OPS-01: account suspension. Low probability, but blast radius is high (site goes down). Mitigation: keep migration scripts current. |

---

## 4. Free Tier Strategy

| Service | Free tier | Expected usage | Risk | Mitigation | Upgrade trigger |
|---|---|---|---|---|---|
| **Vercel Hobby** | 100GB bandwidth, 100GB-hr functions | 5–15GB/mo | OPS-01 (commercial ToS) | Cloudflare Pages migration plan | Stable orders ≥5/mo OR ToS warning |
| **Neon Postgres** | 0.5GB storage, 100h compute, 1 project | <100MB year 1 | Auto-sleep on idle (cold-start latency on first request) | Accept cold start initially. Only introduce keep-alive if checkout latency complaints emerge, and only with a budget that fits free-tier compute | >70% storage OR >80% compute |
| **Sanity Growth** | 10K docs, 5GB assets, 1M CDN req/mo | <200 docs, <1GB | None visible | `useCdn: true` everywhere | >70% asset storage |
| **Resend Free** | 100/day, 3000/mo | 10–50/day | Hard cap at 100/day | Sentry alert at 80/day | Sustained ≥80/day |
| **Sentry Free** | 5K errors, 10K perf, 1 user | Depends on sampling | Burn rate if sampling wrong | `tracesSampleRate: 0.1`, alert at 70% quota | Consistent errors >4K/mo |
| **GitHub Actions** | 2000 min/mo (private) or ∞ (public) | 10–15min/PR | Burn at high PR rate | Skip CI on docs-only changes | Burn >1500min/mo |
| **Cloudflare Turnstile** | Unlimited | Every checkout/contact | None | — | — |
| **Google Places** | $200 credit/mo | <70K req/mo currently | OPS-02 (uncapped surge) | API restrictions + per-IP rate limit + monthly budget alarm in GCP | Sustained >$150 spend |
| **Domain (.fr)** | n/a | ~€18/year | None | — | — |

**Total expected monthly cost during Phase 0:** ~€1.5 (domain prorated).

---

## 5. Phase Plan

```
Phase 0 ──> Phase 1 ──> Phase 2 ──> Phase 3 ──> Phase 4 ──> ongoing
Security    UX wins     DS tokens   Commerce    Extensible   QA + Monitor
8-10 d      2 d         2-3 wk      3-4 wk      1 wk         continuous
```

### Phase 0 — Security & Data Integrity (8–10 days)

Goal: zero known critical/high security or financial bugs; safe order creation; observability foundation in place.

Scope: SEC-01 through SEC-09, OBS-01, OBS-02, partial CHK-03.

### Phase 1 — UX Stabilization Quick Wins (2 days)

Goal: customer can complete checkout with zero ambiguous blockers.

Scope: CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, UI-01, UI-02, UI-03, UI-04.

### Phase 2 — Design System Incremental (2–3 weeks)

Goal: Tailwind config + main.css = single source of truth. CI prevents drift. No raw hex in `.vue`.

Scope: UI-06, UI-07, PERF-01 (bundle budget), motion tokens, focus-visible system, z-index layers.

### Phase 3 — Commerce UX (3–4 weeks)

Goal: ProductCard, product detail page, cart, checkout, search/filter feel like a real e-commerce store, not a demo.

Scope: CHK-06, refined empty states, order tracking page (basic), email confirmations wired.

### Phase 4 — Payment & Shipping Extensibility (1 week)

Goal: adapter pattern (ADR-07) in place; Sanity-driven config; ready to plug in Stripe in a single PR later.

Scope: pure refactor + Sanity schema cleanup + integration tests.

### Phase 5 — QA, Monitoring, Performance (continuous from Phase 0)

Goal: Lighthouse mobile ≥ 90 on key pages, Web Vitals targets met, Playwright covers critical flows in 4 languages × 2 viewports.

Scope: PERF-02, PERF-03, OBS-03, TEST-01, TEST-02, TEST-03, axe-core in CI.

---

## 6. Task Breakdown

> **Estimate scale:** XS = <1h, S = 1–2h, M = 2–4h, L = 4–8h, XL = 1–2 days, XXL = 2+ days.
> **Risk scale:** 🟢 low / 🟡 medium / 🔴 high (touches money/data integrity).

### Phase 0 — Security & Data Integrity

| ID | Task | Files / Modules | Risk | Estimate | Acceptance Criteria | Tests |
|---|---|---|---|---|---|---|
| `P0-01` | Increment `promoCode.currentUses` atomically on order success (fixes SEC-02) | `server/api/orders/create.post.ts`, `server/utils/promo.ts` (new) | 🔴 | M | Promo with `maxUses=1` rejected on 2nd use; counter increments only when order succeeds; no double-increment if order fails after promo applied | E2E: apply promo, place order, verify counter; 2nd attempt rejected with clear message |
| `P0-02` | Unify email validation via `validation.ts` (fixes SEC-06) | `server/utils/validation.ts`, `server/api/auth/register.post.ts`, `server/api/contact.post.ts`, `server/api/auth/login.post.ts` | 🟢 | S | All endpoints call same `isValidEmail()`; only one regex in repo; existing tests pass | Unit: email regex covers `a@b.c`, `a+b@c.io`, rejects `a@`, `@b`, etc. |
| `P0-03` | Generic register error: timing + message identical for new vs existing email (fixes SEC-05) | `server/api/auth/register.post.ts` | 🟡 | S | Response time and body do not reveal whether email exists; user receives email "Account already exists, reset your password?" if duplicate; new account proceeds | E2E: register existing email returns 200; check no `Email already registered` text |
| `P0-04` | Set up Resend account, verify domain `vitesse-eco.fr`, add `RESEND_API_KEY` to Vercel env | DNS records, Vercel env vars | 🟡 | M | Test email sent from `noreply@vitesse-eco.fr` lands in inbox (not spam) | Manual: send test to 3 inboxes (Gmail, Outlook, Proton) |
| `P0-05` | Email helper utility | `server/utils/email.ts` (new) | 🟢 | S | `sendEmail({ to, template, data })` works; templates in 6 languages; failures logged to Sentry | Unit: mock Resend client, verify locale resolution |
| `P0-06` | Password reset request endpoint | `server/api/auth/password-reset/request.post.ts` (new), `server/database/schema.ts` (`passwordResetTokens` table) | 🟡 | M | Token created with 1h expiry; email sent; rate-limited to 3/hr per email; existing-vs-not-existing email indistinguishable from response | E2E: request → email arrives → token in DB |
| `P0-07` | Password reset confirm endpoint | `server/api/auth/password-reset/confirm.post.ts` (new) | 🟡 | M | Valid token sets new password; token invalidated; all sessions for that customer deleted; email confirmation sent | E2E: full reset flow; expired token rejected; reused token rejected |
| `P0-08` | Password reset UI pages | `pages/mot-de-passe-oublie.vue` (new), `pages/reset-password/[token].vue` (new), 6-language strings | 🟡 | M | Forms validate, show clear errors, mobile-friendly, RTL works | E2E: happy path + invalid token |
| `P0-09` | Add ADR-001 doc; outline PG-primary order migration | `docs/adr/001-pg-primary-orders.md` (new) | 🟢 | S | Doc reviewed and approved | — |
| `P0-10` | Migration: create `inventory`, `password_reset_tokens`, `events`, `audit_log`, `outbox` tables | `server/database/schema.ts`, `drizzle/0001_*.sql` (new) | 🟡 | M | Drizzle migration runs cleanly on local + Neon; rollback script provided | Manual: `drizzle-kit push` on dev |
| `P0-11` | Refactor order creation: PG-first transaction with stock lock; Sanity write becomes outbox entry | `server/api/orders/create.post.ts`, `server/utils/orderService.ts` (new), `server/utils/stock.ts` (new) | 🔴 | XXL | Order persists to PG within a transaction that locks `inventory` rows; Sanity write enqueued to `outbox`; if PG fails, no order exists; if Sanity fails, order still succeeds + is retried | Unit: concurrent order test (5 parallel requests for same SKU with stock=2 → exactly 2 succeed) |
| `P0-12` | Outbox processor (no Vercel cron 1/min on Hobby) | `server/api/cron/process-outbox.post.ts` (new), `server/utils/orderService.ts` | 🟡 | M | Outbox entries processed via two complementary triggers: (a) opportunistically at the end of every order request (best-effort, in-process, time-budgeted), (b) external free cron (e.g. cron-job.org) hitting the route every 5–15min as a safety net. Success deletes entry; failure increments `attempts`; Sentry alert at 5 attempts. Re-evaluate Vercel Pro / alternative if sub-minute sync becomes required. | Unit: mock Sanity client to fail, verify retry; integration: trigger route with stale entries, verify drained |
| `P0-13` | Stock decrement: pessimistic lock with retry budget | `server/utils/stock.ts` | 🔴 | M | Concurrent decrement test passes; clear error returned to client when stock insufficient; never goes negative | Unit: 10 parallel `decrementStock(sku, 1)` with stock=5 → 5 succeed, 5 rejected |
| `P0-14` | Google Places API hardening | GCP Console (API key restrictions: HTTP referrer + API restrictions to Places API only), `server/api/places/autocomplete.get.ts` (per-IP rate limit) | 🟡 | M | API key only works from `vitesse-eco.fr` and `*.vercel.app`; per-IP limit 30/min; monthly budget alarm at $50 | Manual: try API key from curl → fails; from prod → works |
| `P0-15` | Turnstile UX states (loading / error / retry) | `components/TurnstileWidget.vue`, `pages/contact.vue`, `pages/commande.vue`, 6-language strings | 🟡 | M | User sees `Security check is loading…` while pending; `Security check failed — retry` on error; submit never disabled silently | E2E: throttle network → message appears; mock Turnstile failure → retry button appears |
| `P0-16` | Sentry setup (server + client) with sampling | `nuxt.config.ts`, `plugins/sentry.client.ts` (new), `server/plugins/sentry.ts` (new) | 🟢 | M | Errors visible in Sentry dashboard; `tracesSampleRate: 0.1`; alerts to email on `error` level | Manual: throw test error from server route → Sentry captures within 30s |
| `P0-17` | Audit log for order/auth events | `server/utils/audit.ts` (new), wire to order create / password reset / login | 🟢 | M | Every order, password reset, failed login written to `audit_log` table | Unit: helper writes correct shape |
| `P0-18` | Event logging for business funnel | `server/utils/events.ts` (new), wire to `cart store`, `orders/create`, `auth` | 🟢 | M | `add_to_cart`, `checkout_started`, `order_created`, `order_failed` events appear in `events` table | E2E: add product → query events table → row exists |
| `P0-19` | Tests for security flows | `tests/e2e/security.spec.ts` (new) | 🟢 | M | Concurrent order test passes; promo abuse test passes; password reset E2E passes | Playwright suite ✅ |
| `P0-20` | Update CLAUDE.md, README.md, this plan with progress | `CLAUDE.md`, `README.md`, `docs/PRODUCTION_UPGRADE_PLAN.md` | 🟢 | S | All docs reflect Phase 0 deliverables | Review |

### Phase 1 — UX Stabilization Quick Wins

| ID | Task | Files / Modules | Risk | Estimate | Acceptance Criteria | Tests |
|---|---|---|---|---|---|---|
| `P1-01` | Auto-select shipping method when only one is available (fixes CHK-01) | `pages/commande.vue`, `pages/panier.vue` | 🟢 | S | If `shippingMethods.length === 1` after fetch, the single option is selected by default | E2E: load checkout with one shipping → submit works without manual click |
| `P1-02` | Auto-select payment method when only one is available (fixes CHK-02) | `pages/commande.vue` | 🟢 | S | Same as above for payment | E2E: same |
| `P1-03` | Add Arabic to LanguageSwitcher (fixes UI-01) | `components/LanguageSwitcher.vue` | 🟢 | XS | AR appears in dropdown; clicking it routes to `/ar/<path>`; selected state highlights AR | E2E: click AR → URL contains `/ar/`, html `dir="rtl"` |
| `P1-04` | LanguageBanner z-index < header; auto-dismiss after 5s of header interaction (fixes UI-02) | `components/LanguageBanner.vue`, `assets/css/main.css` | 🟢 | S | Banner does not cover header click targets on any viewport | Playwright: hover language switcher with banner shown |
| `P1-05` | CookieConsent compact mobile layout (fixes UI-03) | `components/CookieConsent.vue` | 🟢 | S | On mobile, banner takes ≤25% of viewport height; dismisses on accept | Playwright mobile viewport: measure overlay |
| `P1-06` | CartDrawer +/− and delete buttons ≥44×44px (fixes CHK-05) | `components/CartDrawer.vue` | 🟢 | S | All interactive elements measure ≥44px in DevTools | E2E mobile: tap each button → action fires |
| `P1-07` | Hide footer social links when href is `#` or empty (fixes UI-04) | `components/AppFooter.vue` | 🟢 | XS | `<a>` elements with empty href not rendered | Snapshot test |
| `P1-08` | Show explicit reason when checkout submit is disabled (fixes CHK-04) | `pages/commande.vue` | 🟡 | S | Tooltip or inline text under button explains: missing field / Turnstile pending / address invalid | E2E: submit with each precondition missing → text matches |
| `P1-09` | Regression guards: out-of-stock filter, hard-refresh dispose, AR routing | `tests/e2e/regression.spec.ts` (new) | 🟢 | M | Tests cover: oos toggle, AR home loads, Ctrl+F5 on /produits no console error | Playwright suite ✅ |

### Phase 2 — Design System Incremental

| ID | Task | Files / Modules | Risk | Estimate | Acceptance Criteria | Tests |
|---|---|---|---|---|---|---|
| `P2-01` | Define token layers in `tailwind.config.ts` | `tailwind.config.ts` | 🟢 | M | Tokens: colors, spacing (4/8/12/16/24/32), radii (sm/md/lg), shadows, motion (durations/easings), z-index (header/banner/modal/toast) | Build passes |
| `P2-02` | Migrate raw hex usage in .vue → tokens | All `.vue` files | 🟡 | L | `grep -rE "#[0-9a-fA-F]{3,6}" pages/ components/` returns 0 results except in CSS files | CI lint rule (custom) |
| `P2-03` | Stylelint config to forbid raw hex in templates | `.stylelintrc.json` (new), CI step | 🟢 | S | `npm run lint:css` fails on raw hex inside class | CI |
| `P2-04` | Unified focus-visible ring | `assets/css/main.css` | 🟢 | S | All buttons/inputs/links show consistent `outline-2 outline-accent` on keyboard focus | Manual + axe |
| `P2-05` | Z-index layer system in Tailwind | `tailwind.config.ts` | 🟢 | XS | `z-header`, `z-banner`, `z-modal`, `z-toast` defined; usage replaces hardcoded `z-10/z-50` | grep |
| `P2-06` | Motion tokens (`duration-fast/normal/slow`, `ease-in-out-soft`) | `tailwind.config.ts` | 🟢 | XS | Used in `transition-*` classes | grep |
| `P2-07` | Standardize Button component (variants: primary/secondary/outline/danger; states: default/hover/focus/active/disabled/loading) | `components/Button.vue` (new) | 🟡 | M | All `<button class="btn-*">` migrated; existing visual identity preserved | Visual regression |
| `P2-08` | Standardize Input component | `components/Input.vue` (new) | 🟡 | M | All form fields use it; states: default/focus/error/disabled; localized error rendering | Manual |
| `P2-09` | Skeleton loaders unified | `components/Skeleton.vue` (new) | 🟢 | S | Existing skeleton in produits/index migrates | — |
| `P2-10` | Toast notification system | `components/AppToast.vue` (new), `composables/useToast.ts` (new) | 🟡 | M | Replaces `showAddedToast` in [slug].vue; queue, dismiss, types (success/error/info) | E2E: trigger toast → renders → dismisses |
| `P2-11` | Visual regression baseline (Playwright screenshots, no paid service) | `tests/visual/*.spec.ts` (new) | 🟢 | M | 5 critical pages × 2 viewports = 10 baselines committed; CI fails on diff | CI |

### Phase 3 — Commerce UX

| ID | Task | Files / Modules | Risk | Estimate | Acceptance Criteria | Tests |
|---|---|---|---|---|---|---|
| `P3-01` | ProductCard refinement: dense info, clear CTA, badges hierarchy | `components/ProductCard.vue` | 🟢 | M | Visual review approval | Visual + manual |
| `P3-02` | Product detail page: warranty/delivery near CTA, sticky CTA on mobile | `pages/produits/[slug].vue` | 🟡 | L | Add-to-cart visible without scroll on mobile | Playwright mobile |
| `P3-03` | Cart UX: clearer summary, error states, remove confirmation | `pages/panier.vue`, `components/CartDrawer.vue` | 🟡 | L | Removing last item shows empty state; quantity validation visible | E2E |
| `P3-04` | Checkout step indicator + clearer error messages | `pages/commande.vue` | 🟡 | L | User can navigate back to fix any step; errors show inline + at top | E2E |
| `P3-05` | Price-locking between validate and create (fixes CHK-06) | `server/api/cart/validate.post.ts`, `server/api/orders/create.post.ts` | 🔴 | M | Price snapshot signed and verified; if mismatch on create, user sees explicit "price changed" message | Unit |
| `P3-06` | Empty states audit: cart, search, orders history, account addresses | All listed pages | 🟢 | M | Each empty state has illustration/icon + CTA + i18n | Visual |
| `P3-07` | Order tracking page (basic, read-only) | `pages/compte/orders/[id].vue` (new) | 🟡 | L | Customer sees order details, status, tracking # if present | E2E |
| `P3-08` | Order confirmation email wiring | `server/api/orders/create.post.ts`, `server/utils/email.ts` | 🟡 | M | Email sent on order success; locale matches user | E2E |

### Phase 4 — Payment & Shipping Extensibility

| ID | Task | Files / Modules | Risk | Estimate | Acceptance Criteria | Tests |
|---|---|---|---|---|---|---|
| `P4-01` | Define `PaymentAdapter` interface | `server/payments/types.ts` (new), `server/payments/registry.ts` (new) | 🟡 | M | Interface: `validate(order)`, `prepareCheckout(order)`, `verifyWebhook(req)?`. Registry maps `code → adapter` | Unit |
| `P4-02` | Implement `InStoreAdapter` (current behavior moved to adapter) | `server/payments/adapters/inStore.ts` (new) | 🟢 | S | Existing in-store flow unchanged for the user | E2E |
| `P4-03` | Stub `StripeAdapter` (no live calls; just structure) | `server/payments/adapters/stripe.ts` (new) | 🟢 | S | Module exports adapter with throw-if-called handlers; not wired by default | — |
| `P4-04` | Define `ShippingAdapter` interface + use Sanity config (`isActive`, `priority`, `zones`, `freeAbove`) | `server/shipping/types.ts` (new), `server/api/shipping/methods.get.ts` | 🟢 | M | Active methods returned sorted by `priority`, filtered by `zones` matching user country | E2E |
| `P4-05` | Cleanup: replace inline `if (code === ...)` with adapter calls | `server/api/orders/create.post.ts` | 🟡 | M | No `paymentCode` switch statements outside `registry.ts` | grep |

### Phase 5 — QA / Monitoring / Performance (continuous)

| ID | Task | Files / Modules | Risk | Estimate | Acceptance Criteria | Tests |
|---|---|---|---|---|---|---|
| `P5-01` | Web Vitals client capture | `plugins/vitals.client.ts` (new) | 🟢 | S | LCP/CLS/INP captured per session; sent to Sentry as performance events | Manual |
| `P5-02` | Lighthouse threshold in CI (Lighthouse CI free) | `.github/workflows/lighthouse.yml` (new) | 🟢 | M | Mobile scores: Performance ≥90, A11y ≥90, SEO ≥90, Best ≥90 on home + produits + product detail | CI |
| `P5-03` | axe-core in Playwright | `tests/e2e/a11y.spec.ts` (new) | 🟢 | M | Zero critical/serious violations on home + produits + checkout | CI |
| `P5-04` | Bundle size budget | `nuxt.config.ts`, custom CI script | 🟢 | S | Initial JS ≤200KB gzip; CI fails over budget | CI |
| `P5-05` | Full checkout E2E in 4 languages (FR/EN/ES/AR) × 2 viewports | `tests/e2e/checkout.spec.ts` | 🟡 | L | Completes successfully in all 8 combinations | CI |
| `P5-06` | Sentry alert routing (email/Slack-free webhook) | Sentry dashboard config | 🟢 | S | Alerts fire on: order_failed, email_failed, stock_negative, sentry_error_burst | Manual |

---

## 7. Definition of Done

A release is **done** only when **every** item below is true:

### Build & CI

- [ ] `npm run build` succeeds locally and on Vercel
- [ ] `npm run check:langs` passes (all 6 locales in sync)
- [ ] TypeScript: no new errors (`nuxi typecheck` clean)
- [ ] Stylelint: no raw hex in `.vue` templates
- [ ] CI (GitHub Actions): all required checks green

### Functional

- [ ] Customer can complete checkout (cart → shipping → payment → confirmation) in FR, EN, ES, AR — both mobile and desktop
- [ ] Single shipping/payment auto-selected
- [ ] Order creation cannot oversell stock (verified by concurrent test)
- [ ] Promo codes cannot be used past `maxUses` (verified by abuse test)
- [ ] Password reset flow works end-to-end
- [ ] No CTA disabled silently — every disabled state has a visible reason
- [ ] Arabic appears in language switcher; RTL renders correctly

### Quality

- [ ] Lighthouse Mobile on home, /produits, /produits/[slug], /panier, /commande all ≥ 90 on Performance, Accessibility, SEO, Best Practices
- [ ] Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms (75th percentile, captured in Sentry)
- [ ] axe-core: zero critical/serious violations
- [ ] No console errors in DevTools on any of: home, /produits, /produits/[slug], /panier, /commande, /contact, /a-propos, /faq, /guide, /comparatif, /compte, /connexion, /inscription
- [ ] Mobile interactive elements ≥ 44×44px
- [ ] No overlay (banner / cookie / modal) covers primary CTA on any viewport

### Operations

- [ ] Sentry capturing errors; sampling within free-tier budget
- [ ] `events` table receives funnel events from at least: add_to_cart, checkout_started, order_created, order_failed
- [ ] `audit_log` records all order state changes and password resets
- [ ] Outbox processor running and draining (verified by zero entries older than 1h)
- [ ] All ADRs reviewed and signed off
- [ ] README + CLAUDE.md reflect current architecture

### Cost

- [ ] Monthly cost ≤ €5 (excluding domain renewal)
- [ ] No unexpected charges on Vercel, Neon, Sanity, GCP

---

## 8. Test Plan

### 8.1 Layers

| Layer | Tool | Scope |
|---|---|---|
| **Unit** | Vitest (to add) or plain `node --test` | Pure utilities: validation, email formatting, stock math, promo math, adapter selection |
| **API** | Vitest + supertest pattern via Nuxt's `$fetch` test helpers | Endpoints: auth/*, cart/*, orders/*, places/* — mocked Sanity + PG |
| **E2E** | Playwright (existing) | Real browser; runs against local preview or Vercel preview deployment |
| **Visual** | Playwright screenshots (no paid service) | Critical pages baselines |
| **A11y** | `@axe-core/playwright` | Critical pages |

### 8.2 E2E Coverage Matrix

| Flow | FR | EN | ES | AR | Mobile | Desktop |
|---|---|---|---|---|---|---|
| Home loads, no console errors | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product browse + filters | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product → cart → checkout → confirmation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Empty cart state | ✅ | — | — | — | ✅ | ✅ |
| Stock unavailable on checkout | ✅ | — | — | — | — | ✅ |
| Promo: valid / invalid / over max-uses | ✅ | — | — | — | — | ✅ |
| Register → login → logout | ✅ | — | — | ✅ | — | ✅ |
| Password reset | ✅ | — | — | ✅ | — | ✅ |
| Contact form (Turnstile loading + success) | ✅ | — | — | — | ✅ | ✅ |
| Turnstile failure → retry visible | ✅ | — | — | — | — | ✅ |
| Hard refresh on /produits with filters | ✅ | — | — | — | — | ✅ |
| Account → orders history | ✅ | — | — | — | — | ✅ |
| RTL layout sanity (text direction, icons mirror) | — | — | — | ✅ | ✅ | ✅ |

### 8.3 Manual QA Checklist (per release)

```
Browsers: Chrome latest, Safari latest (incl. iOS), Firefox latest
Viewports: 360×640, 390×844, 768×1024, 1280×800

[ ] Home loads in under 3s on 3G simulated
[ ] Add to cart → drawer opens → close → drawer closes
[ ] Cart drawer +/− work; touch targets feel comfortable
[ ] Language switch persists across navigation
[ ] AR: text right-aligned, icons mirror where appropriate
[ ] Cookie banner can be dismissed and stays dismissed
[ ] Forms: validation errors localized
[ ] Sanity Studio: order admin view shows latest orders within 5min
```

### 8.4 Failure-scenario Tests

| Scenario | Expected behavior |
|---|---|
| Resend API down | Order succeeds, email queued in outbox, retried; user not blocked |
| Sanity sync fails repeatedly | Order succeeds, outbox accumulates, alert fires after 5 failed attempts |
| Turnstile script blocked | Error message + retry button; submit not silent-disabled |
| Concurrent stock decrement | Pessimistic lock prevents oversell; rejected requests get clear error |
| Sentry over quota | Errors still logged to console + PG audit_log; site keeps working |
| Vercel function timeout (10s) | Order should never block on Sanity sync (it's async via outbox) |

---

## 9. Rollback Plan

Each high-risk task ships behind a feature flag; default is **off** in production until Phase 0 sign-off.

### Flags

| Flag | Default | Controls |
|---|---|---|
| `ENABLE_PG_PRIMARY_ORDERS` | `false` | If `false`, falls back to current Sanity-first dual-write |
| `ENABLE_PG_STOCK` | `false` | If `false`, uses current Sanity `ifRevisionId` flow |
| `ENABLE_PASSWORD_RESET` | `false` | Hides reset link in UI; endpoints return 404 |
| `ENABLE_RESEND` | `false` | All emails no-op (logged only) when off |
| `ENABLE_SENTRY` | `false` | Sentry SDK initialization skipped |
| `ENABLE_OUTBOX_CRON` | `false` | Vercel cron returns immediately when off |

### Rollback procedures

#### PG-primary order architecture

- **Detection:** Sentry alert on `order_failed`; spike in PG transaction errors; manual report from a customer
- **Rollback:** set `ENABLE_PG_PRIMARY_ORDERS=false` in Vercel, redeploy (≤2min)
- **Data preservation:** PG orders stay in DB; outbox entries stay (replayable later)
- **Side effects:** new orders go to Sanity-first path; PG orders may have gaps for the rollback window

#### Stock decrement

- **Detection:** alert on `stock < 0` in audit log; customer reports "ordered out-of-stock item"
- **Rollback:** set `ENABLE_PG_STOCK=false`; hot-fix Sanity values to last-known good
- **Data preservation:** snapshot `inventory` table before each daily sync; restore via SQL

#### Resend / email

- **Detection:** Sentry alert `email_failed`; Resend dashboard quota warning; bounce reports
- **Rollback:** set `ENABLE_RESEND=false`; emails no-op; manual support outreach for password resets
- **Data preservation:** all reset tokens remain valid; user can call/email support to receive token

#### Checkout UX changes (Phase 3)

- **Detection:** funnel drop in `events` table (e.g., `checkout_started → order_created` ratio falls >20%)
- **Rollback:** revert PR; redeploy
- **Data preservation:** N/A (UI only)

### Detection thresholds (set in Sentry)

| Event | Threshold | Action |
|---|---|---|
| `order_failed` | ≥3 in 10min | Page email |
| `stock_negative` | ≥1 ever | Page email + auto-disable `ENABLE_PG_STOCK` |
| `email_failed` | ≥10 in 1h | Email warning |
| `outbox_attempts ≥ 5` | per entry | Email + manual review |
| Sentry quota | ≥70% monthly | Reduce sampling automatically |

---

## 10. Open Questions

> Resolved on 2026-04-29. Decisions below are authoritative for execution.

| ID | Question | Decision |
|---|---|---|
| `Q-01` | Is admin viewing of orders in Sanity Studio required from day 1, or can it lag the PG source? | **Async sync acceptable, up to 5–15min lag in free tier.** |
| `Q-02` | Is order confirmation email a hard requirement for v1 release? | **Required before final release.** |
| `Q-03` | Is password reset a hard blocker for v1? | **Required before final release, but NOT a blocker for the first 3 quick wins (P0-01, P0-02, P0-03).** |
| `Q-04` | Should we plan migration to Cloudflare Pages now or keep as contingency? | **Contingency only for now.** |
| `Q-05` | Stripe in v2 (within 3 months) or v3 (6+ months)? | **v2 within ~3 months; no live integration now (adapter stub only).** |
| `Q-06` | Minimum acceptable analytics for now: SQL on PG only, or basic dashboard page in `/admin`? | **SQL on PG events only.** |
| `Q-07` | Who owns the GCP project for Google Places? Is the billing alarm going to a monitored inbox? | **Owner: zmsaddi. Billing alarm to a monitored inbox.** |
| `Q-08` | Vercel Hobby cron limits — what's our scheduling strategy for the outbox processor? | **No Vercel 1/min cron on Hobby. Use external free cron (e.g. cron-job.org) at 5–15min intervals AND opportunistic in-process processing at end of order requests. Re-evaluate Vercel Pro only if sub-minute sync becomes required.** |
| `Q-09` | Do we want a `/admin` route, or stay in Sanity Studio? | **Stay in Sanity Studio. No `/admin` for now.** |
| `Q-10` | Should AR be machine-translated and reviewed, or human-only? | **Machine translation + native-speaker review.** |

---

## 11. Change Log

| Date | Author | Change |
|---|---|---|
| 2026-04-29 | zmsaddi + Claude | Initial draft created |
| 2026-04-29 | zmsaddi + Claude | Approved for use as official reference. Adjustments: removed Neon keep-alive ping (cold-start accepted); outbox processor uses opportunistic + external free cron (no Vercel 1/min); Vercel ToS wording made more professional; Open Questions resolved with project owner's decisions |

---

## Appendix A — Useful commands

```bash
# Check all locales in sync
npm run check:langs

# Type check
npx nuxi typecheck

# Build locally (must succeed before merge)
npm run build

# Run all E2E tests
npm run test:e2e

# Run E2E with UI (debugging)
npm run test:e2e:ui

# Drizzle: push schema to Neon
npx drizzle-kit push

# Drizzle: generate migration
npx drizzle-kit generate
```

## Appendix B — Where things live

| What | Where |
|---|---|
| Pages | `pages/` |
| Components | `components/` |
| Composables | `composables/` |
| Pinia stores | `stores/` |
| Server API | `server/api/` |
| Server utils | `server/utils/` |
| Database schema | `server/database/schema.ts` |
| Sanity schemas | `cms/schemas/` |
| Sanity Studio config | `cms/sanity.config.ts` |
| i18n locales | `i18n/locales/` |
| E2E tests | `tests/e2e/` |
| Migration scripts | `import-data/` |
| This plan | `docs/PRODUCTION_UPGRADE_PLAN.md` |
| ADRs | `docs/adr/` (created in P0-09) |
