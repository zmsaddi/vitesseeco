# Browser verification of a candidate build

> How a pull request gets tested from a real browser against an artifact built
> from its own commit — with a catalogue and a database that cannot drift,
> vanish, or need a secret.
> **Last verified against the code: 2026-08-09.** If something here is wrong,
> the document is the bug — fix it in the same commit.

## The rig

Three deterministic pieces, then the suites:

```
PostgreSQL          scripts/seed-candidate.mjs   migrations + TRUNCATE + fixture inventory
Catalogue           CATALOG_SOURCE=fixture       server/catalog/fixture-catalogue.json
Server              node .output/server/index.mjs, built from THIS commit
```

The fixture catalogue is served by [`server/catalog/fixture.ts`](../../server/catalog/fixture.ts),
a fake Sanity client dispatching the same GROQ constants the production client
sends, over documents stored in the projected shape those queries return — so
the whole `parse.ts` validation pipeline runs unchanged. It refuses to
construct on Vercel and warns loudly on activation. Six products, four
categories, four shipping methods, one promo code, one article, two FAQ
entries; at least five products must stay sellable or the Merchant feeds
refuse to publish (`MINIMUM_PLAUSIBLE_OFFERS`).

Product image URLs in the fixture are fabrications in Sanity CDN shape (the
`@nuxt/image` sanity provider rewrites every src onto `cdn.sanity.io`, so no
local URL can reach the page). Every browser harness therefore serves those
requests from the committed
[`tests/e2e/playwright/assets/fixture-image.png`](../../tests/e2e/playwright/assets/fixture-image.png):
Playwright through its shared `test` fixture, the simulator through
`--fixture-images`.

## Running it locally

```bash
npm run dev:db                                        # embedded PostgreSQL on 5544
node scripts/seed-candidate.mjs postgres://vitesse:vitesse@localhost:5544/vitesse_dev
npx nuxi build                                        # NITRO_PRESET=node-server
CATALOG_SOURCE=fixture DATABASE_URL=postgres://vitesse:vitesse@localhost:5544/vitesse_dev \
  AUTH_SECRET=local IP_HASH_SALT=local \
  TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
  NUXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  ADMIN_EMAILS=sim-admin@vitesse-eco.test \
  NUXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 PORT=3000 node .output/server/index.mjs
```

Then, each suite (`TEST_BASE_URL` defaults to `http://127.0.0.1:3000`):

```bash
npm run test:e2e            # functional + a11y + rtl
npm run test:visual         # visual regression (needs this platform's baselines)
```

**Re-seed between full runs.** The checkout journey places a real cash order
and holds real stock; a second run against the leftovers asserts stock counts
that are no longer true. `seed-candidate` is the reset button — it truncates
everything and rewrites the fixture inventory, and it refuses any database that
is not localhost or named like a test.

The seed also feeds the two existing money/simulator gates:

```bash
node tests/e2e/money-path.mjs http://127.0.0.1:3000 postgres://vitesse:vitesse@localhost:5544/vitesse_dev
node tests/e2e/simulate.mjs http://127.0.0.1:3000 --locales fr,nl,de,es,en,ar \
  --fixture-images tests/e2e/playwright/assets/fixture-image.png
npm run verify:frontend -- http://127.0.0.1:3000
```

## What each suite owns

| Suite | Project | Owns |
|---|---|---|
| [`functional/`](../../tests/e2e/playwright/functional) | `functional` | the journey home → listing → PDP → basket → repricing → checkout (COD) → confirmation; sold-out, colour siblings, undo, promo; the server-price-authority contract |
| [`a11y/`](../../tests/e2e/playwright/a11y) | `a11y` | axe WCAG 2.0/2.1 A+AA on home, listing, PDP, cart, checkout, login — zero violations, blocking |
| [`rtl/`](../../tests/e2e/playwright/rtl) | `rtl` | `lang`/`dir`, geometric mirroring (header, popover alignment, inline icon order), what must NOT mirror (brand artwork, digits, phone numbers), Arabic funnel content, and reflow at 320/390/1366 in fr and ar |
| [`visual/`](../../tests/e2e/playwright/visual) | `visual` | eight screenshots: home/listing/PDP/cart/checkout mobile, home/PDP desktop, Arabic PDP mobile |

Division of labour with the standalone gates is deliberate:
**Playwright proves the customer's screen; [`money-path.mjs`](../../tests/e2e/money-path.mjs)
proves the database** — totals, VAT freezing, reservation TTLs, the shelf
dropping on payment, restocking on cancellation, a second identity refused.
Neither duplicates the other, and both run in CI against the same commit.

## The shared harness

Every spec imports `test` from
[`tests/e2e/playwright/helpers/test.ts`](../../tests/e2e/playwright/helpers/test.ts),
which gives it:

- **catalogue-image interception** (committed PNG, byte-identical every run);
- **hydration-aware navigation** — `page.goto` waits for Vue's mount mark, so a
  click can never land on a server-rendered button with no handler (the false
  negative the old simulator produced under load);
- **an error monitor** — `pageerror`, unexpected `console.error`, first-party
  5xx: any of them fails the test that caused them, visible assertions
  notwithstanding. The tolerated console patterns are enumerated in the file,
  each with its reason; the list is the entire policy.
- **fresh state** — Playwright gives each test its own context; `seedCart`
  writes a basket rather than inheriting one.

Fixture identities live in
[`tests/e2e/playwright/helpers/catalogue.ts`](../../tests/e2e/playwright/helpers/catalogue.ts)
and are read from the same JSON the server serves. `fixture-bike-in-stock` belongs
to the journey spec alone — it is the only product whose stock a spec may
change; every read-only spec uses `fixture-bike-sibling`.

## Accessibility exclusions

None exist. If one ever becomes unavoidable it must name the selector, the
rule, the reason and the finding that tracks it, inside
[`a11y.spec.ts`](../../tests/e2e/playwright/a11y/a11y.spec.ts) — a global
disable is not an exclusion, it is the gate being turned off.

## Visual snapshot policy

- Baselines are **committed for Linux** under
  `tests/e2e/playwright/visual/__screenshots__/linux/` — the platform CI runs.
  Windows/macOS runs write their own platform's baselines locally and git
  ignores them.
- **CI never updates a snapshot.** It compares, fails, and uploads the diff
  (`Keep the evidence` step). A missing baseline is a failure too.
- To update after an INTENDED visual change: run
  `npm run test:visual:update` on a Linux-compatible environment (the CI
  runner itself works: download the `playwright-evidence` artifact's actual
  images, review them with eyes, commit them as the new baselines), and say in
  the commit message what changed and why.
- Determinism levers, all already wired: fixture data, local images, DPR 1,
  reduced motion, disabled animations, `document.fonts.ready`, and a mask over
  the one third-party paint (the Turnstile iframe on checkout).

## What can and cannot fail this gate

Failing is the point — every suite has been observed failing before it was
trusted (a wrong stock count, an injected alt-less image, a flipped `dir`
expectation, a 2000px block, a renamed heading; see the introducing PR for the
evidence). What CANNOT fail it: a missing `SANITY_TOKEN`, an empty shop, or a
Vercel preview's environment — the rig does not use any of them. If the
fixture itself breaks, `global-setup.ts` fails every suite with instructions
instead of letting them skip.
