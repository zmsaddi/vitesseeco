# Vitesse Eco — Project Documentation
> **Last updated:** 2026-04-11
> **System:** B (product per color, no variants)

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
8. **Run `npm run check:langs` before every commit**
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
| Database | Neon PostgreSQL + Drizzle ORM |
| Auth | Custom JWT + Google OAuth |
| CAPTCHA | Cloudflare Turnstile |
| Tests | Playwright |
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
├── pages/ (18 pages)
│   ├── index.vue               ← Homepage + trust badges + featured + blog
│   ├── produits/index.vue      ← Products listing (type/brand/color/price filters)
│   ├── produits/[slug].vue     ← Product detail + auto other colors
│   ├── blog/index.vue + [slug] ← Blog with Article JSON-LD
│   ├── faq.vue                 ← FAQ with FAQPage JSON-LD
│   ├── guide.vue               ← Buying guide (filters + sort)
│   ├── comparatif.vue          ← Comparison table
│   ├── panier.vue              ← Cart + free shipping bar
│   ├── commande.vue            ← Checkout + stepper
│   ├── commande/confirmation   ← Order confirmation
│   ├── contact.vue             ← Contact + map + Turnstile
│   ├── connexion/inscription   ← Auth (email + Google OAuth)
│   ├── compte/                 ← Account + orders
│   ├── p/[slug].vue            ← Landing pages (from Sanity)
│   └── legal pages (3)         ← Mentions, Privacy, CGV
│
├── components/ (10)
│   ├── AppHeader.vue           ← Mega-dropdown products nav
│   ├── AppFooter.vue
│   ├── ProductCard.vue         ← Single color + brand + price
│   ├── LanguageSwitcher.vue    ← 5 langs (AR hidden)
│   ├── CartDrawer.vue
│   ├── LegalSections.vue       ← Structured legal with TOC
│   ├── TurnstileWidget.vue
│   ├── CookieConsent.vue
│   └── DeleteAccountModal.vue
│
├── cms/ (Sanity Studio v5.20.0)
│   ├── schemas/ (16 schemas — no colorVariant)
│   │   ├── product.ts          ← System B: color/images/stock direct
│   │   ├── category.ts, brand.ts
│   │   ├── faq.ts, article.ts, landingPage.ts
│   │   ├── order.ts, contactMessage.ts
│   │   ├── promoCode.ts, testimonial.ts
│   │   ├── shippingMethod.ts, paymentMethod.ts
│   │   ├── homePage.ts, aboutPage.ts, contactPage.ts
│   │   ├── legalPages.ts
│   │   └── siteSettings.ts
│   ├── sanity.config.ts        ← Plugins: languageFilter, media, assist, colorInput
│   └── structure/deskStructure ← Products by type + brand filters
│
├── server/
│   ├── api/auth/               ← login, register, google OAuth, me
│   ├── api/cart/               ← check-stock, validate (System B: no variants)
│   ├── api/orders/             ← create (System B: direct product.stock)
│   ├── api/contact.post.ts
│   ├── api/shipping/ + payment/
│   ├── api/places/             ← Google autocomplete
│   ├── routes/sitemap.xml      ← Dynamic sitemap with hreflang
│   ├── middleware/security.ts  ← CSP headers
│   └── utils/                  ← rateLimit, verifyTurnstile
│
├── stores/auth.ts + cart.ts    ← Pinia + localStorage persist
├── i18n/locales/               ← 6 files × 327 keys
├── scripts/check-languages.mjs ← CI language check
├── public/                     ← favicon.ico, logo.webp, poster.webp, robots.txt
├── assets-reference/           ← QMWheel catalogue PDF
├── tests/e2e/                  ← Playwright tests
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

## Pending (needs external accounts)
| Service | Purpose | Cost |
|---------|---------|------|
| GTM + GA4 | Analytics | Free |
| Resend | Order confirmation emails | Free (100/day) |
| Sentry | Error monitoring | Free (5000/month) |
| Stripe | Online payments | Commission only |
| Trustpilot | Customer reviews | Free (basic) |
| Hotjar | Session recording | Free (1000/month) |

## Environment Variables
```
SANITY_PROJECT_ID=2jvnjf0c
SANITY_DATASET=production
SANITY_TOKEN=                  ← For write operations
DATABASE_URL=                  ← Neon PostgreSQL
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_PLACES_API_KEY=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
STRIPE_SECRET_KEY=             ← When ready
RESEND_API_KEY=                ← When ready
NUXT_PUBLIC_SITE_URL=https://vitesse-eco.fr
```
