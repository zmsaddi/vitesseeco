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
| U-P3 | Header v2: search centered (always visible, both viewports), flat category nav replaces mega-dropdown, instant suggest endpoint (word-prefix GROQ, 60s cache), recent searches, see-all → /produits?q= | ✅ 2026-07-05 |
| U-P4 | Cart: toast system gained inline actions; remove-with-real-Undo in drawer + /panier; free-shipping progress bar added to drawer (lazy threshold fetch) | ✅ 2026-07-05 |

## Phase R2 — Discovery

| Unit | Scope | Status |
|---|---|---|
| U-P5 | Listing `/produits`: removable active-filter chips row, mobile filters in DS BottomSheet with live "show N products" footer, desktop rail unchanged (URL-sync/sort/counts were already solid) | ✅ 2026-07-05 |
| U-P6 | Home v2: category tiles right after hero, trust strip moved below bestsellers; sitewide AnnouncementBar (Sanity siteSettings.announcement, dismiss-per-message) | ✅ 2026-07-05 |
| U-P7 | No-results UX on /produits?q=: query echoed back, hint line, category suggestion chips with counts, clear-all — never a dead end | ✅ 2026-07-05 |
| U-P8b | Comparatif full review + rebuild: rows grouped by modelFamily (one row per MODEL, color dots link to each variant, min–max price, summed stock), dead category filter → working brand filter, RTL logical props on sticky column/search, sv() on all spec cells, accessible stock indicator, Breadcrumbs, no-results clear button | ✅ 2026-07-05 |
| U-P8 | Guide recreated at /guide: interactive 3-question selector (usage/height/range) over live bike catalog, forgiving spec matching, help CTA; back in header nav + both sitemaps (reused surviving guide.* keys ×6) | ✅ 2026-07-05 |
| U-P9 | Blog: related-products blocks + Article JSON-LD verified already built (schema + render + query); DS Breadcrumbs unified on article page | ✅ 2026-07-05 |
| U-M1 | Recently-viewed strip (localStorage, max 8) on home + PDP, recorded on every product view | ✅ 2026-07-05 |
| U-M2 | Wishlist v1: heart toggle in PDP buy-box, /favoris page (grid + remove + EmptyState, noindex), header heart icon with count badge, localStorage max 50, toasts | ✅ 2026-07-05 |

## Phase R3 — Account & auth

| Unit | Scope | Status |
|---|---|---|
| U-P10 | Login: Google-account hint shown with any auth error (generic, no enumeration) — password reset UI waits on Resend (owner accounts session) | ✅ partial 2026-07-05 |
| U-P11 | Order detail: 4-step status timeline (paid→processing→shipped→delivered, hidden when cancelled, pending note) + one-click reorder rebuilding cart lines from LIVE product data (fresh price/stock, qty capped, partial-availability toasts) | ✅ 2026-07-05 |
| U-P12 | Contact/a-propos/legal v2 | ⬜ |

## Phase R4 — Markets (BE/NL/DE/ES)

| Unit | Scope | Status |
|---|---|---|
| U-K1 | Shared merchantFeed builder; feeds live for fr/nl/de/es with localized titles + locale-prefixed links; fr-BE/nl-BE hreflang added (x-default already existed); llms.txt lists all feeds. Owner registers each feed per country in Merchant Center | ✅ 2026-07-05 |
| U-K2 | DE compliance pages (Impressum, Widerruf, BattG) + EU withdrawal in CGV | ⬜ owner-assisted |
| U-K3 | Shipping zones BE/NL/DE/ES in Sanity + checkout country filtering | ⬜ owner pricing |
| U-K4 | Native review pass NL/DE/ES (BE covered by fr+nl) | ⏸ owner reviewers |

## Phase R5 — Hardening

| Unit | Scope | Status |
|---|---|---|
| U-Q1 | Verified already built: ci.yml runs bundle budget (13MB gzip, blocking) + Lighthouse CI on master pushes (perf≥85/a11y≥90/seo≥90, continue-on-error while tuning) | ✅ pre-existing |
| U-Q3a | Known issues closed: #3 Turnstile reset (verified already fixed), #4 guest_email hygiene (fixed both creation paths). #2 hydration mismatch remains open | ✅ 2026-07-05 |
| U-Q2 | Full E2E matrix (4 langs × 2 viewports) + visual baselines all pages | ⬜ |
| U-Q3 | axe pass + RTL dedicated pass + hydration-mismatch fix (known-issue #2) | ⬜ |
| U-M3 | Back-in-stock alerts (needs Resend) · U-M4 PWA | ⬜ |

## Phase R6 — SEO engine & launch

| Unit | Scope | Status |
|---|---|---|
| U-S0 | GEO / AI-answer readiness: robots.txt welcomes all major AI crawlers (private paths kept), dynamic /llms.txt (llmstxt.org) with company facts, policies, key pages, feeds + top-30 live products | ✅ 2026-07-05 |
| U-S0b | Distribution pack: IndexNow (key file + admin one-tap submit of all URLs ×6 locales to Bing/Yandex/partners), blog RSS with autodiscovery, OpenSearch browser-search registration, web app manifest + theme-color, sitewide og:site_name/twitter:card | ✅ 2026-07-05 |


| Unit | Scope | Status |
|---|---|---|
| U-S1 | Emails: order confirmation + shipped-with-tracking + admin alert (needs Resend) | ⏸ owner |
| U-S2 | Trustpilot post-purchase + aggregateRating JSON-LD | ⏸ owner |
| U-S3 | First content batch: 1 buying guide × 4 languages + internal links | ⬜ |
| U-S4 | Launch checklist (plan §9) + 7-day bake | ⬜ |
