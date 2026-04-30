# Known issues — post PG-primary activation

> **Status:** logged 2026-04-30 after Phase 3 step 9 verified the PG-primary
> pipeline end-to-end (test order `ORD-MOLMNP8P`). Each item is a UX-level
> bug or cosmetic warning that surfaced during activation but does **not**
> block orders. Order architecture stays put while PG-primary stabilises.
>
> **Do not bundle these into a single fix.** They have unrelated root
> causes; bundling makes review harder and rollback riskier.

## 1. Confirmation page does not display orderNumber to the customer

- **Reproducer:** anonymous-or-logged-in checkout → submit order → expected
  `/commande/confirmation?order=ORD-XXXX` shows the bold orderNumber on
  screen. Observed: page renders but the orderNumber spot is empty.
- **What we know is correct:** API returns `{ orderNumber, total, status,
  paymentMethod }` (verified for ORD-MOLMNP8P), client receives it, and
  `navigateTo` is called with `?order=...`.
- **Suspected:** [pages/commande/confirmation.vue:66](../pages/commande/confirmation.vue#L66) reads
  `route.query.order` in a `computed`. SSR likely renders before the query
  is hydrated, leaving the bound `<strong>{{ orderNumber }}</strong>` empty
  on first paint, and the hydration mismatch (item 2) prevents the client
  patch.
- **Severity:** UX-critical for the customer, but the data is correct in
  PG and Sanity — orders are not being lost, just not displayed.
- **Fix shape:** wrap the orderNumber render in `<ClientOnly>` or use
  `useRoute().query` reactively with a fallback that renders only after
  mounted. Likely 5-line patch.

## 2. Hydration mismatch warning on multiple pages

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

These four are logged here rather than in `git` issues to keep the surface
small while PG-primary stabilises. When picked up:

1. Each gets its own commit + PR with a regression test where applicable.
2. Update this file: strike the entry, add a "Fixed in commit X" line.
3. Once all four are fixed and green for 7 days, delete this file.
