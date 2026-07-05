# Vitesse Eco — Experience Reconstruction Plan

> **Status:** SUPERSEDED (2026-07-05) by [MASTER_REBUILD_PLAN.md](MASTER_REBUILD_PLAN.md) — full-rebuild mandate absorbed this plan. Kept for history only.
> **Created:** 2026-07-05
> **Owner:** zmsaddi
> **Target:** 6–8 weeks, iterative weekly releases
> **Supersedes:** UX scope of [PRODUCTION_UPGRADE_PLAN.md](PRODUCTION_UPGRADE_PLAN.md) (its security/data-integrity backlog remains authoritative)
> **Reversed decision:** Q-09 — a dedicated `/admin` panel WILL be built; Sanity Studio becomes content-only

---

## 1. Why this plan exists

Customer and admin feedback (2026-07):

| Audience | Verbatim complaint | Root cause |
|---|---|---|
| Customers | "Complicated to understand how the website works" — expected something smooth/clear/clean like Amazon or Shopify stores. **Owner clarification (2026-07-05): the site is NOT perceived as ugly — the problem is confusion, not aesthetics.** | Information architecture and flow don't follow familiar e-commerce conventions; users must *learn* the site instead of *recognizing* it |
| Admins | Sanity Studio is not friendly for daily operations | Studio is a CMS, not an operations tool. Orders live in PostgreSQL (PG-primary) but admins see a 5–15 min delayed mirror in Studio, edited through a document-editor UI |

### Guiding principle

> **Don't make users think. Don't make users learn.**
> Every screen must look and behave like the e-commerce patterns customers already know from Amazon/Shopify-class stores. Familiarity IS usability. Originality in layout/flow is a bug, not a feature. Brand personality lives in color, typography, imagery, and tone — never in navigation or flow.

### What this plan is NOT

- ❌ Not a rewrite. Nuxt 3 + Sanity + Neon PG + PayPal stay. The transactional backend (PG-primary orders, outbox, stock locks) is sound and keeps running untouched.
- ❌ Not a rebrand or visual reskin. The visual identity stays (customers do NOT find the site ugly). 100% of the effort goes to **flow clarity**: navigation, findability, feedback, and familiar patterns.

---

## 2. Track A — Customer Experience (Amazon/Shopify conventions)

### 2.1 UX Doctrine — the convention checklist

Every redesigned page is reviewed against this list before merge:

**Global layout**
- [ ] Header: logo left → prominent **search bar center** (always visible, desktop + mobile) → account + cart right. This is the Amazon pattern; no exceptions.
- [ ] Simple category navigation: flat, labeled, predictable (Vélos, Pièces, Accessoires, Enfants). Replace the mega-dropdown with a simple, scannable menu.
- [ ] Breadcrumbs on every catalog/product page (`Accueil › Vélos › V20 Pro Noir`).
- [ ] Footer: standard columns (Shop / Help / Company / Legal) — no surprises.
- [ ] One primary CTA per screen. Everything else is visually secondary.

**Product discovery**
- [ ] **Site-wide instant search** with suggestions (product names + categories) — currently missing entirely; this is the single biggest "how does this site work" fix.
- [ ] Listing page: filters left (desktop) / bottom-sheet (mobile), sort dropdown top-right, result count visible, active filters shown as removable chips.
- [ ] ProductCard: image, name, price, availability badge, rating placeholder — nothing else. Click anywhere = go to product.

**Product page (PDP) — the Amazon buy-box pattern**
- [ ] Gallery left, **buy-box right**: price, stock status ("En stock" green / "Plus que 2" orange), delivery estimate, big Add-to-Cart, PayPal express button under it.
- [ ] Mobile: sticky bottom bar with price + Add-to-Cart (always reachable without scrolling).
- [ ] Color siblings (System B modelFamily) as clear swatches near the price.
- [ ] Specs in a scannable table below the fold; description after.
- [ ] Trust row near CTA: warranty, delivery time, returns — icons + one line each.

**Cart & Checkout — zero ambiguity**
- [ ] Mini-cart drawer for feedback after "add"; full `/panier` page for review. Both show: items, totals, shipping estimate, ONE checkout button.
- [ ] Checkout = **one page, three visible blocks** stacked in order: ① Adresse ② Livraison ③ Paiement. No hidden steps, no surprise fields.
- [ ] Guest checkout is the default path; account creation is an optional checkbox, never a wall.
- [ ] Single shipping/payment option → auto-selected (never force a click on the only choice).
- [ ] Disabled button ALWAYS shows why, inline, in plain language ("Vérification de sécurité en cours…", "Adresse incomplète").
- [ ] PayPal express button also available at top of checkout (skip address typing — PayPal returns it).
- [ ] Confirmation page: big order number, what happens next (3 steps), link to tracking.

**Post-purchase transparency (currently missing — critical)**
- [ ] Order confirmation **email** within 1 minute (Resend).
- [ ] Order tracking page in `/compte` with status timeline (Confirmée → Préparée → Expédiée → Livrée) + carrier tracking number.
- [ ] Password reset flow (still missing — SEC-04).

**Copy & language**
- [ ] Microcopy: short, action verbs, no jargon. "Ajouter au panier", never clever alternatives.
- [ ] Every error message says what happened AND what to do next.
- [ ] RTL Arabic gets the same quality bar, not a mirrored afterthought.

**Feel**
- [ ] Every click gives feedback within 100ms (spinner, skeleton, toast). No dead clicks — perceived slowness is what "complicated" often means.
- [ ] LCP < 2.5s on 4G mobile; skeletons for anything slower.
- [ ] Touch targets ≥ 44px; thumb-zone placement for primary actions on mobile.

### 2.2 Page rebuild order (by revenue impact)

| # | Page | Key changes |
|---|---|---|
| 1 | Checkout `/commande` | One-page 3-block layout, guest-first, express PayPal, explicit disabled-reasons |
| 2 | PDP `/produits/[slug]` | Buy-box pattern, sticky mobile CTA, trust row, color swatches |
| 3 | Header + search | Search bar center, simplified nav, working suggestions |
| 4 | Listing `/produits` | Filter chips, mobile bottom-sheet filters, sort, count |
| 5 | Cart drawer + `/panier` | Bigger targets, clear totals, single CTA |
| 6 | Home | Category tiles → bestsellers → trust → (remove anything that doesn't sell) |
| 7 | Account + tracking | Order timeline, addresses, profile |

### 2.3 Design system

- Extend existing UI kit (AppButton/AppInput/AppSkeleton/AppToast/EmptyState) to full coverage: Card, Badge, Modal, Select, QuantityStepper, Breadcrumbs, Tabs, PriceTag.
- Tokens in `tailwind.config`: spacing scale, radii, shadows, z-layers, motion durations. No raw hex in `.vue` (enforced by `check:hex`).
- **Visual identity unchanged** (dark, electric-green, technical brand stays — per owner: the site is not ugly, it is confusing). Design-system work serves *consistency and hierarchy* only: same button everywhere, same spacing rhythm, one obvious primary action per screen, layout density modeled on Shopify storefront themes (Dawn-class) for scannability.

---

## 3. Track B — Admin Experience (`/admin` panel)

### 3.1 Decision

Q-09 is **reversed** (2026-07-05, owner approval): build a dedicated, friendly `/admin` inside the same Nuxt app. Sanity Studio remains for **content only** (products, blog, pages, FAQ) — admins never open Studio for daily operations again.

### 3.2 Scope — v1 (what admins do daily)

| Section | Features | Data source |
|---|---|---|
| **Dashboard** | Today/7d/30d: orders, revenue, top products, funnel (from `events` table), low-stock alerts | PG (live) |
| **Commandes** | Live list (no sync lag), search by number/email/name, status flow buttons (Confirmée → Préparée → Expédiée → Livrée / Annulée), add tracking number, order detail with items + addresses + payment info, print-friendly invoice view | PG (live) |
| **Stock** | Inline-editable table (SKU, product, stock, price), low-stock highlight, bulk adjust; writes to PG `inventory` + queues Sanity sync via existing outbox | PG → outbox → Sanity |
| **Messages** | Contact messages list, mark handled | Sanity |
| **Promos** | List, activate/deactivate, usage counters | Sanity + PG counters |

### 3.3 Principles

- **Friendly = boring and obvious**: sidebar nav, big tables, big buttons, French labels, zero CMS concepts (no "documents", no "publish", no revision UI).
- Every daily task ≤ 3 clicks. Benchmark: process one order (view → mark shipped → add tracking) in under 60 seconds.
- Status changes trigger the customer email automatically (shipped → email with tracking link).
- Mobile-usable: admins check orders from their phone.

### 3.4 Technical shape

- Routes under `pages/admin/` guarded by route middleware + server-side `requireAdmin()` check on every `/api/admin/*` endpoint. v1 admin identity: `ADMIN_EMAILS` env allowlist (zero-migration); move to a `role` column on `customers` if the team grows.
- New `server/api/admin/*` endpoints reading PG directly (orders, inventory, stats). Reuse existing `orderService`, `stock`, `outbox`, `audit` utils — no new infra.
- Every admin mutation writes to the existing `audit_log`.
- Not indexed: `noindex` + excluded from sitemap.

### 3.5 Notifications

- New order → instant email to admin (Resend) **and/or** Telegram bot message (free, instant, works on phone) — owner picks one or both.

---

## 4. Track C — Reliability & Measurement (continuous)

- **Sentry** (free tier, ADR-04) — errors visible before customers report them.
- Wire **order confirmation email** + admin notification first (biggest trust win, smallest effort).
- Fix open items in [known-issues-post-pg-primary.md](known-issues-post-pg-primary.md): hydration mismatch (#2 — causes visible UI flicker = "broken feeling"), Turnstile reset warning (#3), guest_email hygiene (#4).
- Funnel dashboard from `events` table inside `/admin` (replaces "SQL only" decision Q-06 — same data, friendly view).
- E2E: full checkout in FR/EN/ES/AR × mobile/desktop before each release; visual regression on redesigned pages.

---

## 5. Timeline (6–8 weeks)

```
Week 1   Diagnosis wrap-up + Sentry + order-confirmation email + admin new-order alert
         └─ deliverable: customers get emails; errors are visible; complaints list finalized
Week 2   Design tokens/UI kit completion + /admin scaffold with live Orders list
         └─ deliverable: admins stop using Studio for viewing orders
Week 3-4 Checkout rebuild + PDP rebuild + /admin order status flow + stock table
         └─ deliverable: the two revenue-critical pages match the convention checklist
Week 5-6 Header/search + listing + cart + home + password reset + tracking page
         └─ deliverable: full customer journey is convention-compliant
Week 7-8 Polish, performance budget, a11y, RTL pass, staged rollout, bug bake
         └─ deliverable: Lighthouse ≥90 mobile on key pages; release
```

Rollout: each page ships behind its own PR with e2e + visual tests; no big-bang release. Feature-flag risky swaps (`ENABLE_NEW_CHECKOUT`) so rollback = env flip.

---

## 6. Owner dependencies (blockers only you can clear)

| # | What | Needed for | Effort |
|---|---|---|---|
| 1 | Create **Resend** account, verify domain `vitesse-eco.fr` (DNS records), put `RESEND_API_KEY` in Vercel env | Order emails, admin alerts, password reset (Week 1) | ~30 min |
| 2 | Create **Sentry** account (free), put DSN in Vercel env | Error visibility (Week 1) | ~15 min |
| 3 | (Optional) **Hotjar** free account | Session recordings during diagnosis | ~15 min |
| 4 | (Optional) Create a **Telegram bot** (via @BotFather) if you want instant order pings on your phone | Admin notifications | ~10 min |
| 5 | Collect the verbatim top-5 complaints from customers and admins | Priority validation | ongoing |

---

## 7. Success metrics

| Metric | Now | Target |
|---|---|---|
| Checkout funnel (checkout_started → order_created) | measure in Week 1 | +30% relative |
| Lighthouse mobile (home, listing, PDP, cart, checkout) | measure in Week 1 | ≥ 90 |
| LCP mobile 75th percentile | measure | < 2.5s |
| Admin: time to process one order | minutes in Studio | < 60s in /admin |
| Order confirmation email delivery | 0% (doesn't exist) | > 99% within 1 min |
| "How does this work" complaints | recurring | zero recurring |

---

## 8. Change log

| Date | Author | Change |
|---|---|---|
| 2026-07-05 | zmsaddi + Claude | Initial version. Approved as official reference. Q-09 reversed (dedicated /admin). Customer target experience defined as Amazon/Shopify-convention compliance. |
