# Vitesse Eco — Project Documentation
> **Last updated:** 2026-07-05 (full cleanup + docs/reality sync)
> **System:** B (product per color, no variants)
> **Active plan:** [docs/MASTER_REBUILD_PLAN.md](docs/MASTER_REBUILD_PLAN.md) — full website rebuild, target #1 in FR/BE/NL/DE/ES
> **Execution tracker:** [docs/REBUILD_EXECUTION.md](docs/REBUILD_EXECUTION.md) — live unit status (what is actually done)
> **Security backlog:** [docs/PRODUCTION_UPGRADE_PLAN.md](docs/PRODUCTION_UPGRADE_PLAN.md) (remains authoritative for SEC-*/OBS-* items)

## Project Overview
| Field | Value |
|-------|-------|
| **Business** | Vitesse Eco — Electric mobility retailer (bikes, parts, accessories, kids) |
| **Domain** | vitesse-eco.fr |
| **Contact** | contact@vitesse-eco.fr / +33 7 45 83 00 49 / WhatsApp wa.me/33745830049 |
| **Address** | 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France |
| **Company** | VITESSE ECO SAS — SIREN 100 732 247 — TVA FR43 100 732 247 |
| **Working directory** | `D:\vitesseeco` |
| **Communication** | Arabic only |
| **Website languages** | French (primary) + English, Spanish, Dutch, German, Arabic |
| **Target markets** | FR (priority) + BE + NL + DE + ES |
| **GitHub** | github.com/zmsaddi/vitesseeco |
| **Vercel** | vitesseeco.vercel.app |
| **Sanity** | Project: `2jvnjf0c`, Dataset: `production` + `staging` |
| **Node.js** | v24.14.1 |

## Critical Rules
1. **DO NOT use Nuxt 4** — IPC bug on Windows
2. **`ssr: process.env.VERCEL === '1'`** — SSR on Vercel, SPA locally
3. **Standard Nuxt 3 structure** — files in ROOT, no `app/` directory
4. **i18n:** `langDir: 'locales'`, `baseUrl: 'https://vitesse-eco.fr'` — **526 keys × 6 locales, must stay in sync**
5. **Sanity Studio** in `cms/` — excluded from Vercel via `.vercelignore`
6. **`sanity`** as devDependency in root — required by `@nuxtjs/sanity`
7. **Always answer user in Arabic**
8. **Run `npm run check:langs` (+ `npm run check:hex`) before every commit**
9. **System B:** Each color = separate product. No `variants[]`. Products linked via `modelFamily`
10. **PowerShell 5.1:** never put `"` characters inside git commit messages (breaks arg passing)
11. **Money engine is sacred:** PayPal payload building, address resolution and Turnstile flows are preserved verbatim during any page rework
12. **EAN/GTIN:** NEVER invent codes — assignment only inside the owner's licensed GS1 prefix via `cms/scripts/assign-gtins.mjs`

## Tech Stack
| Layer | Package | Version |
|-------|---------|---------|
| Framework | nuxt | ^3.17.5 (installs 3.21.x) |
| CSS | @nuxtjs/tailwindcss | ^6.14.0 |
| i18n | @nuxtjs/i18n | ^10.2.4 |
| State | @pinia/nuxt | ^0.11.3 |
| Persist | pinia-plugin-persistedstate | ^4.7.1 |
| CMS | @nuxtjs/sanity | ^2.3.0 |
| CMS Studio | sanity | ^5.20.0 |
| Icons | @nuxt/icon | ^1.15.0 |
| Images | @nuxt/image | ^2.0.0 |
| Fonts | @nuxt/fonts | ^0.14.0 |
| Database | Neon PostgreSQL + Drizzle ORM (^0.45.2) |
| Auth | DB sessions (`sessions` table) + httpOnly `auth_token` cookie + Google OAuth |
| Payments | @paypal/paypal-server-sdk ^2.3.0 (LIVE) + adapter registry (card via stripe, klarna, inStore — scaffolded, flag-gated) |
| Shipping | FREE FR/BE/NL (own delivery fleet in BE/NL; NRW-Germany planned — needs postal-code zones). Carrier adapter registry (`server/shipping/`, `SHIPPING_CARRIER` env, manual adapter live; Sendcloud/Boxtal-ready). IP geo presets zone, typed address decides |
| CAPTCHA | Cloudflare Turnstile |
| Chat | ChatWidget (rule-based, AI-ready via `ANTHROPIC_API_KEY`) + WhatsApp |
| PWA | Hand-rolled `public/sw.js` + `offline.html` + manifest (installable) |
| Tests | Playwright (e2e + locale matrix + visual + a11y via @axe-core/playwright) |
| CI/CD | GitHub Actions (langs, hex, typecheck, build, bundle budget 13MB gzip, e2e, Lighthouse) |

## Product System (System B)
Each product is a **single color**. No `variants[]` array.

```
Product document:
  ├── name (localizedString) — "V20 Pro — Noir"
  ├── slug — "v20-pro-noir"  (SKU = slug)
  ├── productType — bike | spare_part | accessory | kids_car | other
  ├── brand (reference → brand)
  ├── color (localizedString) + colorHex
  ├── gtin — EAN-13 (auto-assigned from licensed GS1 prefix, check-digit validated in Studio)
  ├── stock (number) — direct on product (PG inventory is live source; Sanity synced)
  ├── images[] — direct on product
  ├── modelFamily (string) — "v20-pro" (links same model, different colors)
  ├── price, compareAtPrice
  ├── specifications { motor, battery, range, ... }
  └── description, warranty, highlights, seo
```

**Adding a new product:** create (per-type templates exist in Studio) → fill → use the
**🎨 Duplicate as Color** document action → change name/slug/color/colorHex/images →
same `modelFamily` auto-links colors on the PDP. Run `assign-gtins.mjs` after adding.

## Project Structure
```
vitesseeco/
├── app.vue                     ← hreflang ×6 + fr-BE/nl-BE + x-default, canonical,
│                                 opensearch/RSS/manifest links, global og/twitter meta
├── nuxt.config.ts              ← Config + JSON-LD (WebSite, Org, LocalBusiness)
├── .github/workflows/ci.yml    ← CI gates (see Tech Stack row)
├── playwright.config.ts        ← projects: e2e (CI) + visual (opt-in)
│
├── pages/ (30 vue files)
│   ├── index.vue               ← Home: hero, category tiles, featured, trust, blog, RecentlyViewed
│   ├── produits/index.vue      ← Listing: filters + chips row, BottomSheet on mobile, URL-synced
│   ├── produits/[slug].vue     ← PDP: buy-box (PriceTag/StockBadge/swatches/qty/trust),
│   │                             other colors via modelFamily, wishlist, JSON-LD with
│   │                             shippingDetails + hasMerchantReturnPolicy
│   ├── guide.vue               ← 3-question interactive bike selector
│   ├── comparatif.vue          ← Comparison grouped by modelFamily (color dots per row)
│   ├── favoris.vue             ← Wishlist (localStorage, noindex)
│   ├── blog/index.vue + [slug] ← Blog + Article JSON-LD + related-product blocks
│   ├── faq.vue                 ← FAQPage JSON-LD
│   ├── a-propos.vue            ← About + stats band + CTA
│   ├── contact.vue             ← WhatsApp card, FAQ band, form + map + Turnstile
│   ├── panier.vue              ← Cart (ClientOnly — cart hydrates from localStorage)
│   ├── commande/index.vue      ← Checkout ①Adresse ②Livraison ③Paiement (ClientOnly),
│   │                             zone-aware shipping, mobile sticky pay bar
│   ├── commande/confirmation   ← Order confirmation
│   ├── connexion/inscription   ← Auth (email + Google OAuth)
│   ├── compte/index.vue        ← Account
│   ├── compte/orders/[orderNumber].vue ← Status timeline + one-click reorder
│   ├── admin/                  ← Admin panel (ADMIN_EMAILS allowlist, noindex, 6 languages)
│   │   ├── index.vue           ← KPIs 24h/7d/30d, funnel, top products, low stock
│   │   ├── commandes/index.vue ← Orders: filters, sort, CSV export, bulk status,
│   │   │                         sticky header, shortcuts (/ N P Esc)
│   │   ├── commandes/[orderNumber].vue ← Processing (status flow, tracking, notes)
│   │   ├── stock/index.vue     ← Inline stock editing (PG → Sanity sync)
│   │   └── messages/index.vue  ← Contact messages (read/unread, notes)
│   ├── p/[slug].vue            ← Landing pages (Sanity)
│   ├── mentions-legales / politique-confidentialite / cgv
│   └── retractation / impressum / batteries ← DE-market compliance (EU withdrawal +
│                                 model form, Impressum, BattG battery take-back)
│
├── components/ (25)
│   ├── AppHeader (search-centered, flat nav, wishlist badge) / AppFooter (legal links ×6)
│   ├── SearchBar (debounced suggest + recent searches)
│   ├── ProductCard / PriceTag / StockBadge / Breadcrumbs / BottomSheet
│   ├── CartDrawer (free-shipping progress) / AppToast+useToast (with Undo actions)
│   ├── ChatWidget + WhatsAppIcon / AnnouncementBar (siteSettings, dismiss-per-message)
│   ├── RecentlyViewed / LanguageSwitcher / LanguageBanner / CookieConsent
│   ├── PayPalButtons / TurnstileWidget / PhoneInput / DeleteAccountModal
│   └── LegalSections (TOC) / AddressBlock / AppSkeleton / EmptyState
│
├── composables/                ← useWishlist (max 50), useRecentlyViewed (max 8),
│                                 useToast, useSanityFetch/Image, useSwipe
├── plugins/                    ← auth.client (fetch user post-mount), pinia-persist,
│                                 sw.client (PWA), detect-language, reveal, vitals
├── stores/                     ← auth.ts (NOT persisted) + cart.ts (persisted:
│                                 items/promo/shipping — restores during hydration,
│                                 hence ClientOnly cart/checkout pages)
│
├── cms/ (Sanity Studio v5.20)
│   ├── schemas/ (20 = 12 documents + 5 singletons + 3 objects)
│   │   ├── product.ts          ← System B + gtin (EAN-13 validation)
│   │   ├── order.ts            ← READ-ONLY mirror (PG-primary; edits go via /admin)
│   │   └── ... category, brand, faq, article, landingPage, contactMessage,
│   │       promoCode, testimonial, shippingMethod, paymentMethod, singletons, objects
│   ├── structure/deskStructure ← لوحة اليوم + 🧹 catalog-quality views (no-GTIN/
│   │                             no-images/missing-DE-NL-ES/no-SEO/no-modelFamily),
│   │                             browse by brand/category
│   ├── plugins/duplicateAsColor← 🎨 new-color document action
│   ├── sanity.config.ts        ← languageFilter, media, colorInput, vision;
│   │                             singleton delete/duplicate protection; product templates
│   └── scripts/ (owner runs with sanity login)
│       ├── assign-gtins.mjs    ← EAN-13 auto-assignment (needs GS1_PREFIX)
│       ├── add-free-shipping-benelux.mjs ← BE+NL free shipping method
│       ├── add-buying-guide-article.mjs  ← 6-locale buying guide + related products
│       └── create-test-product / update-test-stock ← payment live-test helpers
│
├── server/
│   ├── api/auth/               ← login, register, logout, me, profile, delete-account, google
│   ├── api/admin/              ← me, stats, orders (+patch), orders-export CSV, stock,
│   │                             messages, indexnow (requireAdmin on EVERY route)
│   ├── api/addresses/ cart/ orders/ payments/paypal/ shipping/ payment/ places/
│   ├── api/chat/               ← ask (rule-based; Claude when ANTHROPIC_API_KEY set), track-order
│   ├── api/webhooks/paypal.post.ts ← signature verification + audit log
│   ├── api/cron/process-outbox.post.ts ← Outbox worker (CRON_SECRET)
│   ├── payments/               ← Adapter registry: paypal (live), stripe, inStore
│   ├── shipping/               ← CarrierAdapter registry: manual (Sanity zones, FR fallback)
│   ├── database/               ← Drizzle schema + Neon
│   ├── routes/sitemap.xml      ← hreflang sitemap (also api/sitemap.xml)
│   ├── routes/feeds/           ← google-merchant[.xml|-nl|-de|-es] (shared
│   │                             utils/merchantFeed, emits gtin), catalog.csv, blog.xml
│   ├── routes/llms.txt + llms-full.txt ← AI-assistant data source (GEO)
│   ├── middleware/security.ts  ← CSP headers
│   └── utils/                  ← rateLimit, verifyTurnstile, paypal, orderService,
│                                 outbox, sanitySync, audit, priceLock, stock, promo,
│                                 events, validation, adminOrderQuery, merchantFeed
│
├── i18n/locales/               ← 6 files × 526 keys (check:langs enforces sync)
├── scripts/                    ← check-languages, check-hex-colors, check-bundle-size,
│                                 backfill-inventory
├── public/                     ← robots.txt (AI crawlers welcomed, private paths blocked),
│                                 sw.js, offline.html, manifest.webmanifest, opensearch.xml,
│                                 IndexNow key file, favicon, logo, poster, GSC verification
├── tests/                      ← e2e/ (navigation, checkout-flow, regression, a11y,
│                                 full-user, locale-matrix 4 langs × 2 viewports) +
│                                 visual/ (10 pages × 2 viewports, opt-in)
├── docs/                       ← plans + tracker + ADR + runbook + known-issues (all 4 fixed)
├── import-data/                ← Migration scripts (gitignored)
├── competitor-research/        ← Internal study (gitignored)
└── assets-reference/           ← QMWheel catalogue PDF
```

## Sanity CMS Content
| Type | Count |
|------|-------|
| Products | 147 (System B: per color) |
| Brands | 10 |
| Categories | 11 |
| FAQ | 22 |
| Blog Articles | 7 (incl. buying guide × 6 locales) |
| Datasets | production + staging |

## SEO / GEO (AI answer engines)
- Hreflang ×6 + fr-BE/nl-BE + x-default, canonical URLs ✅
- JSON-LD: Product (+ shippingDetails, MerchantReturnPolicy), BreadcrumbList, FAQPage,
  Article, Organization, LocalBusiness, WebSite ✅
- Dynamic sitemap with hreflang ✅ · Google Search Console indexed ✅
- Google Merchant feeds ×4 locales + universal catalog.csv (gtin-aware) ✅
- llms.txt + llms-full.txt (company facts, policies, catalog) ✅
- robots.txt: named AI-crawler groups (GPTBot, Claude, Gemini, Perplexity…) ✅
- IndexNow (admin one-tap submit) + blog RSS + OpenSearch ✅

## Security
- CSP headers (no unsafe-eval) · Rate limiting per IP · Turnstile (contact + checkout)
- bcrypt 12 rounds · httpOnly cookies · Server-side price validation (priceLock)
- `requireAdmin` on every /api/admin route (ADMIN_EMAILS allowlist)
- PayPal webhook signature verification + full audit log
- Sanity Studio: singletons undeletable, order mirror read-only

## Payments & Orders
- **PayPal LIVE** (`ENABLE_PAYPAL`): server SDK, capture-order, verified webhook
- **Card (Stripe)** scaffolded/disabled (`ENABLE_STRIPE`) · **Klarna** scaffolded/disabled
  (`ENABLE_KLARNA` — activate via Stripe payment_method_types OR the direct adapter)
- **In-store** adapter available · checkout handles PSP redirect flows generically
  (`clientPayload.redirectUrl`) · Sanity docs ready via `cms/scripts/add-payment-methods-card-klarna.mjs`
- JSON-LD declares PayPal + card (Visa/Mastercard/CB) + Klarna + cash
  (`paymentAccepted` + rich `acceptedPaymentMethod`, owner decision 2026-07-05 —
  checkout exposure itself stays behind the ENABLE_* flags)
- Orders: **PG-primary** (`ENABLE_PG_PRIMARY_ORDERS`) → Sanity mirror via outbox + cron
- Order processing happens in **/admin** — the Studio order document is read-only

## Pending (owner accounts session — do TOGETHER)
> **Full step-by-step playbook:** [docs/OWNER_ACCOUNTS_PLAYBOOK.md](docs/OWNER_ACCOUNTS_PLAYBOOK.md)
| Service | Purpose | Unlocks |
|---------|---------|---------|
| GS1 France prefix | Legal EAN range (~€100-250/yr) | run assign-gtins → Amazon/bol/Kaufland |
| Resend + DNS | Transactional email | password reset, order emails, back-in-stock, U-S1 |
| Google Merchant Center | Register 4 feeds (fr→FR+BE+LU · nl→NL+BE · de→DE · es→ES) | Shopping |
| Bing Webmaster | Activate IndexNow | Bing/Copilot reach |
| ANTHROPIC_API_KEY | Upgrade ChatWidget to real AI | chatbot |
| Sentry / Trustpilot / Hotjar / GTM+GA4 | Observability, reviews, analytics | — |
| Stripe + Klarna contracts | Card & BNPL at checkout | flip ENABLE_STRIPE / ENABLE_KLARNA + wire adapters |
| Sendcloud or Boxtal | Labels + tracking + Bancontact/iDEAL via PSP | U-X2 |
| ~~sanity login session~~ | ✅ DONE 2026-07-05 (GitHub login): free-shipping BE/NL live, buying-guide article live, card+Klarna docs created, Studio v2 deployed | only assign-gtins left (needs GS1 prefix) |
| Native reviewers NL/DE/ES | Professional translation gate | U-K4 |

## Environment Variables
```
SANITY_PROJECT_ID=2jvnjf0c
SANITY_DATASET=production
SANITY_TOKEN=                  ← For write operations
DATABASE_URL=                  ← Neon PostgreSQL
AUTH_SECRET=                   ← Price-lock signing
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=   (or NUXT_-prefixed)
GOOGLE_PLACES_API_KEY=
TURNSTILE_SITE_KEY= / TURNSTILE_SECRET_KEY=
ADMIN_EMAILS=                  ← Comma-separated admin allowlist (/admin)
PAYPAL_MODE= / PAYPAL_CLIENT_ID= / PAYPAL_CLIENT_SECRET= / PAYPAL_WEBHOOK_ID=
ENABLE_PAYPAL= / ENABLE_STRIPE= / ENABLE_KLARNA= / ENABLE_PG_PRIMARY_ORDERS=
KLARNA_USERNAME= / KLARNA_PASSWORD= / KLARNA_API_BASE=   ← only if direct Klarna route
CRON_SECRET=                   ← Outbox cron auth
SHIPPING_CARRIER=              ← manual (default) | sendcloud | boxtal (when built)
ANTHROPIC_API_KEY=             ← ChatWidget AI mode (pending)
STRIPE_SECRET_KEY= / RESEND_API_KEY=        ← When ready
NUXT_PUBLIC_SITE_URL=https://vitesse-eco.fr
# cms scripts only: GS1_PREFIX= (owner's licensed GS1 France prefix)
```
