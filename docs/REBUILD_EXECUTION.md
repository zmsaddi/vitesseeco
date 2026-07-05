# Rebuild Execution Tracker

> Live checklist for [MASTER_REBUILD_PLAN.md](MASTER_REBUILD_PLAN.md). One unit = one commit/PR,
> shipped with tests + 6-locale keys + checks green. Status: ✅ done · 🔄 in progress · ⬜ queued.
> Updated every working session.

## Phase R0 — Foundation

| Unit | Scope | Status |
|---|---|---|
| U-F1 | Admin panel v1 (dashboard, live orders, stock, messages) | ✅ 2026-07-05 |
| U-F2 | Google Merchant feed `/feeds/google-merchant.xml` | ✅ 2026-07-05 |
| U-F3 | Chat assistant + WhatsApp widget, 6 langs, AI-ready | ✅ 2026-07-05 |
| U-F4 | Register 500 fix (DrizzleQueryError unwrap) | ✅ 2026-07-05 |
| U-D1 | Design System v2 batch 1: AppDialog, ConfirmDialog, BottomSheet, Breadcrumbs, PriceTag, StockBadge | 🔄 |
| U-D2 | DS batch 2: AppSelect, QuantityStepper, Tabs, Accordion, Pagination, InlineError, Banner | ⬜ |
| U-D3 | DS batch 3: ProductCard v2, TrustRow, StickyBar, PageLoading | ⬜ |
| U-A1 | Admin orders: date-range + payment filters, column sort, CSV export | ✅ 2026-07-05 |
| U-A2 | Admin UX pass: bulk status actions, sticky header, keyboard shortcuts | ⬜ |
| U-A3 | Admin full i18n: 105 keys × 6 locales, language switcher, locale-aware dates/currency | ✅ 2026-07-05 |
| U-X1 | Shipping carrier adapter interface (`server/shipping/`) mirroring payment registry; checkout quotes by destination country with FR fallback | ✅ 2026-07-05 |
| U-X2 | Aggregator integration (Sendcloud/Boxtal): labels + tracking webhooks + Bancontact/iDEAL via PSP adapter | ⏸ owner accounts |
| EXT | Sentry + Resend + Merchant Center + AI key — **with owner, after build** | ⏸ owner |

## Phase R1 — Money path (rebuild from blank file)

| Unit | Scope | Status |
|---|---|---|
| U-P1 | Checkout `/commande`: one-page ①②③ blocks (billing folded into Adresse), guest-first hint, completion checkmarks, mobile sticky pay bar, inline validation, explicit disabled reasons — money logic (PayPal/addresses/Turnstile) preserved verbatim | ✅ 2026-07-05 |
| U-P2 | PDP `/produits/[slug]`: bordered buy-box (PriceTag + StockBadge + swatches + qty + CTA + 4-item trust row), specs/description full-width below fold, DS Breadcrumbs, unified toast, sticky mobile bar with PriceTag | ✅ 2026-07-05 |
| U-P3 | Header v2 + instant search (suggest endpoint + UI) | ⬜ |
| U-P4 | Cart drawer + `/panier` v2, toast-undo remove, free-shipping bar | ⬜ |

## Phase R2 — Discovery

| Unit | Scope | Status |
|---|---|---|
| U-P5 | Listing `/produits`: BottomSheet filters, chips, URL-synced | ⬜ |
| U-P6 | Home v2 + promo/announcement bar (Sanity-driven) | ⬜ |
| U-P7 | Search results page + no-results UX | ⬜ |
| U-P8 | Guide (recreate) + Comparatif + FAQ v2 | ⬜ |
| U-P9 | Blog v2 + related-products blocks | ⬜ |
| U-M1 | Recently-viewed strip · U-M2 Wishlist v1 | ⬜ |

## Phase R3 — Account & auth

| Unit | Scope | Status |
|---|---|---|
| U-P10 | Auth pages v2 + "Google account" hint + password reset UI (endpoints P0-06/07) | ⬜ |
| U-P11 | Account v2 + order tracking timeline + one-click reorder | ⬜ |
| U-P12 | Contact/a-propos/legal v2 | ⬜ |

## Phase R4 — Markets (BE/NL/DE/ES)

| Unit | Scope | Status |
|---|---|---|
| U-K1 | Per-language Merchant feeds (nl/de/es) + BE country targeting (fr-BE/nl-BE reuse) + x-default hreflang + CI hreflang check | ⬜ |
| U-K2 | DE compliance pages (Impressum, Widerruf, BattG) + EU withdrawal in CGV | ⬜ owner-assisted |
| U-K3 | Shipping zones BE/NL/DE/ES in Sanity + checkout country filtering | ⬜ owner pricing |
| U-K4 | Native review pass NL/DE/ES (BE covered by fr+nl) | ⏸ owner reviewers |

## Phase R5 — Hardening

| Unit | Scope | Status |
|---|---|---|
| U-Q1 | Lighthouse CI + bundle budget gates | ⬜ |
| U-Q2 | Full E2E matrix (4 langs × 2 viewports) + visual baselines all pages | ⬜ |
| U-Q3 | axe pass + RTL dedicated pass + hydration-mismatch fix (known-issue #2) | ⬜ |
| U-M3 | Back-in-stock alerts (needs Resend) · U-M4 PWA | ⬜ |

## Phase R6 — SEO engine & launch

| Unit | Scope | Status |
|---|---|---|
| U-S1 | Emails: order confirmation + shipped-with-tracking + admin alert (needs Resend) | ⏸ owner |
| U-S2 | Trustpilot post-purchase + aggregateRating JSON-LD | ⏸ owner |
| U-S3 | First content batch: 1 buying guide × 4 languages + internal links | ⬜ |
| U-S4 | Launch checklist (plan §9) + 7-day bake | ⬜ |
