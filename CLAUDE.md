# Vitesse Eco - Complete Project Documentation
> **START HERE:** This file contains everything needed to build the project from scratch.

## Project Overview
- **Business:** Vitesse Eco - French electric fatbike retailer
- **Domain:** vitesse-eco.com (owned)
- **Contact:** contact@vitesse-eco.fr / www.vitesse-eco.com
- **Working directory:** `D:\vitesseeco`
- **Communication with user:** Arabic only
- **Website languages:** French (primary) + Spanish, Dutch, German
- **GitHub:** https://github.com/zmsaddi (user: zmsaddi, logged in via gh CLI)
- **Vercel:** logged in (account: zakariyas-projects-1c97d142)
- **Sanity:** Project ID: `2jvnjf0c`, Dataset: `production`, Org: `oWtjsSGlJ`
- **Sanity auth token location:** `C:/Users/ZAKARIYA/.config/sanity/config.json` (field: authToken)

## CRITICAL RULES (from previous failed attempt)
1. **DO NOT use Nuxt 4** — IPC connection closed bug on Windows (Node 22+/24+)
2. **Use `ssr: false` locally** — fixes IPC bug. Use `ssr: process.env.VERCEL === '1'` for Vercel SSR
3. **Standard Nuxt 3 structure** — files in ROOT, NOT in `app/` directory. No `srcDir`.
4. **i18n locales path:** files in `i18n/locales/`, config: `langDir: 'locales'` (module adds `i18n/` prefix automatically)
5. **Sanity Studio (`cms/`) must be in `.vercelignore`** — Vercel crashes trying to resolve sanity imports
6. **Add `sanity` as devDependency in root package.json** — `@nuxtjs/sanity` module tries to load `cms/sanity.config.ts`
7. **Test BOTH locally (npm run dev → 200) AND on Vercel before moving to next phase**
8. **Run `npm run check:langs` before every commit**
9. **Node version on this machine:** v24.14.1
10. **Always answer user in Arabic**

## Accounts & Services (all logged in)
| Service | Status | Details |
|---------|--------|---------|
| GitHub | Logged in | `gh auth status` — user: zmsaddi |
| Vercel | Logged in | `npx vercel` works |
| Sanity | Logged in | Token in `C:/Users/ZAKARIYA/.config/sanity/config.json` |
| gh CLI | Installed | `C:/Program Files/GitHub CLI/gh.exe` — add to PATH: `export PATH="/c/Program Files/GitHub CLI:$PATH"` |

## Brand Identity
| Element | Value |
|---------|-------|
| Logo | Golden deer head with gear (assets-reference/logo.png, 277 KB) |
| Poster | Fatbike promo image (assets-reference/poster.jpeg, 151 KB) |
| Primary (dark navy) | #0A1628 |
| Secondary dark | #1E293B |
| Tertiary dark | #334155 |
| Accent green (buttons/highlights) | #4ADE80 |
| Gold (luxury details) | #D4A843 |
| Text primary | #FFFFFF |
| Text secondary | #94A3B8 |
| Body font | Inter (Google) |
| Heading font | Montserrat (Google) |
| Style | Luxury + sporty + eco-friendly, dark theme, mobile-first |

## Tech Stack (to install)
| Layer | Package | Notes |
|-------|---------|-------|
| Framework | nuxt ^3.17.5 | NOT v4 |
| CSS | @nuxtjs/tailwindcss ^6.14.0 | With custom main.css |
| i18n | @nuxtjs/i18n ^10.2.4 | FR/ES/NL/DE + browser auto-detect |
| State | @pinia/nuxt ^0.11.3 | Cart persistence |
| State persist | pinia-plugin-persistedstate ^4.7.1 | localStorage |
| CMS | @nuxtjs/sanity ^2.3.0 | Project 2jvnjf0c |
| Icons | @nuxt/icon ^1.15.0 | v1.x (v2 needs Nuxt 4) |
| Images | @nuxt/image ^2.0.0 | Lazy loading |
| Fonts | @nuxt/fonts ^0.14.0 | Inter + Montserrat |
| Vue | vue ^3.5.31 | |
| Router | vue-router ^4.5.0 | NOT v5 |
| **Dev deps** | | |
| Lang check | franc-min ^6.2.0 | Language detection |
| Sanity | sanity ^5.19.0 | Required for @nuxtjs/sanity to resolve cms/sanity.config.ts |

## nuxt.config.ts Key Settings
```ts
ssr: process.env.VERCEL === '1',        // SSR on Vercel, SPA on Windows
compatibilityDate: '2024-11-01',         // Nuxt 3 mode
// NO srcDir — standard root structure
// NO future.compatibilityVersion: 4
tailwindcss: { cssPath: ['~/assets/css/main.css', { injectPosition: 'first' }] }
i18n: { langDir: 'locales', ... }        // Module adds i18n/ prefix → reads from i18n/locales/
sanity: { projectId: '2jvnjf0c', dataset: 'production' }
```

## Project Structure (standard Nuxt 3 — all in ROOT)
```
D:\vitesseeco\
├── app.vue                    ← NuxtLayout + NuxtPage
├── nuxt.config.ts             ← All modules config
├── tailwind.config.ts         ← Brand colors + fonts
├── package.json               ← Dependencies
├── .env                       ← SANITY_PROJECT_ID=2jvnjf0c
├── .env.example
├── .gitignore
├── .vercelignore              ← cms/ excluded
├── CLAUDE.md                  ← This file
├── PROJECT_PLAN.md            ← Full step-by-step plan
├── scripts/check-languages.mjs
│
├── pages/                     ← All pages in ROOT/pages/
├── components/                ← All components in ROOT/components/
├── layouts/                   ← default.vue
├── composables/
├── stores/
├── middleware/
├── plugins/
├── assets/css/main.css
├── i18n/locales/              ← fr.json, es.json, nl.json, de.json
├── public/                    ← logo.png, poster.jpeg
├── server/api/                ← API routes (later phases)
│
└── cms/                       ← Sanity Studio (SEPARATE, in .vercelignore)
    ├── package.json
    ├── sanity.config.ts
    └── schemas/
```

## Products from Catalogue (QMWHEEL)
All 250W motor, hydraulic brakes:

| # | Model | Tire | Battery | Range | Feature | Colors |
|---|-------|------|---------|-------|---------|--------|
| 1 | V20Mini | 16" | 36V 13AH | 30-40km | Teenagers | Rose gold, Purple, Black, Green, Nardo Grey |
| 2 | V20Pro | 20" | 48V 15.6AH | 40-50km | Bestseller, expandable seats | Black, Nardo gray, Dark gray |
| 3 | V20Limited | 20" | 48V 18.2AH | 50-60km | Long seat | Black, Nardo gray, Dark gray, Brown |
| 4 | S20Pro | 20" | 48V 18.2AH | 50-60km | Unique design seat | Black, Nardo gray, Dark gray |
| 5 | V20Cross | 70/100-17" | 48V 22AH | 60-70km | Offroad + bluetooth speaker | — |
| 6 | Q30 | 20" | 48V 15.6AH | 40-50km | FOLDABLE | Black, Nardo gray, White |
| 7 | D50 | 20" | 48V 18.2AH | 50-60km | Lady friendly, removable saddle | Black, Green, Beige, Dark gray, Purple |
| 8 | C28 | 20" | 48V 15.6AH | 40-50km | Lady friendly | Black, Rose gold, Green, Purple |
| 9 | EB30 | 20" | 15.6AH x2 | 90-100km | Dual battery, basket | — |
| 10 | V20Max | 24" | 48V 18.2AH | 50-60km | Tall riders (175cm+) | — |
| 11 | V20Limited Pro | 20" | 48V 15.6AH x2 | 100km | Double battery, longest range | — |

Owner has additional products from other brands.

## Environment Variables
```
SANITY_PROJECT_ID=2jvnjf0c
SANITY_DATASET=production
SANITY_TOKEN=                  ← For write operations (get from sanity.io manage)
STRIPE_SECRET_KEY=             ← Phase 3
NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
DATABASE_URL=                  ← Phase 2 (Neon Postgres)
RESEND_API_KEY=                ← Phase 3
AUTH_SECRET=                   ← Phase 2
NUXT_PUBLIC_SITE_URL=https://vitesse-eco.com
```

## Reference Files in This Folder
- `assets-reference/` — logo.png, poster.jpeg, catalouge.pdf (22 pages)
- `i18n-reference/` — Complete translation files (146 keys each, all 4 languages, validated)
- `sanity-schemas-reference/` — All 14 Sanity schemas (product, category, brand, promoCode, testimonial, siteSettings, homePage, aboutPage, contactPage, legalPages, localizedString, localizedText, colorVariant, seoFields)
