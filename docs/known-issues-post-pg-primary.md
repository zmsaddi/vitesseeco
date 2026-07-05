# Known issues — post PG-primary activation

> **Status:** logged 2026-04-30 after Phase 3 step 9 verified the PG-primary
> pipeline end-to-end (test order `ORD-MOLMNP8P`). Each item is a UX-level
> bug or cosmetic warning that surfaced during activation but does **not**
> block orders. Order architecture stays put while PG-primary stabilises.
>
> **Do not bundle these into a single fix.** They have unrelated root
> causes; bundling makes review harder and rollback riskier.

## 1. ~~Confirmation page does not display orderNumber to the customer~~ — **fixed in [a0a9e6e](https://github.com/zmsaddi/vitesseeco/commit/a0a9e6e)**

- **Original symptom:** anonymous-or-logged-in checkout → submit order → page
  rendered but the orderNumber spot was empty.
- **Real root cause** (the original "SSR before hydration" theory was
  wrong): `pages/commande.vue` and `pages/commande/confirmation.vue` formed
  a parent/child route pair, but the parent had no `<NuxtPage />` slot, so
  `/commande/confirmation` matched the parent only and the confirmation
  child never rendered. SSR returned the parent's empty-cart layout while
  the order number lived only in the `__NUXT__` payload, never in visible
  HTML. Verified by `curl https://vitesse-eco.fr/commande/confirmation?order=...`
  showing zero `<strong>` tags.
- **Fix:** rename `pages/commande.vue` → `pages/commande/index.vue` so
  `/commande` and `/commande/confirmation` resolve as siblings. Plus a
  `hasValidOrderNumber` guard on the confirmation page that accepts only
  `ORD-[A-Z0-9]+` values, with a soft fallback message and `data-test`
  attributes for the regression suite.
- **Regression coverage:** three new e2e tests in `checkout-flow.spec.ts`
  pin (a) a valid number renders, (b) missing query falls back, (c)
  malformed `?order=javascript:alert(1)` falls back without leaking junk
  into the `<strong>` slot.
- **Verified live:** `curl /commande/confirmation?order=ORD-TEST123 → 200`
  with `<strong>ORD-TEST123</strong>` in the SSR HTML.

## 2. ~~Hydration mismatch warning on multiple pages~~ — **fixed 2026-07-05**

- **Root cause found:** the cart store persists to localStorage
  (`pinia-plugin-persistedstate`) and is restored synchronously while Vue
  hydrates, so for any visitor with items in the cart the SSR HTML of
  `/panier` and `/commande` (rendered empty) never matches the client
  render (filled). Auth was NOT a source — `plugins/auth.client.ts` fetches
  the user on `app:mounted`, after hydration. All layout-level
  client-state components were already `<ClientOnly>`.
- **Fix:** cart/checkout page content wrapped in `<ClientOnly>` with
  skeleton fallbacks (zero SEO value on those pages), including the
  mobile sticky pay bar.

- **Reproducer:** open vitesse-eco.fr in any browser → DevTools console →
  `Hydration completed but contains mismatches` warning fires.
- **Predates this session:** present before any 2026-04-30 changes.
- **Suspected sources:**
  - Auth-dependent UI (`v-if="auth.isLoggedIn"`) where SSR cookie state
    may differ from client localStorage hydration.
  - Locale-dependent formatting (i18n) computed at different times on
    SSR vs CSR.
  - Browser extension content injection (Google Translate / dictionary
    extensions) — visible in some user reports but not all.
- **Severity:** cosmetic, no functional break. But likely contributes to
  item 1.
- **Fix shape:** identify the mismatching component via Vue Devtools, then
  wrap with `<ClientOnly>` or move the divergent computation behind
  `onMounted`.

## 3. Turnstile widget "Nothing to reset" warning

- **Reproducer:** visit any page with `<TurnstileWidget>` (`/contact`,
  `/commande`) → expire the token → console fires
  `Uncaught TurnstileError: Nothing to reset found for provided container`.
- **Source:** [components/TurnstileWidget.vue:148-150](../components/TurnstileWidget.vue#L148-L150).
  The retry path calls `(window as any).turnstile.remove(widgetId)`
  on a `widgetId` whose underlying widget Cloudflare has already torn
  down. The `remove` call throws.
- **Severity:** cosmetic. The token still verifies on retry; the throw is
  swallowed by the surrounding try-block.
- **Fix shape:** wrap the `remove` call in its own try/catch or null-out
  `widgetId` before retrying.

## 4. `orders.guest_email` is populated even for logged-in customers

- **Observed:** ORD-MOLMNP8P has both `customer_id =
  28248bbf-938e-4e2f-a8eb-ca57cbdc4733` (logged-in) AND `guest_email =
  zmsaddi@gmail.com`. The two columns were intended as
  mutually-exclusive: `customer_id` for known accounts, `guest_email` only
  for anonymous checkouts.
- **Source:** [server/api/orders/create.post.ts:179-192](../server/api/orders/create.post.ts#L179-L192) populates
  `customerInfo.email` from the customer record, then
  `persistOrderPGPrimary` passes it as `guestEmail`. The branching by
  auth state was lost during the PG-primary refactor.
- **Severity:** data hygiene only — no functional break. But future
  reporting that filters on `guest_email IS NOT NULL` will mistake
  logged-in orders for guest ones.
- **Fix shape:** in `orderService.ts`, set `guestEmail: input.customerId
  ? null : input.customerSnapshot.email`. Logged-in orders should leave
  the column NULL.

---

## Tracking

These items are logged here rather than in `git` issues to keep the surface
small while PG-primary stabilises. When picked up:

1. Each gets its own commit + PR with a regression test where applicable.
2. Update this file: strike the entry, add a "Fixed in commit X" line.
3. Once all four are fixed and green for 7 days, delete this file.

| # | Issue | Status |
|---|-------|--------|
| 1 | Confirmation page orderNumber not visible | ✅ **Fixed** in [a0a9e6e](https://github.com/zmsaddi/vitesseeco/commit/a0a9e6e) |
| 2 | Hydration mismatch warning | ✅ **Fixed** 2026-07-05 — cart-driven pages made ClientOnly with skeletons (localStorage restore during hydration was the source) |
| 3 | Turnstile widget "Nothing to reset" warning | ✅ **Fixed** — retry() wraps `turnstile.remove` in try/catch (verified 2026-07-05, TurnstileWidget.vue:154) |
| 4 | `orders.guest_email` populated for logged-in customers | ✅ **Fixed** 2026-07-05 — both order-creation paths now NULL guest_email when customerId is set |
