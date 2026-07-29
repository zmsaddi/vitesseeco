# Vitesse Eco — Rebuild Architecture Contract

> Branch: `rebuild`. Clean build. `master` stays deployable until this replaces it.
> Every section is independently simulated (unit + integration + contract tests) before it is
> considered done. A section without passing tests does not exist.

## 1. Non-negotiable invariants

These are the rules that made the previous build accumulate 38 defects in a single audit pass.
Each one is now enforced structurally — a violation should fail to compile or fail a test, not
depend on a reviewer noticing.

| # | Invariant | Enforced by |
|---|-----------|-------------|
| I1 | Money is integer cents. Floats never touch a price. | `Cents` branded type; no `number` price fields |
| I2 | One owner per fact. Nothing is mirrored between stores. | Sanity = catalog; Postgres = everything transactional |
| I3 | No customer PII leaves Postgres. | Sanity dataset is private + server-only reads |
| I4 | Every request body is parsed by a Zod schema before use. | `defineValidatedHandler` wrapper |
| I5 | Every quantity, price and total is recomputed server-side. | Client sends ids + quantities only |
| I6 | Stock changes only inside a transaction that locks the row. | `reserveStock()` is the only write path |
| I7 | Every external event (webhook) is idempotent. | `webhook_events` unique constraint |
| I8 | Secrets and tokens are never readable by the browser. | Session token hashed at rest; httpOnly cookies |
| I9 | Locale ↔ URL ↔ hreflang derive from ONE manifest. | `shared/locales.ts` is the single source |
| I10 | Admin routes are deny-by-default. | Route-level guard, not per-handler opt-in |

## 2. Data ownership

```
SANITY (private dataset, server-side reads only)
  product, category, brand, article, landingPage,
  shippingMethod, promoCode (definition only), siteSettings, faq, testimonial
  → content the owner edits. No stock. No orders. No PII. No counters.

POSTGRES (Neon, Drizzle)
  customer, session, address, cart_reservation,
  order, order_item, inventory, promo_redemption,
  contact_message, webhook_event, audit_log, event
  → everything transactional, everything with a customer in it, everything that counts.
```

**Why stock is not in Sanity:** a document store cannot do an atomic conditional decrement.
The previous build kept `stock` in both and needed a background worker to reconcile them; the
worker was never scheduled, so the storefront showed numbers that drifted from reality.

**Why the dataset is private:** the storefront reads the catalog through server routes with a
read token, so no browser ever talks to Sanity directly. This removes the entire class of
"public dataset" exposure by construction rather than by remembering not to write PII.

## 3. Money

`Cents` is a branded integer. There is no other price representation anywhere in the system.

- Postgres: `integer` columns (`subtotal_cents`, `total_cents`, …). Never `decimal`, never `text`.
- Sanity: prices authored in euros, converted to cents at the boundary and validated.
- Display: formatted at the very edge, per locale, from cents.
- Every arithmetic operation goes through `shared/money.ts` so rounding happens in exactly one place.

## 4. Payments

One online path, two cash paths. Adding an online method must be a dashboard toggle, never code.

```
ONLINE  → Stripe, embedded in our own checkout page (ui_mode: embedded_page)
          cards · iDEAL · Bancontact · Klarna · PayPal · SEPA · Apple/Google Pay
          Dynamic payment methods: enabling one is a Stripe Dashboard switch.
          The hosted redirect page is NOT usable: it cannot do dynamic shipping options,
          and our free-delivery rule is postal-prefix scoped.

CASH    → cod       (own fleet collects at the door, BE + NL)
          in_store  (pickup and pay in Poitiers)
          These never touch a PSP. Separate, deliberate branch.
```

**Delayed notification is a first-class state.** iDEAL and Bancontact can complete a Checkout
Session before funds settle, so `checkout.session.completed` does NOT mean paid. The order state
machine has an explicit `awaiting_payment` state and handles
`checkout.session.async_payment_succeeded` / `async_payment_failed`.

**Stock is reserved, not decremented, while payment is in flight.** Authorization holds cannot be
used (Stripe manual capture is unsupported on iDEAL, Bancontact and PayPal — exactly our BE/NL
methods). Reservations carry an expiry and are released by both `checkout.session.expired` and a
sweep, so a missed webhook cannot strand inventory forever.

## 5. Order state machine

```
draft → awaiting_payment → paid → processing → shipped → delivered
              ↓                ↓
          cancelled ←──────────┘        (cancel restores stock, exactly once)
```

Transitions are declared in one table and validated centrally. Backwards transitions are
impossible, so a webhook redelivered three days later cannot reset a shipped order.

## 6. Internationalisation and domains

**One manifest drives everything**: `shared/locales.ts` declares each locale's code, hreflang,
currency, path prefix, and optional country domain. URL building, `hreflang`, canonical tags,
the sitemap, the language switcher and detection all read from it. Nothing hardcodes a prefix.

Three routing modes, switchable in that one file without touching any page:

| Mode | Shape | Status |
|------|-------|--------|
| `prefix` | `vitesse-eco.fr/de/...` | **active now** |
| `domains` | `vitesse-eco.de/...` maps to `de` | ready — set `domain` on the locale |
| `redirect` | `vitesse-eco.de` → 301 → `vitesse-eco.fr/de/...` | ready — set `domain` + `redirectToPrimary` |

Detection order (first hit wins, and the result is always a *suggestion* the visitor can override):
1. explicit locale in the URL (path prefix or matched domain) — never overridden
2. saved preference cookie
3. `Accept-Language` negotiated against supported locales
4. country → locale hint from the CDN geo header
5. default locale (`fr`)

A detected locale never silently redirects a crawler: bots get the URL they asked for, humans get
a dismissible banner. This keeps hreflang honest and avoids cloaking.

**Arabic:** Stripe Checkout does not support `ar` (it supports 57 locales; Arabic is available in
Elements but not Checkout). Recorded decision: Arabic visitors get the checkout in French. Arabic
is a site language, not one of the five target markets.

## 7. Security

| Area | Rule |
|------|------|
| Sessions | Random 256-bit token; **only its SHA-256 hash is stored**. Rotated on privilege change. |
| Passwords | bcrypt cost 12, constant-time compare, no user enumeration through timing or message |
| Cookies | `httpOnly`, `secure`, `sameSite=lax`; a separate non-authoritative flag cookie tells the client a session exists |
| CSRF | Origin/Sec-Fetch-Site check on every state-changing request, enforced centrally |
| CSP | Nonce-based, no `unsafe-inline`, no `unsafe-eval`; `frame-ancestors 'none'` |
| Headers | HSTS with preload, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Rate limit | Durable (Postgres), keyed on route path + platform-provided IP — never a client-supplied header, never the query string |
| Authorization | Ownership checked in the query itself (`WHERE customer_id = $me`), never after the fetch |
| Admin | Deny-by-default route guard + allowlist + TOTP second factor + full audit trail |
| Webhooks | Signature verified before parsing; `webhook_events` table makes replay a no-op |
| Input | Zod at every boundary; unknown keys rejected, not silently dropped |
| Uploads | None accepted from the public. Images come from Sanity's CDN only. |
| Secrets | Server-only runtime config. No key is ever serialised into the page. |

## 8. Verification — "each section simulated independently"

| Layer | Tool | What it proves |
|-------|------|----------------|
| Unit | Vitest | money, locales, validation, state machine, pricing — pure logic, no I/O |
| Integration | Vitest + real Postgres | stock races, reservations, idempotency, ownership |
| Contract | Vitest + Stripe fixtures | every webhook event we claim to handle, including replays |
| E2E | Playwright | the five buying journeys per locale and viewport |
| A11y | axe | every public page |
| Gates | CI | typecheck · lint · unit · integration · contract · e2e · locale parity · bundle |

Concurrency-sensitive code (stock, promo redemption, order numbers) is tested by running the
operation N times in parallel against a real database and asserting the invariant held — not by
reading the code and reasoning that it looks right.

## 9. Build order

Each step ships with its tests and is independently verifiable.

1. **Foundations** — locales manifest, money, validation, error model, config *(this commit)*
2. **Persistence** — schema, migrations, transaction helpers, seeding
3. **Security core** — sessions, CSRF, headers, rate limiting, admin guard
4. **Catalog** — private Sanity access, typed queries, caching, product/listing pages
5. **Cart & pricing** — server-authoritative pricing, promo, shipping eligibility
6. **Checkout & payments** — Stripe embedded, cash branches, webhooks, state machine
7. **Accounts** — register/login/OAuth, orders, warranties, addresses
8. **Admin** — orders, stock, messages, KPIs
9. **Content & SEO** — blog, legal, sitemap, hreflang, feeds, structured data
10. **Cutover** — parity check against `master`, then replace
