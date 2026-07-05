# Vitesse Eco — Project Documentation
> **Last updated:** 2026-07-05
> **System:** B (product per color, no variants)
> **Active plan:** [docs/EXPERIENCE_RECONSTRUCTION_PLAN.md](docs/EXPERIENCE_RECONSTRUCTION_PLAN.md) (customer + admin experience, 6–8 weeks)
> **Security backlog:** [docs/PRODUCTION_UPGRADE_PLAN.md](docs/PRODUCTION_UPGRADE_PLAN.md) (remains authoritative for SEC-*/OBS-* items)

## Project Overview
| Field | Value |
|-------|-------|
| **Business** | Vitesse Eco — Electric mobility retailer (bikes, parts, accessories, kids) |
| **Domain** | vitesse-eco.fr |
| **Contact** | contact@vitesse-eco.fr / +33 7 45 83 00 49 |
| **Address** | 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France |
| **Company** | VITESSE ECO SAS — SIREN 100 732 247 |
| **Working directory** | `D:\vitesseeco` |
| **Communication** | Arabic only |
| **Website languages** | French (primary) + English, Spanish, Dutch, German, Arabic |
| **GitHub** | github.com/zmsaddi/vitesseeco |
| **Vercel** | vitesseeco.vercel.app |
| **Sanity** | Project: `2jvnjf0c`, Dataset: `production` + `staging` |
| **Node.js** | v24.14.1 |

## Critical Rules
1. **DO NOT use Nuxt 4** — IPC bug on Windows
2. **`ssr: process.env.VERCEL === '1'`** — SSR on Vercel, SPA locally
3. **Standard Nuxt 3 structure** — files in ROOT, no `app/` directory
4. **i18n:** `langDir: 'locales'`, `baseUrl: 'https://vitesse-eco.fr'`
5. **Sanity Studio** in `cms/` — excluded from Vercel via `.vercelignore`
6. **`sanity`** as devDependency in root — required by `@nuxtjs/sanity`
7. **Always answer user in Arabic**
8. **Run `npm run check:langs` (+ `npm run check:hex`) before every commit**
9. **System B:** Each color = separate product. No `variants[]`. Products linked via `modelFamily`

## Tech Stack
| Layer | Package | Version |
|-------|---------|---------|
| Framework | nuxt | ^3.17.5 |
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
| Payments | @paypal/paypal-server-sdk ^2.3.0 (LIVE) + adapter registry (stripe/inStore scaffolded) |
| CAPTCHA | Cloudflare Turnstile |
| Tests | Playwright (e2e + visual + a11y via @axe-core/playwright) |
| CI/CD | GitHub Actions |

## Product System (System B)
Each product is a **single color**. No `variants[]` array.

```
Product document:
  ├── name (localizedString) — "V20 Pro — Noir"
  ├── slug — "v20-pro-noir"
  ├── productType — bike | spare_part | accessory | kids_car | other
  ├── brand (reference → brand)
  ├── color (localizedString) — "Noir" / "Black" / etc.
  ├── colorHex — "#000000"
  ├── stock (number) — direct on product
  ├── images[] (array of image) — direct on product
  ├── modelFamily (string) — "v20-pro" (links same model different colors)
  ├── price, compareAtPrice
  ├── specifications { motor, battery, range, ... }
  └── description, warranty, highlights, seo
```

**Adding a new product:**
1. Create product → fill details
2. Duplicate → change name, slug, color, colorHex, images
3. Keep same `modelFamily` → auto-linked as "other colors"
4. SKU = slug (auto)

**"Other colors" auto-display:**
- Product detail page queries: `*[modelFamily == $family && slug != $current]`
- Shows color dots linking to sibling products

## Project Structure
```
vitesseeco/
├── app.vue                     ← Root + hreflang + canonical
├── nuxt.config.ts              ← Config + JSON-LD (WebSite, Org, LocalBusiness)
├── .github/workflows/ci.yml    ← CI: build + typecheck + e2e
├── playwright.config.ts
│
├── pages/ (20 pages)
│   ├── index.vue               ← Homepage + trust badges + featured + blog
│   ├── produits/index.vue      ← Products listing (type/brand/color/price filters)
│   ├── produits/[slug].vue     ← Product detail + auto other colors
│   ├── blog/index.vue + [slug] ← Blog with Article JSON-LD
│   ├── faq.vue                 ← FAQ with FAQPage JSON-LD
│   ├── comparatif.vue          ← Comparison table
│   ├── a-propos.vue            ← About page
│   ├── panier.vue              ← Cart + free shipping bar
│   ├── commande/index.vue      ← Checkout + stepper
│   ├── commande/confirmation   ← Order confirmation
│   ├── contact.vue             ← Contact + map + Turnstile
│   ├── connexion/inscription   ← Auth (email + Google OAuth)
│   ├── compte/index.vue        ← Account
│   ├── compte/orders/[orderNumber].vue ← Order detail
│   ├── admin/                  ← Admin panel (FR-only, ADMIN_EMAILS allowlist, noindex)
│   │   ├── index.vue           ← Dashboard: KPIs 24h/7d/30d, funnel, top products, low stock
│   │   ├── commandes/index.vue ← Live orders list from PG (search/filter/pagination)
│   │   ├── commandes/[orderNumber].vue ← Order processing (status flow, tracking, notes)
│   │   ├── stock/index.vue     ← Inline stock editing (PG inventory → Sanity sync)
│   │   └── messages/index.vue  ← Contact messages (read/unread, internal notes)
│   ├── p/[slug].vue            ← Landing pages (from Sanity)
│   └── legal pages (3)         ← Mentions, Privacy, CGV
│
├── components/ (18)
│   ├── AppHeader.vue           ← Mega-dropdown products nav
│   ├── AppFooter.vue
│   ├── ProductCard.vue         ← Single color + brand + price
│   ├── LanguageSwitcher.vue    ← 5 langs (AR hidden)
│   ├── LanguageBanner.vue
│   ├── CartDrawer.vue
│   ├── PayPalButtons.vue       ← PayPal checkout buttons
│   ├── LegalSections.vue       ← Structured legal with TOC
│   ├── TurnstileWidget.vue
│   ├── CookieConsent.vue
│   ├── DeleteAccountModal.vue
│   ├── AddressAutocomplete.vue ← Google Places
│   ├── PhoneInput.vue
│   └── AppButton / AppInput / AppSkeleton / AppToast / EmptyState (UI kit)
│
├── cms/ (Sanity Studio v5.20.0)
│   ├── schemas/ (20 = 12 documents + 5 singletons + 3 objects — no colorVariant)
│   │   ├── product.ts          ← System B: color/images/stock direct
│   │   ├── category.ts, brand.ts
│   │   ├── faq.ts, article.ts, landingPage.ts
│   │   ├── order.ts, contactMessage.ts
│   │   ├── promoCode.ts, testimonial.ts
│   │   ├── shippingMethod.ts, paymentMethod.ts
│   │   ├── homePage.ts, aboutPage.ts, contactPage.ts
│   │   ├── legalPages.ts, siteSettings.ts
│   │   └── localizedString.ts, localizedText.ts, seoFields.ts (objects)
│   ├── scripts/                ← Test-data helpers (create-test-product, update-test-stock)
│   ├── sanity.config.ts        ← Plugins: languageFilter, media, assist, colorInput
│   └── structure/deskStructure ← Products by type + brand filters
│
├── server/
│   ├── api/auth/               ← login, register, logout, me, profile, delete-account, google OAuth
│   ├── api/admin/              ← me, stats, orders, stock, messages (requireAdmin on every route)
│   ├── api/addresses/          ← saved addresses CRUD
│   ├── api/cart/               ← check-stock, validate (System B: no variants)
│   ├── api/orders/             ← create, my-orders, [orderNumber] (System B: direct product.stock)
│   ├── api/payments/paypal/    ← capture-order
│   ├── api/webhooks/paypal.post.ts ← PayPal webhook (audit-logged)
│   ├── api/cron/process-outbox.post.ts ← Outbox worker (CRON_SECRET)
│   ├── api/contact.post.ts
│   ├── api/shipping/ + payment/ ← methods
│   ├── api/places/             ← Google autocomplete + details
│   ├── api/events/vitals.post.ts
│   ├── payments/               ← Adapter registry: paypal, stripe, inStore (ENABLE_* flags)
│   ├── database/               ← Drizzle schema + db (Neon)
│   ├── routes/sitemap.xml      ← Dynamic sitemap with hreflang (+ api/sitemap.xml)
│   ├── middleware/security.ts  ← CSP headers
│   └── utils/                  ← rateLimit, verifyTurnstile, paypal, orderService, outbox,
│                                 sanitySync, audit, priceLock, stock, promo, events, validation
│
├── stores/auth.ts + cart.ts    ← Pinia + localStorage persist
├── i18n/locales/               ← 6 files × 353 keys
├── scripts/                    ← check-languages, check-hex-colors, check-bundle-size, backfill-inventory
├── docs/                       ← PRODUCTION_UPGRADE_PLAN, known-issues-post-pg-primary
├── public/                     ← favicon.ico, logo.webp, poster.webp, robots.txt
├── assets-reference/           ← QMWheel catalogue PDF
├── tests/                      ← Playwright: e2e/ (navigation, checkout-flow, regression, a11y, full-user) + visual/
├── import-data/                ← Migration scripts (gitignored)
└── competitor-research/        ← Internal study (gitignored)
```

## Sanity CMS Content
| Type | Count |
|------|-------|
| Products | 147 (System B: per color) |
| Brands | 10 |
| Categories | 11 |
| FAQ | 22 |
| Blog Articles | 6 |
| Datasets | production + staging |

## SEO
- Hreflang (6 langs) in HTML head ✅
- Canonical URLs ✅
- Product JSON-LD + BreadcrumbList ✅
- FAQPage JSON-LD ✅
- Article JSON-LD ✅
- Organization + LocalBusiness JSON-LD ✅
- WebSite JSON-LD ✅
- Dynamic sitemap with hreflang ✅
- Google Search Console indexed ✅

## Security
- CSP headers (no unsafe-eval)
- Rate limiting per IP
- Turnstile CAPTCHA (contact + checkout)
- bcrypt 12 rounds
- httpOnly cookies
- Server-side price validation
- 35 Sanity validation rules

## Payments
- **PayPal — LIVE** (`ENABLE_PAYPAL`): server SDK, capture-order endpoint, webhook with signature verification + audit log
- **Stripe — scaffolded, disabled** (`ENABLE_STRIPE`): adapter exists in `server/payments/adapters/stripe.ts`
- **In-store** adapter available
- Orders: PG-primary flow behind `ENABLE_PG_PRIMARY_ORDERS`, Sanity sync via outbox + cron worker

## Pending (needs external accounts)
| Service | Purpose | Cost |
|---------|---------|------|
| GTM + GA4 | Analytics | Free |
| Resend | Order confirmation emails | Free (100/day) |
| Sentry | Error monitoring | Free (5000/month) |
| Stripe | Card payments (adapter ready, disabled) | Commission only |
| Trustpilot | Customer reviews | Free (basic) |
| Hotjar | Session recording | Free (1000/month) |

## Environment Variables
```
SANITY_PROJECT_ID=2jvnjf0c
SANITY_DATASET=production
SANITY_TOKEN=                  ← For write operations
DATABASE_URL=                  ← Neon PostgreSQL
AUTH_SECRET=                   ← Price-lock signing
GOOGLE_CLIENT_ID=              ← (or NUXT_GOOGLE_CLIENT_ID)
GOOGLE_CLIENT_SECRET=          ← (or NUXT_GOOGLE_CLIENT_SECRET)
GOOGLE_PLACES_API_KEY=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
ADMIN_EMAILS=                  ← Comma-separated admin allowlist (/admin panel)
PAYPAL_MODE=                   ← live | sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
ENABLE_PAYPAL=                 ← Feature flag
ENABLE_STRIPE=                 ← Feature flag (off)
ENABLE_PG_PRIMARY_ORDERS=      ← Feature flag
CRON_SECRET=                   ← Outbox cron auth
STRIPE_SECRET_KEY=             ← When ready
RESEND_API_KEY=                ← When ready
NUXT_PUBLIC_SITE_URL=https://vitesse-eco.fr
```
