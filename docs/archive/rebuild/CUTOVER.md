# Cutover — rebuild → production

> **ARCHIVED — historical record, not instructions.** The rebuild finished and
> the cutover happened on 2026-07-30; this document is written about a state that
> has passed. For what is true now read
> [docs/architecture/CURRENT.md](../../architecture/CURRENT.md).

---

> The acceptance gate for replacing `master` with `rebuild`. Nothing here is
> aspirational: every line is either checkable by a command or is a named account
> the owner must open. Carried forward from the retired production-upgrade plan,
> with the items the rebuild already satisfies removed rather than re-listed.

---

## 0. Provisioned and proven — 2026-07-31

Executed with the credentials already present on the owner's machine. The
production environment of the live site was not touched; everything below is
scoped to the `rebuild` branch's preview environment.

| Done | How |
|---|---|
| ✅ Database `vitesse_rebuild` on the existing Neon project | Created beside master's `neondb` (never touched), migrations applied, 144 products' stock seeded |
| ✅ `SANITY_TOKEN` | Robot **Viewer** token minted via the manage API (id `si7kqGmdwE38gL`), deployed, reads verified |
| ✅ Vercel preview of `rebuild` | Branch-scoped env: fresh `AUTH_SECRET`/`IP_HASH_SALT`/`CRON_SECRET`, Turnstile TEST pair (real keys are hostname-locked), `ADMIN_EMAILS` = owner + sim admin (preview only) |
| ✅ **The full gate passed on that preview** | Simulator: 6 locales, nothing found. Money path: all 20 assertions in Neon — shelf 5→3 on cash received, back to 5 on cancel, stranger gets 404. The admin allowlist itself was proven: the first run's 403 was the guard rejecting a non-allowlisted admin |
| ⚠️ Preview SSO protection disabled | Required for the automated gate; re-enable in Vercel → Settings → Deployment Protection if unwanted |
| ✅ **Stripe wired and proven in test mode** — 2026-08-04 | Account fully activated (charges + payouts, FR/EUR). 24 payment methods enabled via the API, incl. iDEAL, Cartes Bancaires, Bancontact, Bizum, PayPal, Revolut Pay, Klarna, Alma. Test webhook `we_1U0i4sFnyhAob7rwTyCwBbpq` on the branch alias, pinned to the code's API version. `test:money:stripe` walked the real page in a real browser: 4242 through the embedded form → webhook → `paid` → shelf 5→4 in Neon. Test keys live in the gitignored `STRIP.TXT`; env trio set branch-scoped. One trap for posterity: piping env values through PowerShell appended `\r` and broke Stripe's auth header — values are set with bash `printf` now |

**Deliberately NOT done: making the dataset private.** The live `master` reads
the catalogue from the browser without a token — flipping now blinds the
running shop. It is the first act of the switch below.

## 1. What only the owner can do

| # | Thing | Why it blocks | Unlocks |
|---|---|---|---|
| 1 | **Appoint a consumer mediator** | Legally mandatory in France; the CGV page names none | legal exposure |
| 2 | **Stripe: the `sk_live` secret key** | Test mode is proven end-to-end (§0); live needs the live secret revealed from the dashboard, plus any live-mode terms Stripe asks a human to accept (PayPal links an external account) | real card payments |
| 3 | **Resend account + API key** | No mail is sent today; password reset and order email are built-blocked on this | email |
| 4 | **Legal review of the NL / DE / ES text** | Machine-assisted translation of binding terms | market entry |
| 5 | **Google Merchant Center account** | Four feeds are built and verified but registered nowhere | Shopping |
| 6 | **GS1 France prefix** | EAN codes must never be invented — see `cms/scripts/assign-gtins.mjs` | Amazon, bol, Kaufland |
| 7 | **The word "switch"** | Going live is a business decision, not a technical one | §5 |
| 8 | **Duplicate product decision** | `v20-pro-10-0-gris-narde` duplicates `-nardo` in Studio — hide or delete one | catalogue hygiene |

Detail and step-by-step: [OWNER_ACCOUNTS_PLAYBOOK.md](../../OWNER_ACCOUNTS_PLAYBOOK.md).

---

## 2. Known gaps, accepted knowingly

| Gap | State |
|---|---|
| **Password reset** | Not built. Blocked on Resend — a reset flow that cannot send mail is worse than none. Google sign-in covers part of it. |
| **Address autocomplete** | Not carried over from `master`. Addresses are typed in full and validated server-side. |
| **Transactional email** | No code path sends mail on this branch. |

---

## 3. Machine-checkable gate

Every line is a command. Run them in order; all must pass on the commit being cut over.

```bash
npm run check:langs        # 6 locales in sync, no linked-message @, placeholder parity
npm run check:hex          # no raw hex in .vue — fails if it scans nothing
npm run check:invariants   # the 11 project rules, suppressions printed
npx nuxi typecheck         # zero errors
npm run test               # unit + integration against a real PostgreSQL
npm run build              # from a COLD cache — a warm one can serve a stale bundle
npm run check:feeds        # feeds parse, and refuse to publish an empty catalogue
```

Then, against the production build (not the dev server):

```bash
npm run dev:db             # real embedded PostgreSQL, migrations applied
npm run seed:inventory     # stock rows from the live catalogue
node .output/server/index.mjs
npm run simulate -- http://127.0.0.1:3000 --locales fr,nl,de,es,en,ar
npm run test:money -- http://127.0.0.1:3000
npm run test:money:stripe -- <preview-url> <database-url>   # needs Stripe TEST keys + a webhook on that host
```

`simulate` must report **nothing**. `test:money` must reach *"the whole critical
path holds, in the datastore"* — which includes the shelf count dropping on
payment and returning on cancellation.

---

## 4. Manual acceptance — what a person still has to see

Automation cannot judge these.

- [ ] A customer can complete checkout in **fr, nl, de, es** on a phone and a laptop
- [ ] Arabic renders right-to-left, including the basket and checkout
- [ ] No disabled call-to-action anywhere without a visible reason next to it
- [ ] No banner, cookie notice or modal covers a primary button at any viewport
- [ ] Every interactive element on mobile is at least 44 × 44 px
- [ ] Lighthouse mobile ≥ 90 on home, listing, product, basket, checkout
- [ ] Prices shown on a product page equal the feed price for that market
- [ ] A cash order to Belgium reaches `/admin` and can be processed there

---

## 5. Switch and rollback

**Before the switch**
1. Point `DATABASE_URL` at the new Neon instance and apply `server/db/migrations`.
2. Set every variable in `.env.example` that has no `#` in front of it.
3. Deploy `rebuild` to a **preview** URL and run §3 against it — the alias is a
   different host, which is exactly the seam that hid a 403 on every write once.
4. Seed inventory and confirm `/api/catalog/products` returns real items.

**The switch** — each step is minutes, in this order
5. Wipe the sim identities from `vitesse_rebuild` (test orders from the gate).
6. Copy the preview env to Production (real Turnstile keys, owner-only
   `ADMIN_EMAILS`, fresh `CRON_SECRET`).
6b. Stripe goes live: create a **live-mode** webhook on
    `https://vitesse-eco.fr/api/webhooks/stripe` (same four events, same pinned
    API version) and put `sk_live` / `pk_live` / the live `whsec` into the
    Production env — values via bash `printf`, never a PowerShell pipe (§0).
    Re-run the payment-method activation POST against live mode; anything that
    refuses is a dashboard click, listed for the owner. The test-mode webhook
    stays, pointed at the preview.
7. `cd cms && npx sanity dataset visibility set production private` — the
   moment master stops being served, nothing legitimate reads without a token.
8. Merge `rebuild` into `master`, or repoint the production branch.
9. Immediately re-run `simulate` and `test:money` against the live domain.
10. Register the 15-minute external cron (cron-job.org, key in the owner's
    env) calling `/api/cron/maintenance` with the production `CRON_SECRET`;
    Vercel's own daily cron stays as the backstop.
11. Submit the sitemap in Search Console and register the four feeds.

**Rollback** — the previous deployment is one promotion away in Vercel. Nothing
in the rebuild writes to `master`'s database, so a rollback loses only orders
placed after the switch: export them from Neon first if any exist.
