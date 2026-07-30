# Cutover — rebuild → production

> The acceptance gate for replacing `master` with `rebuild`. Nothing here is
> aspirational: every line is either checkable by a command or is a named account
> the owner must open. Carried forward from the retired production-upgrade plan,
> with the items the rebuild already satisfies removed rather than re-listed.

---

## 1. What only the owner can do

These block cutover and cannot be done from the repository.

| # | Thing | Why it blocks | Unlocks |
|---|---|---|---|
| 1 | **Neon database** for the rebuild schema | The rebuild's tables do not exist on the current instance | everything |
| 2 | **`SANITY_TOKEN`** in Vercel | Catalogue reads fail closed without it — the shop serves nothing | catalogue |
| 3 | **Make the Sanity dataset private** | It is world-readable today; the token above is what makes closing it possible | privacy |
| 4 | **Stripe keys + webhook secret** | Card checkout stays hidden until set | card payments |
| 5 | **Appoint a consumer mediator** | Legally mandatory in France; the CGV page names none | legal exposure |
| 6 | **Resend + DNS records** | No mail is sent at all today | password reset, order email |
| 7 | **Legal review of the NL / DE / ES text** | Machine-assisted translation of binding terms | market entry |
| 8 | **Google Merchant Center account** | Four feeds are built and correct but registered nowhere | Shopping |
| 9 | **GS1 France prefix** | EAN codes must never be invented — see `cms/scripts/assign-gtins.mjs` | Amazon, bol, Kaufland |

Detail and step-by-step: [OWNER_ACCOUNTS_PLAYBOOK.md](OWNER_ACCOUNTS_PLAYBOOK.md).

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
npm run check:invariants   # the 10 project rules, suppressions printed
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

**The switch**
5. Merge `rebuild` into `master`, or repoint the production branch.
6. Immediately re-run `simulate` against the live domain.
7. Submit the sitemap in Search Console and register the four feeds.

**Rollback** — the previous deployment is one promotion away in Vercel. Nothing
in the rebuild writes to `master`'s database, so a rollback loses only orders
placed after the switch: export them from Neon first if any exist.
