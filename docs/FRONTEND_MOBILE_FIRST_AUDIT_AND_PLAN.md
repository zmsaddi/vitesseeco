# Vitesse Eco — Mobile-First Frontend Audit and Claude Code Execution Plan

> **Audit date:** 2026-08-08  
> **Audited revision:** `c0498b2` (`rebuild`; also current `origin/master`)  
> **Audience:** Claude Code and the repository owner  
> **Status:** execution contract, not a claim that the work is complete

## 1. Mission

Turn the current storefront into a coherent, conversion-ready, mobile-first
commerce experience without weakening the proven pricing, stock, order, payment,
security, market, or locale rules.

This plan covers:

- the public storefront and its complete browse-to-order journey;
- authentication, customer account, guest confirmation, and saved addresses;
- the admin frontend after the customer funnel is safe;
- design system, responsive layout, accessibility, RTL, localization, loading
  and error states, performance, SEO, privacy, PWA, and frontend observability;
- deterministic browser, visual, accessibility, and production-reality gates.

It does **not** authorize a rewrite of the money engine. Server prices remain
authoritative, stock remains PostgreSQL-backed, one product remains one colour,
and all existing security wrappers and route contracts remain in force.

## 2. How Claude Code must use this document

1. Read `CLAUDE.md` and `skills/reality-check/SKILL.md` first.
2. Treat the current code as truth. `docs/archive/rebuild/REBUILD_EXECUTION.md` contains
   completion marks for UI that is not present in this tree.
3. Do not restore the former frontend wholesale and do not blindly cherry-pick
   historical commits. Old code is reference material only.
4. Execute one work package at a time, in the order defined below.
5. Before editing a package, record its baseline screenshots, behavior, console
   output, and relevant API contracts.
6. Preserve unrelated user changes and keep each package reviewable.
7. A package is complete only after its acceptance criteria are exercised
   against a cold, SSR, production-shaped build with seeded data.
8. Update the execution tracker only after the new gate has been seen passing,
   and where practical after deliberately proving that the gate can fail.

## 3. Evidence-backed baseline

### 3.1 What is already strong

- Nuxt/Vue/Tailwind are configured with strict TypeScript and server rendering
  on the deployment path.
- Semantic colour tokens, logical RTL utilities, a global visible focus ring,
  reduced-motion handling, a skip link, `lang`/`dir`, canonical/hreflang
  generation, and structured-data foundations already exist.
- Shared price and date formatters pin locale and timezone.
- The cart stores identifiers and quantities rather than trusting stale client
  prices.
- Product prices, market rules, stock, checkout totals, and order placement are
  server-authoritative.
- The 390×844 purchase-path screenshots show a consistent visual base, readable
  forms, a functioning sticky PDP action, a reachable cart, and guest checkout.

### 3.2 Measured current state

| Signal | Observed result |
|---|---|
| Public/customer/admin pages | 31 Vue pages |
| Shared UI components | 6 |
| Composables | 4 |
| Locale parity | 766 keys × 6 locales, passing |
| Unit suite | 13 files, 301 tests, passing |
| Typecheck | passing |
| Cold production-shaped SSR build | passing, with font and BigInt warnings |
| Real catalogue used by the visual walk | 143 products |
| Listing links in the visual walk | 24 |
| Checkout visible fields before interaction | 9 |
| Current visual viewports | 390×844 and 1366×768 only |
| Strict 320px French reflow | document width 342px; global horizontal overflow |
| Strict 320px Arabic reflow | document width 322px; global horizontal overflow |
| Playwright `e2e` specs discovered | 0 |
| Playwright `visual` specs discovered | 0; directory absent |
| Webfont faces in the restricted cold build | 0 |
| Production dependency audit | 3 high, 1 low vulnerability |
| Six-locale production-shaped simulator | 6 high: catalogue CSV 500, four Merchant feeds 503, and a purchase-link false negative after locale-state reuse |

### 3.3 Checks run during this audit

- `npm run check:langs` — passed, 766 keys in each locale.
- `npm run check:hex` — passed.
- `npm run check:invariants` — passed, 13 rules.
- `npm run check:docs` — passed, but it validates named paths/commands rather
  than feature-completion claims.
- `npm run typecheck` — passed.
- `npm run test:unit` — passed, 301 tests.
- Cold `VERCEL=1` production build — passed.
- Cold `VERCEL=1 / NITRO_PRESET=node-server` SSR build — passed.
- A browser audit over 57 route/profile combinations at 320px and 390px in FR
  and AR — no missing `h1`, labels, or image `alt` attributes in the sampled
  empty states; numerous undersized link targets and no loaded font faces.
- Strict CSS reflow audit over 38 FR/AR cases at 320px — every sampled route
  overflowed because of the mobile header.
- Production-shaped visual purchase walk against the live catalogue and seeded
  local PostgreSQL — home → 24-item listing → in-stock PDP → cart → checkout,
  on desktop and mobile.
- The full six-locale simulator completed 114 localized page visits and its
  machine/purchase phases. It reported catalogue CSV 500, four localized
  Merchant feeds 503, and no French product link after the locale sweep. A
  fresh-context walk against the same running build found 24 links and completed
  the purchase path, proving that the purchase finding is currently a harness
  state-isolation problem. The feed failures remain unresolved evidence.

### 3.4 Important limitations of the evidence

- The first full simulator run had no seeded inventory and correctly could not
  complete the purchase path. This exposed a flaw in `ux-walk.mjs`: it selects
  the first product even if its add button is disabled, then times out.
- The simulator reuses one browser context across all locales and then the
  unprefixed French purchase path. Its purchase result conflicts with the
  passing fresh-context walk, so it cannot be a reliable release gate until
  locale cookies/storage and purchase context are isolated. This does not
  dismiss its separately reported machine-route feed failures.
- Restricted browser runs cannot fetch remote Sanity images, Google/Cloudflare
  resources, or remote icon data. Those failures are environment facts unless
  reproduced in the unrestricted production-shaped run.
- The visual walker scrolls to the document end for its “checkout bottom”
  screenshot; this captures the footer rather than the submit control and its
  `isVisible()` check does not prove the CTA is inside the viewport.
- No field Core Web Vitals, conversion analytics, real assistive-technology
  session, or native-language review was available in this audit.

## 4. Findings by priority

### P0 — truth, purchase safety, and broken gates

#### P0.1 Documentation and code disagree

`docs/archive/rebuild/REBUILD_EXECUTION.md` marks search, mobile filters, filter chips, cart
drawer/undo, breadcrumbs, trust rows, wishlist entry points, checkout validation,
sticky checkout actions, visual tests, and locale browser tests as complete.
The current tree does not contain those components or behaviors. Even the header
comment says mobile search is visible while the header template has no search.

**Required outcome:** reconcile the tracker before implementation, and add an
executable feature-presence/coverage check so prose cannot claim a removed
frontend is live.

#### P0.2 Browser, visual, and accessibility gates are empty

`playwright.config.ts` describes functional/a11y and visual suites, but
`tests/e2e` contains standalone scripts rather than Playwright specs and
`tests/visual` does not exist. Master CI invokes the empty E2E suite against an
already-deployed URL. Lighthouse checks only home/listing and is non-blocking.

**Required outcome:** test the commit's own seeded SSR artifact; fail if zero
tests are discovered; add real functional, axe, RTL, reflow, and visual specs.

#### P0.3 The global mobile header overflows at 320px

The non-shrinking wordmark plus language, cart, and menu controls produce a
342px French document at a 320px viewport. Arabic still overflows by 2px. This
affects every route. Search, account, and wishlist cannot be added to this row
without redesigning it.

**Required outcome:** a compact 320px shell with no global horizontal overflow,
an always-available search path, visible cart, and discoverable account and
wishlist without overcrowding the primary row.

#### P0.4 Checkout is not a semantic form

`app/pages/commande/index.vue` uses a `type="button"` submit outside a `form`.
Native email/required validation and Enter submission never run. There are no
per-field errors, `aria-invalid`, described errors, form summary, first-error
focus, or explanation for the disabled CTA.

It also:

- defaults every locale/market to France;
- launches uncancelled shipping requests on postcode changes, without debounce,
  pending/error/retry states, or stale-response protection;
- shows nine fields before the user can understand available delivery;
- does not use saved addresses;
- omits order lines and an edit-cart link from checkout review;
- leaves the mobile CTA below a long form instead of under the thumb;
- does not render the available delivery estimate;
- can become permanently blocked when CAPTCHA cannot load.

**Required outcome:** a guest-first semantic form with market-derived defaults,
schema-aligned validation, resilient delivery lookup, complete order review,
truthful disabled reasons, CAPTCHA recovery, and a mobile sticky total/action.

#### P0.5 Catalog and content failures masquerade as valid empty states

Home defaults failed fetches to empty arrays. Product/blog listing failures look
like “no results.” Detail dependency failures become 404. A failed catalogue can
silently remove product URLs from the sitemap.

**Required outcome:** distinguish empty, not found, timeout, offline, and
dependency failure; show retry UI; alert on catalogue failure; never return a
false 404 for a 5xx upstream fault. A timestamped last-good sitemap URL inventory
may be used under an explicit freshness policy. Merchant feeds must fail
explicitly when fresh price/stock cannot be established unless the owner
approves a short, monitored freshness window; they must never serve an
unbounded stale commercial snapshot.

#### P0.6 Critical routes and capabilities are disconnected

- No global account/sign-in link exists.
- Account order cards do not link the existing order-detail route.
- The profile route has no incoming navigation.
- Wishlist storage and `/favoris` exist, but no PDP/listing control can save a
  product and navigation never links the page.
- Listing accepts type/category URL filters but exposes no controls, active
  chips, result count, or clear action.
- Guest confirmation links to account orders even though guest orders are not
  accessible there.
- Password reset does not exist.

**Required outcome:** every supported capability has an honest entry point and
return path; guest CTAs must describe what a guest can actually do.

#### P0.7 Frontend delivery is not reproducible

- SSR depends on `process.env.VERCEL === '1'`; normal local build commands can
  produce a different rendering mode.
- A cold restricted build could not generate `Inter`/`Manrope` faces and silently
  fell back to system fonts.
- The Phosphor icon collection is not installed locally; missing bundled icons
  can fall back to remote Iconify behavior that conflicts with the CSP.
- Build warnings say BigInt literals target `es2019` and may fail at runtime.

**Required outcome:** one cross-platform `build:production` command, local
fonts/icons, built-artifact sentinels, zero remote Iconify dependencies, and no
runtime-target warnings.

#### P0.8 SEO product identity is internally inconsistent

Colour variants canonicalize to one alphabetical family slug, while hreflang,
sitemap, JSON-LD, and Merchant feeds continue to use the current variant URL.
That can submit URLs that declare another URL canonical and can make feed/schema
identity disagree.

**Decision gate:** do not preserve the inconsistent mixed state. The recommended
default is to keep each colour as a sellable, self-canonical product URL because
the catalogue and Merchant feeds already sell one product per colour, connecting
siblings with ProductGroup/variant structured data and unique colour content.
Before implementation, confirm the intended acquisition strategy with the owner
and inspect available Search Console/index evidence. If one family canonical is
chosen instead, sitemap, hreflang, JSON-LD, feeds, internal links, and visible
content must all use that one strategy consistently.

#### P0.9 Privacy and post-purchase disclosures are incomplete

The privacy page does not fully inventory wishlist local storage, checkout
session storage containing contact/address data, OAuth transient cookies, or
Google Customer Reviews order/email transfer. Guest order tracking also lacks
the signed-access mechanism implied by the confirmation UX.

**Required outcome:** an executable storage/cookie/recipient inventory,
six-locale disclosure updates, and a truthful guest confirmation/tracking flow.

### P1 — conversion, accessibility, performance, and maintainability

- Home uses most of the first mobile viewport for a long headline and a complex
  service-area sentence, with no product, workshop, delivery, or people imagery.
  Desktop leaves a large empty right half.
- Listing is one card per row until 640px, has no facets/count/chips, and its
  product photography uses editorial-style cropping rather than product-safe
  containment.
- PDP gallery consumes the first mobile viewport; sticky add is useful, but the
  page lacks human breadcrumbs, specs, delivery estimate, warranty/returns,
  wishlist/compare, accessible selected-image state, zoom/swipe, related
  products, and a clear post-add route to cart.
- Cart can continue to checkout with stock conflicts, add-to-cart can announce
  success even when the 20-line cap silently rejects it, and remove has no undo.
- Registration forces two name columns at 320px and can suppress server field
  errors that the template never renders.
- Header popovers lack Escape/outside-click/focus-return behavior.
- Market suggestion can appear after hydration and shift the whole page.
- `ClientOnly` cart/wishlist/checkout sections have no useful fallback skeleton.
- Footer declares four desktop columns but renders five groups, orphaning
  Delivery on another row.
- Several text and control-boundary token pairs miss WCAG AA, including muted
  text, the dark-theme action colour, and pale control borders.
- Dynamic states such as add, repricing, results, shipping, save, and payment
  status are not consistently announced.
- RTL leaks remain: physical left/right utilities, French colour sorting,
  untranslated country names, non-mirrored back arrows, French offline content,
  and missing bidi isolation for emails/phones/order codes.
- Sanity images are passed through as fixed-width absolute URLs without a
  configured responsive optimization contract, `sizes`, LQIP, or LCP priority.
- Eight declared Inter/Manrope weights can create a large font payload while
  Arabic falls back to an unrelated system face.
- Public content and live stock/pricing share an all-`no-store` API policy;
  immutable/editorial content gets no edge benefit, while commerce data must
  remain fresh.
- Large page files duplicate product cards, order summaries, address fields,
  query parsing, status tones, CAPTCHA/error mapping, and model-family logic.
- Wishlist can scan up to 576 product summaries to resolve saved IDs.
- Guide/comparison amplify catalogue calls and have awkward mobile progression.
- Admin navigation and wide editable tables are not designed for phone use.

### P2 — completeness and operational quality

- Add localized OpenGraph/Twitter defaults and a branded title template.
- Make pagination crawlable and canonical policy explicit; noindex only the
  intended search/filter combinations.
- Stop fabricating today's `lastmod` for unchanged static routes.
- Noindex preview deployments.
- Generate JSON-LD and Merchant shipping from the same source as checkout.
- Add manifest `id`/`scope`/maskable icons and versioned service-worker cleanup.
- Add privacy-reviewed field Web Vitals, JS error, and funnel health telemetry
  with PII scrubbing.
- Move the downloadable brand kit out of runtime public assets and simplify the
  oversized SVG used for a roughly 30px mark.
- Establish controlled dependency-advisory handling; the audit observed three
  high and one low production dependency advisories.

## 5. Target experience

### 5.1 Mobile-first means these concrete things

- Start every component and page at 320 CSS pixels; add behavior at 360, 390,
  768, and 1024 rather than designing desktop first and stacking it later.
- No route or supported state may make the root document horizontally scroll.
  Deliberate inner scrollers such as comparison tables must be labelled,
  keyboard-focusable, and visually signposted.
- Primary controls and navigation rows are at least 44×44px. Inline prose links
  may use the WCAG inline-link exception, but icon controls, remove actions,
  menu items, chips, radios, and checkout actions may not.
- The primary action and current total remain reachable under a thumb in
  product, cart, and checkout flows without covering focused fields or content.
- The on-screen keyboard, landscape orientation, long German labels, Arabic
  bidi content, 200% text, safe-area insets, and browser zoom are first-class
  layouts, not final QA exceptions.
- Loading never collapses a stable layout into a single line of text. Error,
  empty, offline, no-delivery, and sold-out are distinct states.
- No action reports success until the state mutation returns a typed success
  result.

### 5.2 Visual and content direction

- Keep the existing Forest / Golden Wheat / Charcoal / Gold identity, but fix
  contrast and make token use enforceable in scripts, styles, SVG, metadata,
  and manifests.
- Use real product, workshop, preparation, team, store, and delivery imagery.
  Do not invent reviews, certifications, delivery claims, stock, promotions, or
  lifestyle photography.
- Product photography uses `object-contain` and neutral reserved space.
  Editorial cards may use `object-cover`.
- Make the home promise shorter. Move the long geographic delivery explanation
  out of the hero and into a concise trust/delivery section.
- Use one strong primary action per view. Secondary actions must look secondary.
- Keep prices visually dominant, locale-correct, and sourced from the existing
  server response.
- Do not show placeholder ratings. Introduce reviews only when a real,
  policy-compliant source and moderation flow exist.
- Default to the light storefront until dark mode has complete contrast and
  visual coverage. Either ship a tested explicit theme contract or remove the
  current unverified automatic dark switch; do not leave a half-supported mode.

### 5.3 Target mobile shell

At 320–767px:

- first row: compact brand, visible cart, and one accessible menu control;
- second row: full-width search input/action, always reachable;
- language, sign-in/account, wishlist, help, and secondary navigation live in
  the accessible drawer at the narrowest widths;
- the drawer traps focus only while open, closes on Escape/outside
  interaction/navigation, restores focus to its trigger, locks background
  scroll, exposes current-page state, and handles RTL;
- no control depends on a remote icon request.

At 768px and above:

- full wordmark, category navigation, centered search, account, wishlist, cart,
  and locale access are visible without crowding;
- header height and sticky behavior do not produce CLS.

### 5.4 Page-level target specification

| Surface | Required target behavior |
|---|---|
| Home | Concise value proposition; real visual proof; category entry points; in-stock bestsellers; trust/delivery/warranty facts; guide CTA; store proof; latest useful content; resilient partial-error states |
| Header search | Search after two meaningful characters; debounce and cancel stale requests; product/category suggestions; recent local searches; complete results link; keyboard and screen-reader support |
| Listing | Visible context/result count; URL-synced search, category, type, brand, stock, and sort; active removable chips; mobile filter sheet; stable skeletons; retry; helpful no-results; crawlable pagination |
| Product card | Product-safe responsive image; name, colour, price/sale price, stock/new state; accessible wishlist; consistent card used everywhere |
| PDP | Human breadcrumbs; responsive swipe/keyboard gallery; selected state; zoom; name/brand/colour/price/stock; typed add result; quantity stepper; wishlist/compare; delivery estimate; warranty/returns/payment trust; specs; description; related items; sticky mobile action |
| Cart | Compact 320px lines; stock ceiling and correction actions; quantity stepper; server repricing states; remove + undo; promo feedback; edit/continue links; sticky mobile checkout; checkout blocked with explicit corrections when stock conflicts |
| Checkout | Semantic one-page form; guest first; saved-address option when signed in; market default; country/postcode-driven delivery with pending/error/retry; inline validation and summary; order lines and editable cart link; delivery/payment descriptions; total; CAPTCHA states; terms; sticky mobile confirm |
| Confirmation | Payment-state-specific copy; order number and next steps; email expectation; honest guest tracking path; signed-in order link; retry/support path for pending/failed states |
| Login/register | Discoverable entry point; semantic errors; password visibility; forgot/reset path when backend/email is ready; Google path; narrow single-column fields; CAPTCHA recovery |
| Account | Shared account navigation; linked/paginated orders; status timeline; profile and address paths; reorder feedback; empty/error/loading states |
| Wishlist | Reachable from cards/PDP/header; batch-resolve saved IDs; current price/stock; add-to-cart result; empty and retired-product behavior |
| Guide | Progressive questions with focus/scroll management; recommendations before secondary legal content; restart returns focus to the first question |
| Compare | Sticky selected tray; explicit “Compare N” action; mobile table instruction; labelled focusable scroller; compact first column; logical RTL positioning |
| Blog/FAQ/legal | Consistent reading layout; breadcrumbs; localized metadata; related commerce links where honest; touch-friendly contents navigation; print/offline handling |
| Contact | Form schema parity; every field error rendered; CAPTCHA recovery; direct phone/email/WhatsApp/store options; success announcement |
| Admin | Two-level mobile shell; responsive cards or deliberately accessible tables; labelled controls; safe high-impact confirmations; desktop density retained |

## 6. Target frontend architecture

Do not create a generic component library for its own sake. Extract a component
when at least two real consumers need the same behavior or when one complex
interaction needs an isolated test boundary.

Suggested structure:

```text
app/
  components/
    ui/
      AppButton.vue
      AppIconButton.vue
      AppField.vue
      AppSelect.vue
      AppCheckbox.vue
      AppRadioCard.vue
      InlineError.vue
      ErrorSummary.vue
      AppAlert.vue
      AppToast.vue
      AppSkeleton.vue
      EmptyState.vue
      AppPopover.vue
      AppDrawer.vue
      AppBottomSheet.vue
      Breadcrumbs.vue
      StickyActionBar.vue
    commerce/
      ProductCard.vue
      ProductPrice.vue
      StockBadge.vue
      QuantityStepper.vue
      ProductGallery.vue
      ColourPicker.vue
      TrustRow.vue
      OrderLines.vue
      OrderSummary.vue
      AddressForm.vue
      ShippingOptions.vue
      PaymentOptions.vue
    account/
      AccountNav.vue
      OrderCard.vue
      OrderStatusBadge.vue
    shell/
      SiteHeader.vue
      SiteSearch.vue
      MobileNavDrawer.vue
      SiteFooter.vue
  composables/
    useApiFormErrors.ts
    useAsyncState.ts
    usePersistedState.ts
    useUrlQueryValue.ts
    useModelFamilies.ts
    useAnnouncer.ts
shared/
  contracts/
    catalog.ts
    cart.ts
    checkout.ts
    account.ts
```

Architecture rules:

- Public client/server DTOs live in `shared/contracts`, not under `server`.
- Page files orchestrate data and sections; domain logic and reusable
  interaction state do not remain embedded in 400–600-line page components.
- ProductCard, OrderSummary, AddressForm, status-tone mapping, URL-value parsing,
  and API-error mapping each have one implementation.
- All form errors use a shared normalized structure with field association,
  top summary, first-invalid focus, and an unknown-error fallback.
- Persisted cart/wishlist state handles corrupt values, storage limits, and
  cross-tab `storage` events.
- Model-family grouping and representative/variant rules have one shared
  implementation and tests.
- Public editorial content may use explicit SWR caching. Live price, stock,
  cart, account, checkout, and payment responses remain private/fresh.
- Use Nuxt image with an explicit Sanity remote-domain contract, responsive
  `sizes`/formats, LQIP, dimensions, and priority only for the actual LCP image.
- Fonts and icons are local build inputs. A successful build may not depend on
  Google Fonts metadata or Iconify network availability.

## 7. Execution roadmap

Each work package is independently shippable and must include its own locale,
unit/component, browser, visual, accessibility, and documentation changes.
Do not postpone basic accessibility or mobile behavior to the final sweep.

### WP0 — restore truth and a reproducible frontend gate

**Goal:** make the repository capable of proving what frontend it is running.

Tasks:

1. Reconcile `docs/archive/rebuild/REBUILD_EXECUTION.md` with the current tree. Mark absent
   behavior absent; preserve history in the change log rather than false ticks.
2. Add a cross-platform `build:production` wrapper that always builds SSR with
   a node-server preset locally. Keep the Vercel deploy build separate if
   necessary.
3. Add deterministic development/audit bootstrap commands for PostgreSQL,
   migrations, known inventory, a production-shaped catalog snapshot, and safe
   test CAPTCHA/payment configuration.
4. Add a live-data contract probe that validates the parser against Sanity when
   credentials/network are available, while deterministic CI uses a reviewed
   snapshot.
5. Replace remote font discovery with local, subsetted font inputs. Load only
   weights used by the UI and define a tested Arabic-capable family/stack.
6. Bundle every used icon locally. Add a gate asserting no request to
   `api.iconify.design` occurs.
7. Resolve the BigInt/es2019 build warning and fail CI on newly introduced build
   warnings.
8. Convert standalone browser utilities into real Playwright specs or invoke
   them explicitly under a distinct script. Fail CI when discovered spec count
   is zero.
9. Fix `ux-walk.mjs` to select a known in-stock fixture, detect disabled actions,
   tap the actual mobile sticky CTA, scroll the submit control into view, and
   screenshot each relevant state rather than the footer.
10. Add built-artifact sentinels for design tokens, button styles, local fonts,
    local icons, SSR HTML metadata, and app revision.
11. Add one cross-platform `verify:frontend` orchestrator that owns audit
    database/catalog bootstrap, server start, readiness wait, required
    `TEST_BASE_URL`/money-test inputs, browser gates, and reliable teardown.
    Individual scripts remain runnable for diagnosis, but the release path must
    not depend on an operator remembering hidden environment setup.
12. Rewire CI to build and start the exact commit artifact with seeded data,
    pass its URL to browser/Lighthouse tools, retain failure evidence, and stop
    testing an unrelated already-deployed production revision. Make every
    stabilized gate blocking in the package that introduces it.
13. Add deterministic machine-route checks for `/feeds/catalog.csv` and every
    localized Merchant feed: status/content type, schema/header, minimum fixture
    row count, locale/currency, and price/stock consistency. Run a separately
    reported live-catalog probe when credentials/network exist; an intended
    disabled feed must return an explicit documented state, not an unexplained
    500/503.

Recommended review slices (complete in order and do not start WP1 until all
three pass):

- **WP0A — truth and production build:** tracker reconciliation, explicit SSR
  build, warning policy, and artifact sentinels.
- **WP0B — deterministic reality:** database/catalog bootstrap, live contract
  probe, local fonts/icons, and cross-platform orchestration.
- **WP0C — trustworthy gates:** non-zero Playwright suites, simulator isolation,
  corrected visual walker, seeded money path, and CI wiring.

Acceptance:

- One documented command boots a seeded production-shaped SSR app on Windows
  and Linux.
- The cold build works without external font/icon metadata.
- `@font-face` for the expected current-locale faces and the design-token
  sentinel exist in the built artifact.
- Playwright lists at least one test in every configured project.
- A deliberately broken sentinel or zero-test suite makes the gate fail.
- Browser smoke sees real product data and at least one in-stock product.
- No console error, hydration mismatch, raw key, remote Iconify request, or
  unexpected 4xx/5xx occurs in the seeded smoke path.
- `npm run verify:frontend` can start from no audit services running, exercise
  the full gate, and leave no server/database process behind on success or
  failure.
- Seeded catalogue CSV and all enabled localized Merchant endpoints return 200
  and pass content/row/price/stock contracts; the live probe result is visible
  and cannot be confused with deterministic fixture success.

### WP1 — tokens, primitives, loading states, and the global shell

**Goal:** create the minimum reusable system and fix every-route mobile defects.

Tasks:

1. Measure and correct every semantic foreground/background/border token pair
   to WCAG 2.2 AA in each supported theme.
2. Align browser theme colour, manifest colour, CSS token, and brand assets.
3. Decide and implement the explicit light/dark contract; remove duplicated
   token blocks.
4. Build the UI primitives required by the next packages, including controlled
   button states, fields/errors, alerts/toasts, skeletons, popover, drawer,
   bottom sheet, breadcrumb, and sticky action bar.
5. Rebuild the mobile header from 320px upward according to section 5.3.
6. Add accessible search chrome; suggestion behavior can land in WP4.
7. Add discoverable account, wishlist, and cart paths without crowding 320px.
8. Rebuild the footer grid, enlarge interactive navigation targets, and avoid
   repeating the full delivery paragraph in high-friction contexts.
9. Add `NuxtLoadingIndicator` and useful `ClientOnly` fallbacks.
10. Make market suggestion layout-stable and its close target at least 44px.
11. Make menu/popover focus, Escape, outside-click, scroll-lock, route-change,
    and RTL behavior reusable and tested.
12. Make the skip target programmatically focusable.
13. Repair `check:hex` so its declared policy covers relevant Vue
    template/script/style blocks, CSS, and configuration sources rather than
    skipping whole blocks. Keep an explicit, reviewed allowlist for metadata or
    third-party values that cannot use runtime tokens.

Acceptance:

- Root `scrollWidth <= clientWidth` at 320px for every public/auth/account route
  in FR, DE, and AR, including menus open.
- Header works at 320, 360, 390, 667×375, 768, and 1024 without clipped labels.
- Keyboard and screen reader can open, traverse, close, and return from every
  global popup/drawer.
- Primary/icon/menu controls meet the 44px project target.
- No layout shift is caused by market suggestion, async header state, fonts, or
  skeleton replacement.

### WP2 — cart and checkout correctness

**Goal:** remove the highest-consequence mobile friction without changing
server-authoritative money rules.

Cart tasks:

1. Make local cart mutations return only outcomes they can know, such as
   `added`, `capped`, `cart_full`, and `invalid_quantity`. Return
   `out_of_stock` only from a fresh server stock response; otherwise return a
   `needs_revalidation` state and verify stock before checkout.
2. Render a single feedback system for PDP/card/wishlist/cart mutations; never
   say “Added” after a no-op.
3. Build a reusable quantity stepper with stock ceiling, keyboard editing, and
   a non-destructive blank-input state.
4. Reflow cart lines at 320px and test long German product names and large
   locale-formatted totals.
5. Block checkout when any line exceeds stock or is unavailable. Explain and
   offer set-to-available/remove actions.
6. Add remove with a real timed Undo action.
7. Keep server repricing visible and announce total changes.
8. Make promo pending/applied/rejected/network states distinct and announced.
9. Add a mobile sticky checkout action that respects safe areas and does not
   cover the final content.

Checkout tasks:

1. Convert checkout to a real `form` with `submit` semantics and shared
   client/server validation contracts.
2. Derive initial country from the current market/locale or selected saved
   address, not a hard-coded France value.
3. Localize country labels and preserve Dutch alphanumeric postcode input.
4. Split address/contact fields into a reusable `AddressForm` and use saved
   customer addresses when authenticated.
5. Normalize server validation issues; render every issue next to its field,
   connect it with `aria-describedby`/`aria-invalid`, show a form summary, and
   focus the first error.
6. Debounce and cancel delivery lookup. Ignore stale responses and expose
   loading, no-delivery, error, and retry states.
7. Auto-select a single delivery option; preserve a still-valid previous choice;
   render description, price, and estimated days.
8. Render product lines, quantities, stock state, subtotal, discount, delivery,
   total, and an edit-cart link in the review panel.
9. Render payment methods only when valid for the chosen destination/delivery;
   keep their honest descriptions.
10. Give CAPTCHA explicit loading, ready, expired, failed, unavailable, and
    retry states. Never leave a disabled button with no explanation.
11. Show the exact unmet prerequisites beside the disabled confirm action.
12. Add a sticky mobile action showing the current total and confirmation label.
    It must yield to the keyboard and Stripe iframe.
13. Preserve idempotency, payment adapter behavior, server pricing, stock
    reservation, and existing session restore semantics.

Recommended review slices (complete in order and keep one shared contract):

- **WP2A — cart integrity:** typed local/server outcomes, quantity behavior,
  stock gate, repricing, promo feedback, undo, and narrow reflow.
- **WP2B — semantic checkout:** shared address/form schema, market defaults,
  saved-address selection, complete review, and accessible validation.
- **WP2C — asynchronous/payment states:** shipping race control, CAPTCHA,
  payment states, sticky mobile confirmation, and money-path regression.

Acceptance:

- Enter submits when valid and focuses the first error when invalid.
- Browser-invalid and server-invalid email/postcode/address cases cannot reach
  order creation without visible field guidance.
- FR, NL, DE, ES, and AR start with the correct market country behavior.
- Rapid postcode A→B changes can never show A's options after B.
- CAPTCHA blocked/failed/expired always has a visible recovery path.
- Stock-conflicted carts cannot enter a dead-end checkout.
- Guest, signed-in, pickup, own-fleet, single-option, multi-option, no-delivery,
  cash, in-store, Stripe failure/retry, and processing states have tests.
- The existing money-path test still asserts totals, inventory movement,
  cancellation reversal, idempotency, and second-identity denial in PostgreSQL.

### WP3 — PDP, product cards, wishlist, and add-to-cart

**Goal:** make product evaluation and purchase confident on a phone.

Tasks:

1. Create the single ProductCard/ProductPrice/StockBadge implementation and use
   it on home, listing, wishlist, guide/related products, and blog relations.
2. Configure responsive Sanity images. Use `object-contain`, dimensions,
   responsive `sizes`, modern formats, LQIP, and priority only for the actual
   first PDP image.
3. Build an accessible gallery with touch swipe, keyboard controls, selected
   state, image count/dots, thumbnails when useful, and a zoom view.
4. Add breadcrumbs and keep them compact on mobile.
5. Keep name, brand, colour, server price, sale comparison, and stock explicit.
6. Reuse the quantity stepper and typed cart mutation results.
7. Retain the mobile sticky add action; test long translations, safe area, zoom,
   keyboard, sold-out, and post-add states.
8. Expose current/sibling colours as a labelled selection with unavailable
   states and programmatic current state.
9. Integrate wishlist on PDP and cards. Announce saved/removed and sync tabs.
10. Add compare entry only where the comparison flow can consume the product.
11. Render specifications, highlights, delivery estimate, warranty, returns,
    assembly/service facts, and payment reassurance from real existing data.
12. Add related products/model alternatives without duplicating colour variants
    as separate recommendations.
13. Resolve the P0.8 owner/evidence decision gate, then implement the selected
    colour/family canonical policy here across hreflang, sitemap, JSON-LD,
    feeds, internal links, and visible content. Under the recommended
    self-canonical-colour strategy, model siblings through ProductGroup/variant
    data.
14. Land the responsive image and product-identity contract tests with this
    package; WP7 measures the cross-route budget and does not defer their
    correctness.

Acceptance:

- A user can identify product, colour, price, availability, delivery expectation,
  and primary action without ambiguity at 320/390px.
- Product edges and accessory legends are not cropped.
- Gallery works with touch, keyboard, VoiceOver/TalkBack semantics, and RTL.
- Saving and adding have truthful typed outcomes and live announcements.
- Every submitted product URL is self-canonical and schema/feed tests agree on
  URL, price, availability, currency, group, shipping, and returns.
- No fake rating, delivery promise, or warranty copy is introduced.

### WP4 — discovery: search, listing, and home

**Goal:** help a visitor find a suitable product quickly instead of forcing
serial scrolling.

Search tasks:

1. Use the existing validated catalog search or add a small public suggestion
   contract; do not query Sanity directly from the browser.
2. Start after two meaningful characters, debounce, cancel stale requests, and
   cap results.
3. Return products plus categories, show recent searches locally, and provide a
   “view all results” route.
4. Implement combobox/listbox semantics, full keyboard control, result count,
   loading/error/no-result states, Escape/focus return, and RTL.

Listing tasks:

1. Expose product type, category, brand, in-stock, price/sort controls supported
   by honest API contracts.
2. Add result count, current category/query context, removable active chips, and
   clear-all.
3. Use an accessible mobile bottom sheet with a sticky “Show N products” action;
   desktop gets a compact filter rail.
4. Keep URL state shareable and Back/Forward-correct. Define which filter/search
   combinations are noindex and which pagination pages self-canonicalize.
5. Use anchor pagination and stable skeletons. Retain current results while a
   new request loads where safe.
6. Distinguish no results from API failure and provide category/query
   suggestions and retry.
7. Increase useful phone density: one column at the narrowest size and a tested
   two-column layout when cards remain at least approximately 160px wide.
8. Land pagination/query canonical, robots, hreflang, and crawlable-link
   contract tests in this package; WP7 expands the global URL matrix rather than
   postponing listing correctness.

Home tasks:

1. Shorten the hero value proposition and delivery copy.
2. Add a real, optimized visual asset without delaying the LCP text/action.
3. Put category entry points and in-stock bestsellers early.
4. Follow with specific trust facts, guide/compare help, shop/preparation proof,
   and useful recent content.
5. Render independent loading/error/retry behavior so one failed source does not
   blank unrelated sections.
6. Avoid decorative sections that neither answer a buying question nor lead to
   a supported action.

Acceptance:

- Search is reachable in one action from every public route at 320px.
- Query results never show stale suggestions after a newer query.
- Category links visibly activate the corresponding listing filter.
- Listing supports URL share/back/forward and announces updated count.
- No results and service failure have visibly different recovery paths.
- Home's first 390×844 viewport contains a clear promise, primary action, and
  visual/product proof without an unreadable geography paragraph.

### WP5 — confirmation, authentication, account, and guest continuity

**Goal:** make every customer able to understand and revisit an order.

Tasks:

1. Design confirmation per payment state: cash/in-store confirmed, Stripe paid,
   processing, failed, unknown, and missing order reference.
2. For signed-in customers, link directly to the owned order detail.
3. For guests, do not link to an account that cannot access the order. Build a
   signed, expiring, ownership-safe order link/email contract before advertising
   guest tracking. This is a scoped backend dependency and needs security tests.
4. State email/support expectations and what happens next; never claim an email
   was sent if the email provider is not configured.
5. Put sign-in/account access in the shell and preserve locale/return path.
6. Stack registration fields at narrow widths and render all field errors.
7. Add password visibility and a complete reset flow only when Resend/domain
   delivery is configured; otherwise do not ship a dead control.
8. Add shared AccountNav and link orders, profile, addresses, and logout.
9. Make order cards link their details, paginate them, and preserve locale.
10. Complete account address CRUD/default feedback and verify that WP2's shared
    address contract remains usable in checkout; do not reimplement checkout
    address selection here.
11. Add cross-tab cart/wishlist/account-state consistency where applicable.

Acceptance:

- Guest and signed-in confirmation CTAs are both truthful.
- A second identity cannot use any guest/signed link or account route to read
  another order.
- Every account capability has an incoming navigation path.
- Authentication errors are visible, associated, localized, and recoverable.
- Email-dependent UI is feature-gated by real readiness, not merely by code
  existence.

### WP6 — guide, comparison, content, legal, offline, and admin

**Goal:** complete the secondary journeys after the purchase funnel is safe.

Guide and comparison:

- Move recommendations ahead of secondary legal/help content.
- Restore focus and scroll position intentionally between questions and on
  restart.
- Replace catalogue-wide repeated scans with compact selector/spec contracts.
- Add a sticky selected tray and explicit compare action.
- Label/focus/instruct the horizontal table scroller and reduce its fixed first
  column at 320px.
- Test RTL logical stickiness and long specs.

Content/legal/offline:

- Apply shared reading, breadcrumbs, metadata, error, and related-link patterns.
- Make long contents lists touch-friendly without turning inline prose links
  into giant blocks.
- Replace physical direction utilities and isolate LTR business identifiers in
  RTL.
- Localize country labels and `offline.html` for all supported locales or route
  offline fallback through a localized shell.
- Correct privacy disclosures through the storage/recipient inventory in WP7.

Admin:

- Build a two-row or drawer-based mobile admin shell.
- Use responsive task cards below the table breakpoint, or make wide editor
  tables deliberately labelled and keyboard-operable.
- Give every input/action a specific accessible name, pending/success/error
  feedback, and minimum target size.
- Confirm high-impact state changes with action-specific copy.
- Keep the desktop ability to process an order quickly; measure, do not assume.

Acceptance:

- Guide and comparison complete without focus loss or excessive reverse scroll.
- Comparison works at 320px, RTL, keyboard-only, and screen-reader navigation.
- Offline/error/legal pages retain locale and are usable at 320px.
- Daily admin tasks remain at most three actions and an order can be processed
  in under 60 seconds on the supported desktop workflow.

### WP7 — performance, SEO, privacy, PWA, and observability

**Goal:** make the improved UI fast, index-consistent, deployable, and honest.

Performance:

1. Audit and enforce WP3's responsive image contract across every remaining
   route; do not reimplement ProductCard/PDP media here.
2. Commit a reproducible performance profile that pins the Lighthouse/Chrome
   version, viewport/DPR, network latency/throughput, CPU slowdown, cold cache,
   disabled/bypassed service worker, seeded route state, fixture product/image,
   three-run aggregation method, and artifact retention.
3. Measure route-level initial JS, CSS, locale fonts, LCP image, total transfer,
   request count, TTFB, and TBT rather than one aggregate server/public
   directory. Define initial JS as transferred JavaScript requested from
   navigation start through load plus one second of network idle, before user
   interaction.
4. Lazy-load Stripe, large comparison/guide data, and noncritical widgets.
5. Split public editorial caching from live commerce caching.
6. Version and cap service-worker caches; remove obsolete hashed chunks.
7. Move non-runtime brand kit files outside deployed `public`.

SEO:

1. Run the global consistency audit for the product identity strategy already
   implemented and gated in WP3; do not introduce a second canonical policy.
2. Add localized branded title templates, OpenGraph, Twitter, URL/image alt and
   dimensions.
3. Audit the pagination/filter/search policy implemented in WP4 across all route
   classes without postponing WP4's own contract tests.
4. Verify a committed URL-state matrix, not only sitemap entries: static routes,
   pagination, normalized query/filter/search states, product variants, every
   locale, and `x-default`, with status, canonical, robots, hreflang, sitemap,
   internal-link, schema, and feed expectations.
5. Use real modification dates or omit unknown static `lastmod`.
6. Emit `X-Robots-Tag: noindex, nofollow` and/or equivalent HTML meta on every
   non-production HTML response; test the inverse so production can never leak
   preview `noindex`. `robots.txt Disallow` alone is not sufficient.
7. Generate JSON-LD/feed/visible shipping and returns from the same source.
8. Retain SSR content in the built HTML and add metadata/schema contracts.

Privacy/PWA/observability:

1. Generate one machine-readable manifest of every localStorage,
   sessionStorage, Cache Storage, cookie, external request/recipient, field,
   purpose, retention, and legal basis. Use it to drive/check every locale's
   policy in CI.
2. Cover checkout draft data, wishlist, cart, market dismissal, OAuth, CAPTCHA,
   Stripe, and Google Customer Reviews explicitly.
3. Minimize checkout personal data, set explicit TTL/clear-on-success/logout
   behavior, and test corrupted/expired storage. A disclosure update alone does
   not close the finding.
4. Add a browser inventory test that observes cookies, Web Storage, Cache
   Storage, and network recipients created by first- and third-party scripts or
   iframes. Static source scanning is only one input.
5. Feature-gate Google Customer Reviews and any telemetry until the owner/legal
   recipient, consent/legal-basis, retention, and market decision is recorded.
6. Add manifest identity/scope and maskable icons.
7. Add privacy-reviewed Web Vitals, JS error, and funnel event collection with
   locale/device segmentation, sampling, PII redaction, and a documented
   retention policy. Do not silently add third-party analytics.
8. Validate all required production configuration before deployment and fail
   closed with actionable operator output.

Recommended review slices:

- **WP7A — measurable delivery:** committed lab profile, route budgets, asset
  enforcement, lazy loading, and cache taxonomy.
- **WP7B — index contract:** URL-state matrix, social/SSR metadata, schema,
  machine outputs, preview protection, and production inverse checks.
- **WP7C — privacy and resilience:** generated/browser storage-recipient
  inventory, minimization/TTL, legal feature gates, PWA lifecycle, production
  preflight, and owner-approved observability.

Acceptance:

- Mobile LCP/CLS/INP budgets in section 9 pass on home, listing, PDP, cart, and
  checkout under the defined network/CPU profile.
- No sitemap URL canonicalizes elsewhere unless the sitemap excludes it.
- Rich-result contracts agree with visible price, stock, shipping, and returns.
- Preview environments are not indexable.
- Storage/cookie/recipient inventory and all locale policies agree.
- Offline shell and PWA upgrade do not serve stale checkout/account/API data.

### WP8 — hardening and release

**Goal:** prove the complete frontend in production-shaped reality.

Tasks:

1. Run the full viewport, locale, state, browser, theme, network, and assistive
   technology matrix in section 8.
2. Run the critical purchase path against seeded PostgreSQL and real
   production-shaped catalog data; assert stock and order state in the database.
3. Walk cancellation/reversal, payment retry, duplicate webhook/event, second
   identity, storage corruption, offline/reconnect, expired CAPTCHA, stale
   shipping request, and catalog outage.
4. Review every critical screenshot with human eyes, not only pixel assertions.
5. Run native review for NL/DE/ES and a dedicated Arabic RTL/bidi pass.
6. Confirm that Lighthouse/axe/reflow/visual/bundle/schema gates introduced by
   earlier packages are blocking; WP8 must not be the first time a WP3/WP4
   correctness gate can fail CI.
7. Deploy a preview of the exact commit, smoke it, then release with a documented
   rollback and a minimum 7-day error/funnel bake. Review field CWV after at
   least 28 days or the minimum sample in section 9, whichever is later.

Acceptance:

- All Definition of Done items in section 10 are supported by recorded command
  output, screenshots, and datastore assertions.
- No release blocker is waived by changing a threshold without a written reason.
- The execution tracker links to the evidence for each completed package.

## 8. Required verification matrix

The matrix is a release contract, not a request to multiply screenshots without
purpose. Automate deterministic assertions, keep representative visual
baselines, and perform manual assistive-technology and visual reviews where
automation cannot establish usability.

### 8.1 Viewports and reflow

| Viewport or mode | What it must prove |
|---|---|
| 320×568 and 320×640 | WCAG reflow; header, cart, CAPTCHA, forms, sticky actions, and long labels under maximum pressure |
| 360×800 | Common narrow Android flow |
| 375×667 | Small iPhone flow and reduced vertical space |
| 390×844 | Preserve and improve the current mobile baseline |
| 412×915 and 430×932 | Large Android/iPhone behavior |
| 667×375 | Landscape, software-keyboard pressure, sticky header/action collision |
| 768×1024 | Exact `md` transition and tablet navigation/grid |
| 1024×768 | Exact `lg` transition, PDP, checkout, and account layout |
| 1366×768 and 1440×900 | Desktop balance, scan paths, and content density |
| 200% text zoom | Text expansion without clipping or loss of operation |
| 400% zoom / 320 CSS px | WCAG 1.4.10 reflow without two-dimensional page scrolling |

For every automated narrow-viewport route/state, assert the page root has
`scrollWidth <= clientWidth`. Deliberate internal scrollers such as the
comparison table need an accessible name, keyboard focus, visible affordance,
and separate bounds assertions.

### 8.2 Locale coverage

- **FR:** complete funnel, content, account, and admin baseline.
- **DE:** longest labels, product names, validation messages, and totals.
- **NL:** alphanumeric postcode, Dutch address and delivery/payment behavior.
- **ES:** Spanish market plus supported and unsupported delivery destinations.
- **AR:** complete RTL funnel; bidi isolation; menu, drawer, gallery, forms,
  cart, checkout, confirmation, account, and offline/error pages.
- **EN:** fallback-market behavior and offline/error smoke.
- **All six:** route status, raw-key, `lang`/`dir`, canonical/hreflang, console,
  hydration, and navigation discovery smoke.

Native review is required for NL, DE, ES, and AR before release. Passing key
parity is necessary but does not establish language quality.

### 8.3 State coverage

At minimum cover:

- initial, loading, stale/retained, empty, no-result, dependency error, retry,
  offline, and reconnect;
- missing image, one/many images, long title, many colourways, sold out, low
  stock, changed price, and deleted product;
- empty cart, one line, 20 lines, corrupt persisted data, another-tab update,
  quantity ceiling, stock conflict, and promo pending/applied/rejected/error;
- no/single/multiple delivery methods, slow response, failed response, stale
  out-of-order response, and destination/market change;
- CAPTCHA loading, blocked script, error, retry, expired token, and success;
- Stripe loading, setup failure, payment failure, retry, processing, paid,
  cancellation/reversal, and duplicate event;
- guest, signed-in customer, expired session, unauthorized account route, and
  admin roles;
- light, explicit dark if retained, system dark, forced colours, reduced
  motion, slow 4G, CPU throttling, and disabled JavaScript where SEO requires
  server content.

### 8.4 Browsers and assistive technology

- Current Chromium with Android emulation, current WebKit at iOS sizes, and
  current Firefox desktop.
- VoiceOver with Safari, TalkBack with Chrome, and NVDA with Chrome or Firefox.
- Keyboard-only header, search, filters, gallery, cart, checkout, comparison,
  account, and admin flows.
- Touch review on at least one real narrow phone for safe-area and software
  keyboard behavior.

## 9. Quality budgets and blocking gates

Baselines must be measured on the exact seeded production build. Numeric
performance limits below are provisional guardrails, not claims about an
unmeasured baseline. WP7A may recalibrate them once, with the before/after
measurements, business rationale, and owner approval recorded in the committed
profile; after that they may be tightened but not silently relaxed to make a
build green.

### 9.1 Functional and rendering gates

- Zero unexpected console errors, uncaught exceptions, hydration mismatches,
  raw translation keys, and unexpected 4xx/5xx responses in critical journeys.
- Zero global horizontal overflow at 320 CSS pixels.
- All required Playwright projects discover more than zero tests.
- The purchase test uses a known in-stock fixture and asserts displayed PDP,
  cart, checkout, and persisted order totals against server/database values.
- Catalog or content dependency failure renders an explicit retryable error and
  correct HTTP semantics, never a false empty result or false 404.
- A full multi-locale simulator run uses isolated browser state per locale and
  a fresh state for the French purchase path. The current simulator's reported
  missing listing link after its six-locale sweep conflicts with a passing
  fresh-context walk and must be fixed as a test-harness defect before it is a
  release gate.

### 9.2 Accessibility gates

- Text contrast is at least 4.5:1, large text at least 3:1, and required
  non-text UI boundaries/states at least 3:1 in every supported theme.
- Interactive controls and navigation rows meet the 44×44 CSS-pixel project
  target, with documented exceptions only for inline text links.
- Automated axe runs have zero serious or critical violations on the route/state
  baseline. Automated success never replaces the manual screen-reader pass.
- Every field error is visible, programmatically associated, and announced;
  invalid submit focuses the summary or first invalid control.
- Focus is visible and ordered, modal focus is contained and restored, and no
  sticky element obscures focused content at zoom or with a software keyboard.

### 9.3 Performance budgets

- Commit the exact performance profile as code. Initial profile: 390×844 CSS
  pixels at DPR 3, 1.6Mbps downstream, 750Kbps upstream, 150ms RTT, 4× CPU
  slowdown, cold browser HTTP caches, service worker bypassed, a named seeded
  in-stock fixture, and deterministic cart/checkout state. Pin Chrome and
  Lighthouse versions, run three independent cold samples, gate the median, and
  retain every raw report. The committed profile supersedes this prose if it
  changes through the one documented WP7A calibration.
- Mobile Lighthouse, after a stable three-run baseline, targets Performance
  ≥90 and Accessibility, Best Practices, and SEO ≥95 on home, listing, PDP,
  cart, and checkout.
- Lab targets also include TTFB ≤800ms, TBT ≤200ms, total route transfer
  ≤1.5MB, and ≤60 requests for the defined fixture/profile.
- Field p75 SLOs by route/locale/device segment are LCP <2.5s, CLS <0.1, and
  INP <200ms. They are reported, not used as a release gate, until collection
  is legally approved and a cohort has at least 28 days and 200 eligible
  navigations. “Insufficient data” is neutral and must never be shown as a pass.
- Initial route JavaScript target: ≤200KB gzip; route CSS target: ≤40KB gzip.
- Current-locale font target: ≤180KB transferred; do not load unused locale
  subsets or weights.
- Mobile LCP image target: ≤200KB for the named 390px/DPR-3 fixture, with
  intrinsic dimensions and no avoidable layout shift.
- Record route transfer and chunk budgets instead of using the existing broad
  aggregate `public`/server directory allowance.
- No runtime request to remote Iconify or font-metadata services. Product media
  must demonstrate responsive optimized URLs, `srcset`/`sizes`, modern formats,
  and correct priority.

### 9.4 SEO, privacy, and resilience gates

- Every indexable sitemap URL returns success and follows the approved canonical
  policy, is indexable, present in one valid reciprocal hreflang cluster, and
  consistent with schema and feeds. The wider URL-state matrix additionally
  covers indexable/non-indexable pagination, query/filter/search, variants,
  locales, and `x-default` even when those URLs do not belong in the sitemap.
- OpenGraph/Twitter metadata and JSON-LD contract tests run on SSR HTML without
  client hydration.
- Preview HTML emits a tested `X-Robots-Tag` and/or meta `noindex, nofollow` and
  is absent from production sitemaps/feeds; an inverse test proves production
  HTML is not accidentally noindexed.
- Seeded catalogue CSV and every enabled localized Merchant feed return 200 and
  pass schema/header/row/locale/currency/price/stock contracts. Live probes are
  separately labelled and an intentionally disabled feed fails explicitly.
- The generated manifest and browser-observed storage/cookie/cache/network
  recipient inventory match each other and every locale policy; checkout PII
  TTL/clearing and third-party feature gates are tested.
- Public editorial caches and live commerce/private caches have explicit,
  tested policies; no account, checkout, payment, or API response leaks through
  the offline cache.
- Dependency advisories are triaged with owner, impact, and deadline. The audit
  baseline is three high and one low production vulnerability; do not apply a
  blind force-fix.

## 10. Definition of Done

A route, component, or work package is done only when all applicable statements
below are true and linked to evidence.

### 10.1 Behavior and commerce correctness

- The happy path and every relevant empty, loading, failure, retry, permission,
  stale-response, and recovery state are implemented.
- Customer-facing price, stock, delivery, promotion, and total values are
  sourced from the server-authoritative contract; client calculations are
  display estimates only and are never submitted as truth.
- Money-path tests assert database/order outcomes, idempotency, and duplicate or
  reordered payment events, not only page text.
- No success message is emitted after a no-op or failed mutation.
- The feature is reachable from the expected navigation/context and has a clear
  way back or onward; no important route depends on knowing its URL.

### 10.2 Mobile, responsive, and interaction quality

- The component starts from 320px rules and passes all applicable viewport,
  zoom, long-content, landscape, safe-area, and software-keyboard cases.
- There is no page-level horizontal overflow, clipped action, obscured focus,
  accidental two-dimensional scrolling, or sticky element covering content.
- Touch targets, spacing, reading order, loading stability, and tap feedback are
  verified on mobile, not inferred from desktop CSS.
- Desktop adds useful density or context without changing domain behavior.

### 10.3 Accessibility

- Semantic elements, accessible names, relationships, states, validation,
  announcements, focus movement, keyboard operation, contrast, target size,
  reduced motion, and forced-colour behavior are verified as applicable.
- Automated axe/contrast checks pass and the critical interaction is manually
  exercised with keyboard and at least one required screen reader.
- RTL changes direction and reading behavior without reversing identifiers,
  prices, email addresses, order numbers, or tracking codes.

### 10.4 Internationalization and content

- All six locales have parity, no raw or hard-coded user-facing copy, localized
  country/address/date/price behavior, and locale-preserving links.
- DE long-copy and AR RTL/bidi fixtures pass. Native review is recorded where
  language meaning changed.
- Error, loading, empty, offline, metadata, structured-data, and assistive copy
  receive the same localization treatment as the happy path.

### 10.5 Performance, SEO, privacy, and security

- The route stays within section 9 budgets and does not add a remote icon/font
  dependency, unoptimized catalogue image, unnecessary eager chunk, or layout
  shift.
- SSR title, description, canonical, hreflang, social metadata, index policy,
  and relevant schema/feed contracts are correct for every URL state.
- New storage, cookies, external calls, analytics events, or personal fields are
  inventoried, minimized, redacted where appropriate, and reflected in policy
  and tests before release.
- Authentication, CAPTCHA, payment, and role states fail visibly and safely;
  frontend convenience never weakens server authorization or validation.

### 10.6 Tests, evidence, and documentation

- Unit/contract/component tests cover domain decisions; browser tests cover the
  user journey; visual baselines cover meaningful layout states rather than
  every minor permutation.
- A cold production-shaped SSR build with seeded catalog/inventory passes.
- Relevant screenshots are inspected by a human and named by route, viewport,
  locale, and state.
- The test has been seen failing for the behavior it protects when practical.
- Documentation describes the tree that exists. Tracker ticks link to command
  output, screenshot, test, or datastore evidence; prose is not evidence.
- No unrelated user changes are overwritten and the work package remains a
  reviewable commit/PR-sized unit.

The expected end-of-package command set is below. WP0 may rename or add scripts,
but it must preserve an equivalent single documented gate:

```powershell
npm.cmd run check:langs
npm.cmd run check:hex
npm.cmd run check:invariants
npm.cmd run check:docs
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run verify:frontend
```

`verify:frontend` owns `build:production`, seeded service boot/readiness,
`TEST_BASE_URL`, E2E, visual, simulator, visual walk, money-test URL/database
arguments, and teardown. Its final gate must also include explicit
bundle/image/font, accessibility, reflow, SSR metadata/schema, sitemap/feed,
privacy-inventory, and zero-test-count checks created by the relevant work
packages. Individual commands remain available for diagnosis, but are not the
operator contract.

## 11. Owner decisions and external dependencies

Claude Code must not invent evidence or silently choose business/legal policy.
Record these items in the tracker, feature-gate incomplete capabilities, and
continue with independent work where possible.

| Decision/dependency | Owner input required | Safe interim rule |
|---|---|---|
| Product/editorial photography and crop rules | Approved assets and rights | Preserve current assets, use `contain` for catalogue media, and do not generate fake product proof |
| Product colour/family URL strategy | Acquisition intent plus available Search Console/index evidence | Keep current URLs but do not expand the inconsistent mixed canonical state; implement one approved policy in WP3 |
| Theme contract | Whether dark mode is user-visible, system-only, or removed | Test the currently shipped behavior; do not advertise a control that does not exist |
| Native NL/DE/ES/AR copy review | Approved translations and market terminology | Keep key parity and flag unreviewed copy explicitly |
| Password reset and transactional email | Resend/provider setup, sender identity, templates, retention | Do not expose a reset CTA or claim email delivery until the complete path works |
| Guest order access | Signed-link lifetime, authorization model, email path | Confirmation remains truthful and does not link guests to inaccessible account orders |
| Reviews/social proof | Verified provider/data and moderation rules | No fabricated ratings, testimonials, customer counts, or urgency |
| Analytics/error monitoring | Provider, consent/legal basis, retention, sampling, PII rules | Use local test instrumentation only; add no silent production tracker |
| Performance guardrails | Approve the single evidence-backed WP7A calibration and business-critical exceptions | Use section 9's provisional profile/limits and record results without silent threshold changes |
| Privacy/legal disclosures | Counsel/owner approval in every market | Maintain a generated technical inventory and block release on known mismatch |
| Shipping promises and returns | Authoritative CMS/rules and approved wording | Derive visible UI, schema, and feeds from the same source |
| Stripe/live payments | Live keys, webhook ownership, retry/reversal procedure | Use safe test configuration and keep live release blocked |
| Production catalog/feed access | Stable credentials/network and Merchant requirements | Use a reviewed deterministic fixture in CI plus a separately reported live probe |

## 12. Claude Code hand-off protocol

### 12.1 First execution prompt

Paste this into Claude Code from the repository root:

```text
Read CLAUDE.md in full, then read skills/reality-check/SKILL.md in full, then
read docs/FRONTEND_MOBILE_FIRST_AUDIT_AND_PLAN.md in full.

Execute WP0A only. Do not begin WP0B or WP1. Treat the current code and measured runtime
as truth; docs/archive/rebuild/REBUILD_EXECUTION.md contains stale completion claims. Inspect
the worktree first and preserve unrelated changes. Build the smallest coherent
WP0A patch, update tests and documentation with it, and run every acceptance
check applicable to WP0A against a cold production-shaped SSR build. Do not
mark the full WP0 acceptance complete; deterministic catalogue/bootstrap,
non-zero Playwright, and simulator isolation belong to WP0B/WP0C. Do not weaken
server-authoritative price, stock,
market, payment, idempotency, or authorization rules. Do not fake external
assets, reviews, email, analytics, or live-service success.

Before stopping, update the execution tracker only for criteria supported by
evidence. Report in Arabic: changed files, decisions, commands and exact
results, screenshots/evidence, remaining blockers, and the next untouched work
package. If a check cannot run, state why and leave its criterion incomplete.
```

### 12.2 Subsequent-package prompt

Use one named review slice per Claude Code session/PR where A/B/C slices exist;
otherwise use one work package. Do not advance to the next numbered package
until every slice and the package-level acceptance pass:

```text
Re-read CLAUDE.md, skills/reality-check/SKILL.md, and
docs/FRONTEND_MOBILE_FIRST_AUDIT_AND_PLAN.md. Inspect the current worktree and
the recorded evidence for the previous slice/package. If it does not meet its
applicable acceptance criteria, finish it first. Otherwise execute only the
next named slice (for example WP0B) or next unsliced numbered package. Preserve
unrelated changes and existing commerce
invariants. Add the package's responsive, locale, RTL, state, accessibility,
performance/SEO/privacy, and browser evidence as applicable. Run a cold seeded
production-shaped build and the complete relevant gate. Update tracker claims
only after proof. Report in Arabic with exact results and blockers; do not start
the following package.
```

### 12.3 Review checkpoint after every package

The reviewer should reject the package if any answer below is unsupported:

1. Which measured finding does this change close?
2. What happens at 320px, long German copy, and Arabic RTL?
3. What happens while dependencies load, fail, race, expire, or return empty?
4. Can keyboard and screen-reader users understand and complete the flow?
5. Did price, stock, market, identity, payment, privacy, canonical, schema, or
   feed authority change? If so, where is the contract evidence?
6. Which cold-build commands, browser specs, screenshots, and database/API
   assertions passed?
7. Was the protective gate demonstrated to fail when its invariant broke?
8. What remains deliberately out of scope for the next work package?

Recommended sequence remains strict: WP0A → WP0B → WP0C → WP1 → WP2A → WP2B →
WP2C → WP3 → WP4 → WP5 → WP6 → WP7A → WP7B → WP7C → WP8. Correctness and
reachability precede visual flourish; each slice must leave the storefront
deployable or safely feature-gated.
