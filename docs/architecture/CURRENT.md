# What is true right now

> The one document that describes the system as it stands. If anything in
> [../archive/](../archive/) disagrees with this file, this file wins — that
> material describes a rebuild that finished and a cutover that happened.
>
> **Verified against the code and against `git`:** 2026-08-09.
> Every count and path below was produced by a command. If one is wrong, the
> document is the bug — fix it in the same commit.

---

## 1. Where the site comes from

| | |
|---|---|
| Production | `vitesse-eco.fr`, built from **`master`** on Vercel |
| `origin/master` and `origin/rebuild` | **the same commit** — the cutover happened 2026-07-30 |
| `origin/master-legacy` | the pre-cutover tree, kept for history. Do not build from it |
| `origin/paypal-sandbox-test` | an unmerged experiment. Not part of the running system |

`rebuild` is no longer a development line. It is a second name for the same
history, kept because the deployment and the CI were both wired to it during
the cutover. Work on a topic branch and merge to `master`.

A local `master` checked out before 2026-07-30 is the old root-level structure
and is **not** what ships. Check `git ls-remote origin master rebuild` before
believing otherwise.

---

## 2. What runs the checks

**One workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).**
It runs on `master` and `rebuild`, on push and on pull request.

| Job | Proves |
|---|---|
| `static` | locale parity · no raw hex · 17 invariants · documentation · Merchant feed guard · types |
| `unit` | 306 tests, pure logic, no I/O |
| `integration` | 101 tests against **real PostgreSQL 17**, then `scripts/assert-suite-ran.mjs` proves they were not skipped |
| `build` | production build and the bundle budget |
| `candidate` | builds **this commit**, seeds a real PostgreSQL and the committed fixture catalogue (`CATALOG_SOURCE=fixture` — no secret needed, refuses Vercel), serves it on `127.0.0.1:3000`, then runs the 6-locale simulator, the frontend gate, the money gate, and the four Playwright suites (functional · axe · RTL/reflow · visual) against it |
| `production-smoke` | Lighthouse against the live site. Advisory, and **not** a statement about the commit — Vercel deploys in parallel with this workflow |

The rule that shapes it: **a commit is tested by an artifact built from that
commit.** Until 2026-08-08 the E2E job pointed at a live alias and discovered
zero tests, so the pipeline was red on every push and could not have failed a
regression anyway.

---

## 3. Who owns which fact

| Fact | Owner | Never |
|---|---|---|
| Catalogue: products, colours, copy, images | **Sanity** `2jvnjf0c` / `production` | never holds a customer, an order or an address |
| Identity, addresses, orders, stock, sessions, rate limits | **PostgreSQL** (Neon) | never mirrors catalogue text |
| Prices as displayed | derived from Sanity by `server/services/pricing.ts` | never sent by a browser |
| Money on a placed order | frozen onto the order row at placement | never recomputed from today's rules |

**The Sanity dataset is public today.** An unauthenticated query returns the
catalogue. That is why no customer data may ever be written into it, and why
making it private is still an open owner decision — the step exists in
[the cutover record](../archive/rebuild/CUTOVER.md) and was deliberately not
taken.

---

## 4. The invariants, and what enforces each

Carried forward from the rebuild contract because they are still true. The
enforcement column is the part that matters: a rule nothing checks is a wish.

| # | Invariant | Enforced by |
|---|---|---|
| I1 | Money is integer cents; floats never touch a price | `shared/money.ts` is the only arithmetic; `tests/unit/money.spec.ts` |
| I2 | One owner per fact, nothing mirrored between stores | §3 above; the catalogue client is read-only |
| I3 | No customer PII leaves PostgreSQL | hard rule in [CLAUDE.md](../../CLAUDE.md); `scripts/redact-sanity-order-pii.mjs` exists because it once did |
| I4 | Every request body is parsed by a Zod schema before use | `defineRoute({ body })` in `server/security/handler.ts` |
| I5 | Every quantity, price and total is recomputed server-side | the cart schema accepts `{ productId, quantity }` and a promo **code**, nothing else |
| I6 | Stock changes only inside a transaction that locks the row | `server/services/stock.ts`; `tests/integration/stock.spec.ts` |
| I7 | Every browser-facing route declares access and rate limit as data | `defineRoute`; invariant 7 fails the build on an unguarded admin route |
| I8 | Only a public route may be held by a shared cache | `defineRoute` throws at module load; invariant 17 |
| I9 | Dates and money pin an explicit locale and timezone | invariant rule; the server runs in UTC and the shop is in Paris |

---

## 5. The shape of the code

```
app/          31 pages · 7 components · 4 composables — everything client-facing
server/
  api/        35 routes, each declaring access + rate limit via defineRoute
  routes/     10 machine files: sitemap, robots, llms.txt, 4 feeds, catalog.csv, blog.xml
  catalog/    Sanity reads: cached, token-gated — or the committed fixture catalogue under CATALOG_SOURCE=fixture (test rigs only)
  db/         Drizzle schema + 1 migration file
  payments/   adapter registry — cod · in_store · stripe
  security/   handler, session, crypto, rateLimit, request, headers, captcha
  services/   orders · pricing · stock · promo · orderState · audit · maintenance
shared/       used by BOTH sides: money, locales, markets, schemas, errors, organisation
tests/        14 unit files · 7 integration files · 5 browser gates · Playwright candidate specs (e2e/playwright/)
scripts/      13 gate and tooling scripts
cms/          Sanity Studio — its own app, excluded from the Vercel build
```

Dependency direction inside `services/`, checked by reading the imports:
`orders → orderState, stock, promo, pricing`; `pricing → stock, promo`; and
`stock`, `promo`, `orderState` import no sibling. There are no cycles.

---

## 6. Rendering

`ssr: true`, unconditionally, in [`nuxt.config.ts`](../../nuxt.config.ts).

It used to read `process.env.VERCEL === '1'`, a workaround from the first
foundation commit that outlived its reason. The effect was that a local
production build served a 3,027-byte shell with no title and no canonical,
while the same build with the variable served 17,986 bytes with both — so any
gate reading server-rendered HTML proved nothing unless an undocumented
variable happened to be set.

Locale routing is `prefix_except_default`: `/produits` is French, `/nl/produits`
is Dutch. `shared/locales.ts` owns hreflang, alternates and negotiation.
Price is a function of the URL, never of the visitor's IP — EU Regulation
2018/302 forbids the redirect, and Merchant Center suspends accounts whose feed
price differs from the crawled page.

---

## 7. Known open, as of this date

| | |
|---|---|
| Sanity dataset is public | An owner decision, recorded in the cutover archive. Nothing may be written into it that a stranger must not read |
| Lighthouse assertion phase is broken | `@lhci/cli@0.13.x` on Node 24 dies with `normalizeAssertion is not a function` after collection; the `production-smoke` job is advisory (`continue-on-error`) so nothing blocks on it. Separate CI debt, to be fixed in its own change |
| Four moderate advisories | `drizzle-kit`'s esbuild chain. The advisory concerns esbuild's development server; nothing here runs it, and the fix is a major bump of the migration CLI |
| Email | No mail is sent. Password reset and order email are built against an account that does not exist yet |

---

## 8. Where to look next

- **Rules to follow while coding:** [../../CLAUDE.md](../../CLAUDE.md)
- **Why something is the way it is:** [../adr/](../adr/)
- **Frontend findings and the mobile-first contract:** [../FRONTEND_MOBILE_FIRST_AUDIT_AND_PLAN.md](../FRONTEND_MOBILE_FIRST_AUDIT_AND_PLAN.md)
- **How the rebuild was done and how it went live:** [../archive/rebuild/](../archive/rebuild/) — history, not instructions
- **How not to ship a green build that is broken:** [../../skills/reality-check/SKILL.md](../../skills/reality-check/SKILL.md)
