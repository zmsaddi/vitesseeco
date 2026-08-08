# Vitesse Eco — Master Rebuild Plan

> **ARCHIVED — historical record, not instructions.** The rebuild finished and
> the cutover happened on 2026-07-30; this document is written about a state that
> has passed. For what is true now read
> [docs/architecture/CURRENT.md](../../architecture/CURRENT.md).

---

> **Status:** Approved — THE official reference for all work
> **Created:** 2026-07-05 · **Owner:** zmsaddi
> **Mission:** Rebuild the entire website experience once, expert-grade, mobile-first —
> and make Vitesse Eco the #1 e-mobility store result in **France, Belgium, Netherlands, Germany, Spain**.
> (Belgium added 2026-07-05 — cheapest market entry: fr + nl locales already cover both Belgian language communities.)
> **Timeline:** 12 weeks, weekly shippable milestones
> **Supersedes:** the experience-reconstruction plan, absorbed into this one and retired 2026-07-30.
> The security backlog it referred to was retired with it: eight of its ten items are structural
> in the rebuild, one is moot, and the one still open lives in [CUTOVER.md](CUTOVER.md).
> See [README.md](../../README.md) for what was retired and why.

---

## 0. Doctrine — how we rebuild

1. **Rebuild, don't patch.** Every page is rewritten from a blank file against this plan's
   specs. No legacy markup survives by inertia — only by passing review.
2. **Keep the money engine.** The transactional backend (PG-primary orders, stock locks,
   PayPal, outbox→Sanity, audit) is proven in production. It is NOT rebuilt. Rebuilding
   working payment code adds risk and zero customer value. Everything above it is.
3. **Mobile-first literally.** Every page is designed at 375px first, then expanded.
   Desktop is the adaptation.
4. **Familiarity is the UX.** Amazon/Shopify-class conventions everywhere. Brand lives in
   color/type/imagery — never in navigation or flow. (Owner: site is confusing, not ugly.)
5. **No silent anything.** Every action gives feedback ≤100ms; every error says what
   happened and what to do next; every disabled control shows why. Specified in §4.
6. **Ship weekly behind flags.** Each rebuilt page replaces the old one via its own PR +
   tests + visual baseline. `ENABLE_NEW_*` env flags where risk warrants instant rollback.
7. **#1 is a program, not a feature.** Technical SEO gets to the starting line; content,
   reviews, and per-market operations win the race. §7 is as binding as the code sections.

---

## 1. Current state (what we build on)

| Asset | Status |
|---|---|
| Nuxt 3 + Sanity + Neon PG + Vercel | Keep — modern, fits free-tier strategy |
| PG-primary orders, stock locks, outbox, audit, events | Keep — live and verified |
| PayPal live + adapter registry (stripe/inStore stubs) | Keep |
| Admin panel `/admin` (dashboard, orders, stock, messages) | Built 2026-07-05 — extend in §6 |
| Google Merchant feed `/feeds/google-merchant.xml` | Built 2026-07-05 |
| hreflang 6 langs, JSON-LD (Product/FAQ/Article/Org/LocalBusiness/WebSite), dynamic sitemap | Keep + harden in CI |
| i18n 6 locales × 353 keys | Keep; native review required (§7.3) |
| All customer-facing pages/components | **Rebuilt** (§3) |
| Email (Resend), password reset, Sentry | **Missing — Week 1 blockers** |

---

## 2. Phase map

```
R0  Wk 1      Foundation: Sentry, emails, baselines, Design System v2 + feedback kit
R1  Wk 2-4    Money path rebuild: checkout, product page, cart, header+search
R2  Wk 5-6    Discovery rebuild: listing, home, search results, guide, FAQ, blog
R3  Wk 7      Account & auth rebuild + password reset + order tracking
R4  Wk 8      Market program: NL/DE/ES localization, legal compliance, per-market SEO
R5  Wk 9-10   Hardening: performance budgets, a11y AA, full E2E matrix, RTL pass
R6  Wk 11-12  SEO content engine, reviews, launch checklist, monitoring
ADM continuous Admin v2: promos, notifications, invoices (§6)
```

Every week ends with: deploy to production, DoD checklist (§9) green for shipped units.

---

## 3. Track A — Full page rebuild (R1–R3)

### 3.1 Design System v2 (R0 — prerequisite for everything)

Component library, built first, used exclusively (no ad-hoc markup in pages):

| Category | Components |
|---|---|
| Primitives | Button (5 variants × 6 states), Input, Select, Checkbox, Radio, QuantityStepper, Textarea |
| Feedback (§4) | AppDialog (modal), ConfirmDialog, AppToast (exists), InlineError, FormError summary, Banner |
| Loading | Skeleton (exists), SpinnerButton state, PageLoading bar |
| Commerce | ProductCard v2, PriceTag (sale/regular), StockBadge, ColorSwatches, TrustRow, RatingStars (placeholder until reviews) |
| Structure | Breadcrumbs, Tabs, Accordion, EmptyState (exists), Pagination, BottomSheet (mobile filters) |
| Layout | AppHeader v2 (search-centered), AppFooter v2, StickyBar (mobile PDP/checkout CTA) |

Rules: tokens only (no raw hex — CI-enforced already), touch targets ≥44px, one primary
action per view, `focus-visible` ring on everything, all text via i18n keys (6 locales).

### 3.2 Page rebuild order & specs

| # | Page | Wk | Key spec (each also passes §4 + §5) |
|---|---|---|---|
| 1 | Checkout `/commande` | 2 | One page, 3 blocks (①Adresse ②Livraison ③Paiement), guest-first, PayPal express top, auto-select single options, price-lock verified, stepper progress, per-field inline validation on blur |
| 2 | PDP `/produits/[slug]` | 3 | Amazon buy-box right/sticky-bottom-mobile, gallery with zoom+swipe, color swatches (modelFamily), delivery estimate, TrustRow, specs table, sticky Add-to-Cart, JSON-LD verified in CI |
| 3 | Header + instant search | 3 | Logo left / search center / account+cart right; search suggests products+categories after 2 chars (<150ms, serverless endpoint over Sanity), recent searches localStorage; flat category nav |
| 4 | Cart drawer + `/panier` | 4 | Drawer = feedback after add; page = review; quantity stepper with stock ceiling; free-shipping progress bar; single CTA; remove = one tap + toast undo |
| 5 | Listing `/produits` | 5 | Filters: desktop left rail, mobile BottomSheet; active filters as chips; sort; result count; URL-synced state (shareable/SEO); skeleton grid on load |
| 6 | Home | 5 | Category tiles → bestsellers → trust strip → current promos → blog teasers; zero decoration that doesn't sell |
| 7 | Search results page | 6 | Full results for submitted queries, "no results" with suggestions + top categories |
| 8 | Guide (rebuild — deleted page), Comparatif, FAQ | 6 | Buying guides per category (SEO backbone, §7), comparison table mobile-scrollable, FAQ with FAQPage JSON-LD |
| 9 | Blog index + article | 6 | Article JSON-LD, related products blocks (internal linking for SEO) |
| 10 | Auth: connexion/inscription + reset | 7 | Single AuthCard pattern, Google button prominent, password reset flow (P0-06/07/08), explicit error for "account exists via Google — use Google button" (fixes the owner's own confusion this week) |
| 11 | Account `/compte` + order tracking | 7 | Status timeline (Confirmée→Préparée→Expédiée→Livrée) with carrier link, addresses, profile |
| 12 | Legal pages + contact + a-propos | 7 | LegalSections kept, contact with Turnstile states, per-market legal variants (§7.4) |

Each page PR contains: the rebuilt page, its e2e spec (FR mobile+desktop minimum),
a visual baseline, and i18n keys in all 6 locales (`check:langs` gate).

### 3.3 Modern commerce layer (market-standard features)

| Feature | Status / Wk |
|---|---|
| **WhatsApp chat** (floating widget, prefilled context) | ✅ Delivered 2026-07-05 |
| **Assistant chatbot**: live order tracking (PG, ownership-verified), FAQ answers in visitor's language, product suggestions, human handoff; auto-upgrades to Claude AI when `ANTHROPIC_API_KEY` is set | ✅ Delivered 2026-07-05 (rules engine) · AI key wired with owner post-build |
| Recently-viewed products strip (localStorage) | Wk 5 |
| Wishlist (localStorage v1, account-synced v2) | Wk 6 |
| Back-in-stock email alert (needs Resend) | Wk 8 |
| Sitewide promo/announcement bar (Sanity-driven) | Wk 5 |
| One-click reorder from order history | Wk 7 |
| PWA (installable, offline shell) | Wk 10 |

---

### 3.4 Payments & shipping — API-ready by architecture

> Owner directive 2026-07-05: the site must be ready to plug in ANY payment API and
> ANY shipping-carrier API.

**Payments (already architected — ADR-07):** `server/payments/index.ts` maps
`paymentMethod.code → adapter`. Adding a PSP = one adapter module + one Sanity document
+ one env flag. Live today: PayPal. Stubbed: Stripe, in-store. Planned per market:
**Bancontact (BE)** and **iDEAL (NL)** — both available through Stripe or Mollie with a
single adapter each; these are must-haves (majority local payment preference in BE/NL).

**Shipping (mirror the same pattern):**
- `server/shipping/` carrier adapter interface: `quote(cart, address)`,
  `createLabel(order)`, `track(trackingNumber)`, `onWebhook?()`.
- Expert route: integrate ONE **shipping aggregator API** (Sendcloud or Boxtal) instead
  of N carrier integrations — a single adapter yields Colissimo, Chronopost, Mondial
  Relay, bpost (BE), PostNL (NL), DHL, DPD + label PDF + tracking webhooks. Direct
  per-carrier adapters remain possible through the same interface if ever needed.
- Tracking webhooks update `orders.status` → existing outbox syncs Sanity → customer
  email fires automatically (§6).

## 4. Feedback system spec — "all dialogs, errors, responses"

The complete inventory. Every rebuilt page implements the relevant rows; nothing else invents patterns.

### 4.1 Dialogs (AppDialog / ConfirmDialog)

| Trigger | Type | Content rule |
|---|---|---|
| Remove cart item | Toast + undo (NO dialog — low stakes) | "Article retiré · Annuler" 5s |
| Clear cart / cancel order (admin) | ConfirmDialog | Verb-specific button ("Vider le panier"), never "OK" |
| Leave checkout with filled form | Browser beforeunload only | No custom nag dialogs |
| Delete account | ConfirmDialog + typed confirmation | Exists — restyle |
| Price changed at order create | AppDialog | Old→new price shown, "Continuer" / "Revoir le panier" |
| Stock dropped below cart qty | AppDialog | Per-item availability, auto-adjust option |

### 4.2 Error responses (client rendering of API errors)

| Status | UX |
|---|---|
| 400 field errors | Inline under field + focus first error + form-top summary (a11y: role=alert) |
| 401 | Redirect to /connexion with `?next=` return path + toast "Connectez-vous pour continuer" |
| 403 | Friendly page "Accès réservé" |
| 404 (product/order) | Branded page: search bar + top categories + "continuer mes achats" |
| 409 stock/promo/duplicate | Specific dialog/inline per §4.1 — never generic |
| 429 rate limit | Toast "Trop de tentatives — réessayez dans un instant" |
| 500 / network fail | Retry pattern: inline block with "Réessayer" button; auto-retry once on GET; Sentry captures |
| Offline | Global banner "Connexion perdue" (navigator.onLine), queued cart ops |
| Turnstile pending/failed | Existing P0-15 states, restyled into kit |

### 4.3 Response states (success/loading)

- Add to cart → drawer opens (desktop: toast + mini-cart bounce) — never a page jump.
- Any submit button → SpinnerButton state, disabled WITH visible reason if precondition missing.
- Order placed → full-screen confirmation with number, next steps (3), email note, tracking link.
- Every list/detail fetch → skeleton (never blank, never layout shift — CLS budget 0.1).
- Form saves (account/admin) → toast + optimistic UI where safe.

---

## 5. Non-negotiable quality gates (every page, CI-enforced by R5)

| Gate | Budget |
|---|---|
| Lighthouse mobile (perf/a11y/SEO/BP) | ≥90 each, key pages ≥95 SEO |
| LCP / CLS / INP (p75 field, via vitals endpoint) | <2.5s / <0.1 / <200ms |
| Initial JS | ≤200KB gzip (script exists — wire to CI) |
| axe-core | 0 critical/serious |
| Touch targets | ≥44px |
| E2E matrix | checkout FR/EN/ES/AR × mobile/desktop green |
| Visual regression | baselines for all rebuilt pages × 2 viewports |
| RTL (AR) | dedicated pass — mirrored icons, logical properties only |
| `check:langs` + `check:hex` | green (existing) |

---

## 6. Track B — Admin v2 (continuous)

Built: dashboard, live orders, stock, messages. Add:

Owner feedback 2026-07-05: "more professional, easier, needs filters" — rows 2-3 below address it directly.

| Wk | Feature |
|---|---|
| 2 | Orders: date-range + payment-method filters, column sort, sticky table header, CSV export |
| 2 | UX pass: bulk status actions, keyboard shortcuts (/, Esc), denser table option, empty-state guidance |
| 3 | New-order notification: email (Resend) + optional Telegram bot |
| 4 | Status-change → automatic customer email (shipped = tracking link) |
| 5 | `/admin/promos`: list, toggle, usage counters, create simple codes |
| 6 | Invoice print view (browser print CSS; PDF later if needed) |
| 8 | Per-market view: orders/revenue split by shipping country |
| 10 | Funnel trends chart (7/30d) on dashboard |

Benchmark stays: process an order < 60s; every daily task ≤3 clicks.

---

## 7. Track C — #1 in FR / BE / NL / DE / ES

**Honest model:** rankings = Technical × Content × Authority × Time. Code delivers
Technical 100%. Content and Authority are operated programs defined here — skipping
them means not ranking, regardless of code quality.

### 7.1 Technical per-market (code — R4)

- hreflang already live for fr/nl/de/es/en/ar ✅; add x-default plus fr-BE / nl-BE
  regional variants; CI check that every indexable page emits complete hreflang
  cluster + canonical.
- Per-language Merchant feeds: `/feeds/google-merchant-{nl,de,es}.xml` with translated
  titles/descriptions (same EUR prices), submitted as separate country feeds.
  Belgium: submit the FR feed for country BE (fr-BE) and the NL feed for BE (nl-BE) —
  no new feed generation needed.
- GSC: one property, per-country performance monitoring; Bing Webmaster too.
- Per-market meta title/description patterns keyword-researched per language
  (e.g. DE: "E-Bike kaufen", NL: "elektrische fiets kopen", ES: "bicicleta eléctrica").
- Localized slugs stay French (URL change = SEO reset — NOT worth it); language prefix
  routing already handles market targeting.

### 7.2 Content engine (operated program — R6 onward, 2-4 pieces/month/language)

- Buying guide per category per language (the rebuilt Guide page is the hub).
- Comparison pages ("X vs Y") — highest commercial intent, weakest competition.
- FAQ expansion per market (battery law DE, bike subsidies FR/NL, etc.).
- Every product: unique 150+ word description per language (no thin/duplicate content).
- Internal linking: blog→product, guide→category, PDP→guide.

### 7.3 Localization quality (R4) — HARD GATE

> Owner directive 2026-07-05: translations must be **professional, market-native copy —
> not generic translation**. This is a release gate, not a nice-to-have.

- Professional native-speaker review (e-commerce experience required) of NL/DE/ES locale
  files + product/legal content BEFORE any marketing push in that country. No market
  launches on unreviewed copy.
- Terminology per market researched, not translated (e.g. DE "E-Bike" not "elektrisches
  Fahrrad" in headlines; NL "e-bike"/"elektrische fiets" per search volume).
- Locale-correct number/date/currency formatting everywhere (Intl APIs) — admin panel
  included (6 languages + language switcher; the switcher was missing from the rebuilt
  admin shell until 2026-08-08, see U-A3 in REBUILD_EXECUTION.md).

### 7.4 Market-entry compliance (R4 — legal/ops, owner + code)

| Market | Requirement | Action |
|---|---|---|
| DE | Impressum, Widerrufsbelehrung (14-day withdrawal), Preisangabenverordnung (unit pricing), battery-law notice (BattG) | Legal page variants + checkout copy; owner validates with advisor |
| BE/NL/ES/EU | 14-day withdrawal, ODR platform link, consumer-law delivery promises | CGV additions per language |
| BE | Bilingual customer service expectation (fr/nl both live) + BE shipping zone | Shipping config + contact copy |
| EU VAT | Distance-selling >€10k/yr → **OSS registration** (one French filing for all EU VAT) | Owner + accountant; site shows TTC prices (already does) |
| Shipping | Real carrier methods + prices per country in Sanity shippingMethod zones | Configure BE/NL/DE/ES zones; checkout filters by country (adapter exists) |
| Reviews | Trustpilot (free tier) wired post-purchase email | R6; review stars → JSON-LD aggregateRating → SERP CTR |

### 7.5 AI-answer readiness (GEO) — owner directive 2026-07-05

> The site must be a competitive DATA SOURCE for AI assistants (Google AI
> Overviews/Gemini, ChatGPT, Claude, Perplexity), not only for classic SERPs.

- ✅ robots.txt explicitly welcomes AI crawlers (GPTBot, OAI-SearchBot,
  ChatGPT-User, ClaudeBot/Claude-Web/anthropic-ai, Google-Extended,
  PerplexityBot, CCBot, meta-externalagent) while keeping /api /compte /admin private.
- ✅ /llms.txt (llmstxt.org): curated markdown map — company facts, policies,
  key pages, machine-readable feeds, top products with live EUR prices.
- ✅ SSR on Vercel: full HTML for every crawler, no JS-only content.
- ✅ Structured data: Product, BreadcrumbList, FAQPage, Article, Organization,
  LocalBusiness, WebSite JSON-LD — the formats AI answers quote from.
- ✅ hreflang ×6 + dynamic sitemap + Merchant feed.
- ⚠ What actually earns citations: the §7.2 content engine (guides, comparisons,
  unique per-product copy) + §7.4 reviews. LLMs cite sources that answer
  questions completely — technical access is now 100% open; content depth is
  the ongoing battle.

### 7.6 Marketplace & social-commerce program — owner directive 2026-07-05

> Goal: presence on TikTok, marketplaces and each country's leading platforms,
> until platforms come to US. Honest model: platforms chase stores with
> volume, reviews and traffic — the flywheel starts by shipping on them first.

**One pipe, many channels.** `/feeds/catalog.csv` (Google-spec columns) plugs
into a channel manager (Channable ≈ €29/mo, or Lengow/Shoppingfeed/BaseLinker),
which pushes to everything below. Never build N integrations by hand.

| Channel | Countries | Requirements (owner) |
|---|---|---|
| TikTok Shop / Catalog ads | all | TikTok Business account; accepts our Google-format feed URL directly |
| Meta (FB/IG Shops + Marketplace) | all | Meta Business + Commerce Manager; feed URL directly |
| Pinterest | all | Business account; feed URL directly |
| Amazon | FR/BE/NL/DE/ES | Seller Central (€39/mo pro) + **EAN/GTIN per product (pipeline BUILT 2026-07-05: `gtin` field + `cms/scripts/assign-gtins.mjs` + feeds emit gtin — blocked only on owner buying a GS1 France prefix)** + VAT/OSS |
| eBay | FR/DE/ES/BE/NL | Seller account; EANs strongly recommended |
| bol.com | NL/BE | Retailer account + **EAN required** + NL/BE returns address |
| Cdiscount (Octopia) | FR | Seller account; EAN required |
| Kaufland.de | DE | Seller account + EAN + DE compliance (§7.4: BattG/WEEE for e-bikes!) |
| Leboncoin (pro) / Marktplaats / 2dehands / Wallapop | FR / NL / BE / ES | Pro accounts; classifieds-style, good for local demand capture |

**Sequencing:** 1) EANs sourced (automation ready — GS1 prefix pending) → 2) channel manager trial with catalog.csv →
3) TikTok+Meta (free listings, no EAN wall) → 4) bol+Kaufland (Benelux/DE
e-bike demand) → 5) Amazon last (fees + competition highest).

### 7.7 Leading indicators (monthly review vs #1 goal)

GSC impressions & CTR per market → indexed pages → CWV field data → conversion per
market → (lagging) rankings for target keyword set per language (tracked list of 20/market).

---

## 8. Owner dependencies (only you can unblock)

| # | What | Blocks | When |
|---|---|---|---|
| 1 | Resend account + DNS verify + `RESEND_API_KEY` | Order emails, reset, notifications | **Week 1** |
| 2 | Sentry account + DSN | Error visibility | **Week 1** |
| 3 | Google Merchant Center + submit feed URL(s) | Shopping presence in all 4 markets | Week 1-2 |
| 4 | Native reviewers NL/DE/ES (freelance ok) | §7.3 | Week 7 |
| 5 | Accountant: OSS/VAT + DE legal check | §7.4 | Week 7 |
| 6 | Carrier pricing for NL/DE/ES shipping | Checkout for those markets | Week 7 |
| 7 | Trustpilot account | Reviews/stars | Week 10 |
| 8 | Telegram bot token (optional) | Instant order pings | Week 3 |
| 9 | Content pipeline decision: who writes/reviews monthly content | §7.2 forever | Week 10 |

---

## 9. Definition of Done (per shipped unit + at launch)

Per page: spec §3.2 met · §4 states implemented · §5 gates green · 6-locale keys ·
e2e + visual tests committed · deployed and manually smoke-tested on real phone.

At launch (end R6): all pages rebuilt · zero legacy components in use · full E2E matrix
green · CWV field p75 within budget 7 consecutive days · Sentry <1 new error type/day ·
emails delivering >99% · feeds accepted in Merchant Center (4 markets) · GSC zero
coverage errors · admin processes order <60s · rollback flags documented.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Big-bang regression | No big bang — page-by-page behind flags, visual+e2e per PR |
| Free-tier ceilings (Neon/Resend/Vercel Hobby ToS) | Existing free-tier strategy; upgrade triggers documented in PRODUCTION_UPGRADE_PLAN §4; Vercel Pro when orders stabilize |
| Translation quality kills DE/NL trust | Native review gate before market push (owner dep #4) |
| Content program stalls after launch | §7.2 cadence reviewed monthly with owner; without it, #1 goal is explicitly at risk |
| Scope creep into backend rewrite | Doctrine §0.2 — backend changes only via security backlog |

## 11. Change log

| Date | Change |
|---|---|
| 2026-07-05 | v1 approved. Full-rebuild mandate from owner ("one time, better than fix every time"; #1 in FR/NL/DE/ES). Absorbs EXPERIENCE_RECONSTRUCTION_PLAN.md. |
