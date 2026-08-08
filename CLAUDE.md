# Vitesse Eco

> **Branch:** the cutover has happened. `origin/master` and `origin/rebuild`
> point at the same commit, and **production builds from `master`** — so this
> codebase is what vitesse-eco.fr serves. A local `master` checked out before
> the cutover is the old root-level structure and is not what ships; check
> `git ls-remote origin master rebuild` before believing otherwise.
> **Last verified against the code:** 2026-08-08.
> Every path, command and variable below was checked to exist. If something here
> is wrong, the document is the bug — fix it in the same commit.

Electric-mobility retailer in Poitiers, France. Bikes, parts, accessories, kids.

| | |
|---|---|
| **Domain** | vitesse-eco.fr · Vercel · GitHub `zmsaddi/vitesseeco` |
| **Contact** | contact@vitesse-eco.fr · +33 7 45 83 00 49 · wa.me/33745830049 |
| **Address** | 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers |
| **Company** | VITESSE ECO SAS · SIREN 100 732 247 · TVA FR43 100 732 247 |
| **Markets** | FR (primary) · BE · NL · DE · ES |
| **Languages** | fr (default) · en · nl · de · es · ar — 754 keys × 6, kept in sync by a gate |
| **Catalogue** | Sanity `2jvnjf0c` / `production` — 144 products, one per colour |
| **Node** | v24 |

---

## Hard rules

1. **Answer the user in Arabic.** Always.
2. **Nothing is done until it has been run.** Not "typechecks", not "tests pass" —
   run against a production build with real data. The method is a portable skill:
   [`skills/reality-check/`](skills/reality-check/).
3. **Never invent an EAN/GTIN.** Assignment happens only inside the owner's
   licensed GS1 prefix, via `cms/scripts/assign-gtins.mjs`.
4. **The Sanity dataset is public today.** No customer data may ever be written
   into it. Identity, addresses and orders live in PostgreSQL.
5. **Run the gates before every commit:** `check:langs`, `check:hex`,
   `check:invariants`. They are cheap and each has caught a real defect.
6. **PowerShell 5.1: never put `"` inside a git commit message.** Use a bash
   heredoc with `git commit -F -`.
7. **Money is asserted in the database, never in the UI.** A page can say
   "confirmed" while nothing was written.
8. **One product = one colour.** No variants array; colours of a model are linked
   by `modelFamily`.

---

## Commands

```bash
npm run dev                 # dev server
npm run build               # production build — clear .nuxt first if in any doubt
npm run test                # unit + integration (integration needs a database)
npm run test:unit           # 276 tests, no database needed
npm run dev:db              # embedded PostgreSQL on 5544 + migrations, data in .devdb/
npm run seed:inventory      # stock rows from the live catalogue
npm run simulate -- <url>   # browser sweep: 19 pages × 6 locales, feeds, purchase path
npm run test:money -- <url> # the critical path, asserted in the database
npm run check:langs         # locale sync, no linked-message @, placeholder parity
npm run check:hex           # no raw hex in .vue — fails if it scans nothing
npm run check:invariants    # 17 project rules
npm run check:feeds         # feeds parse and refuse to publish an empty catalogue
npx nuxi typecheck
```

The two simulation commands need a running server. Point them at
`node .output/server/index.mjs`, not at `nuxt dev` — a dev server that renders
client-side cannot show a server-side rendering defect.

---

## Structure

```
app/                       ← Nuxt 4 layout: everything client-facing
  pages/                   ← 31 pages, incl. admin/ (5) compte/ (4) commande/ (2)
  components/              ← CaptchaWidget, ContactLink, MarketSuggestion, SiteHeader, SiteFooter
  composables/             ← useCart, useFormatDate (locale + Europe/Paris pinned), useWishlist
  layouts/ middleware/ plugins/
server/
  api/                     ← 34 routes. Every one declares access + rate limit via defineRoute
    account/ admin/ auth/ cart/ catalog/ checkout/ content/ contact cron/ webhooks/
  routes/                  ← 10 machine files: sitemap, robots, llms.txt, 4 feeds, catalog.csv, blog.xml
  catalog/                 ← Sanity reads: client (cached, token-gated), queries, parse, types
  db/                      ← Drizzle schema + migrations. Driver chosen by URL shape.
  security/                ← handler (defineRoute), session, crypto, rateLimit, request, headers, captcha
  services/                ← orders, stock, pricing, promo, orderState, audit, maintenance
  payments/                ← adapter registry (index.ts): stripe | cod | in_store
  feeds/ middleware/ plugins/
shared/                    ← used by BOTH sides: money, locales, markets, schemas, errors, organisation
i18n/locales/              ← 6 files × 754 keys
cms/                       ← Sanity Studio, its own app and package.json, excluded from Vercel
scripts/                   ← the gates + dev-db + seed-inventory + redact-sanity-order-pii
tests/                     ← unit/ (11 files) integration/ (6 suites, real PostgreSQL) e2e/ (simulate, money-path)
skills/reality-check/      ← the portable working method
docs/                      ← see docs/README.md
```

There is **no** root-level `pages/`, `components/`, `stores/` or `plugins/` on
this branch. State lives in composables; there is no Pinia.

---

## How a request is served

**Every browser-facing API route is declared with `defineRoute`**
(`server/security/handler.ts`), which states its access level and rate limit as
data rather than as remembered discipline. The scheduled sweep is the one
deliberate exception, explained below.

```ts
export default defineRoute({
  access: 'admin',          // 'public' | 'customer' | 'admin'
  rateLimit: 'write',
  body: someZodSchema,
  handler: async ({ body, customer, market }) => { … },
})
```

- `access: 'admin'` checks the `ADMIN_EMAILS` allowlist. An invariant rule fails
  the build if any file under `api/admin/` lacks a guard.
- State-changing requests are checked by `assertSameOrigin`, which compares
  `Origin` against **the request's own Host** first. A static allowlist alone
  once rejected every write on the platform alias while the primary domain
  looked perfectly healthy.
- Rate limits are keyed on the route path, never on caller-supplied input.
- Errors are `AppError` with a code and a `messageKey`; the shape is identical in
  development and production so consumers can parse it.
- **`server/api/cron/maintenance.ts` is deliberately outside `defineRoute`.** A platform
  scheduler has no origin and no stable address, so it authenticates with a
  shared secret compared in constant time. Its filename carries no method suffix
  because Vercel Cron issues a **GET**, and a POST-only handler would answer 405
  forever while the dashboard reported the job as healthy.

---

## Money

- **Cents, always.** `shared/money.ts` is the only place arithmetic happens.
  Blank input parses to `null`, never `0` — that distinction once published a
  product at €0.00.
- **Price is a function of the URL** (host + locale), never of the visitor's IP.
  EU Regulation 2018/302 forbids the redirect, and Merchant Center suspends
  accounts whose feed price differs from the crawled page.
- **Market and VAT are frozen onto the order** at placement. They are never
  recomputed later from today's rules.
- **Stock moves under a row lock.** A reservation is taken at checkout and
  *consumed* on payment; cash-on-delivery holds get a 14-day TTL, online 30
  minutes. Cancelling a paid order restocks.
- Payment methods: `cod` and `in_store` need no keys; `stripe` hides itself until
  its keys exist.

---

## Markets and locales

`shared/markets.ts` is the single table. A market is *servable* if it is primary
or has a domain configured — BE and LU are priceable but not independently
servable, which is why they do not appear in Studio pickers.

Locale routing is `prefix_except_default`: `/produits` is French, `/nl/produits`
is Dutch. `shared/locales.ts` owns hreflang, alternates and negotiation.

**Dates and money must pin an explicit locale and timezone.** Vercel runs in UTC
and the shop is in Paris; `toLocaleDateString(undefined, …)` also produces
English month names on a server. An invariant rule enforces this.

---

## Testing

| Layer | What it proves | Command |
|---|---|---|
| unit | pure logic — money, locales, markets, schemas, parsing | `test:unit` |
| integration | concurrency, locking, transactions — against a **real** PostgreSQL | `test:integration` |
| simulate | 19 pages × 6 locales in a real browser: raw keys, hydration, 5xx, empty pages, price drift | `simulate` |
| money-path | the critical journey asserted in the database, including reversal and a second identity | `test:money` |

Integration tests must route through `db()`, the production accessor. A harness
that opens its own connection leaves the production connection path untested —
that is how a driver that could only speak to one vendor's proxy passed eighty
"real database" tests.

---

## Environment

See [.env.example](.env.example) — it lists exactly the variables the code reads,
nothing aspirational. The ones without a `#` are required for a working shop.

---

## Where to look next

- **Working on the code:** [docs/REBUILD_ARCHITECTURE.md](docs/REBUILD_ARCHITECTURE.md)
- **Picking up a task:** [docs/REBUILD_EXECUTION.md](docs/REBUILD_EXECUTION.md)
- **Going live:** [docs/CUTOVER.md](docs/CUTOVER.md)
- **Why something is the way it is:** [docs/adr/](docs/adr/)
- **How not to ship a green build that is broken:** [skills/reality-check/SKILL.md](skills/reality-check/SKILL.md)
