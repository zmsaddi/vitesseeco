# Vitesse Eco - Complete Build Plan & Todo List

> **How to start a new session:**
> Say: `Read D:\vitesseeco\CLAUDE.md and D:\vitesseeco\PROJECT_PLAN.md then build the Vitesse Eco website from scratch following the plan exactly`
>
> **Tracking:** [x] = Done, [ ] = Not done. Start from first unchecked item.
> **Rule:** Run `npm run check:langs` before every git commit
> **Rule:** Test locally (200) AND on Vercel before marking phase complete
> **Rule:** Always answer in Arabic

---

## PHASE 0: Project Foundation
> Goal: Working site on localhost AND Vercel showing our custom pages (not Welcome to Nuxt)

### 0.1 Initialize Project
- [ ] `cd D:\vitesseeco && npx nuxi@latest init . --template minimal --package-manager npm --git-init false`
- [ ] If nuxi is interactive, choose "minimal" template
- [ ] Verify `package.json` exists with nuxt dependency

### 0.2 Fix Nuxt Version (CRITICAL)
- [ ] Edit `package.json`: change nuxt to `"nuxt": "^3.17.5"`
- [ ] Edit `package.json`: change vue-router to `"vue-router": "^4.5.0"` (not v5)
- [ ] Delete `node_modules/` and `package-lock.json`
- [ ] Run `npm install`
- [ ] Verify: `npm ls nuxt` shows 3.x (NOT 4.x)

### 0.3 Install All Dependencies
- [ ] `npm install @nuxtjs/tailwindcss @nuxtjs/i18n @pinia/nuxt pinia-plugin-persistedstate @nuxt/image @nuxtjs/sanity @nuxt/icon@^1.15.0 @nuxt/fonts`
- [ ] `npm install -D franc-min sanity`
- [ ] Verify all packages installed: `npm ls --depth=0`

### 0.4 Configure nuxt.config.ts
- [ ] Set `ssr: process.env.VERCEL === '1'` (CRITICAL: fixes Windows IPC bug)
- [ ] Set `compatibilityDate: '2024-11-01'`
- [ ] NO `srcDir`, NO `future.compatibilityVersion: 4`
- [ ] Register all modules: tailwindcss, i18n, pinia, image, sanity, icon, fonts
- [ ] Configure tailwindcss: `cssPath: ['~/assets/css/main.css', { injectPosition: 'first' }]`
- [ ] Configure i18n: `langDir: 'locales'`, strategy: 'prefix_except_default', defaultLocale: 'fr', detectBrowserLanguage enabled
- [ ] Configure sanity: projectId `2jvnjf0c`, dataset `production`
- [ ] Configure fonts: Inter + Montserrat from Google
- [ ] Configure runtimeConfig with all env var placeholders
- [ ] Configure app.head: title, meta description, theme-color, favicon

### 0.5 Create tailwind.config.ts
- [ ] Brand colors: primary (#0A1628), accent (#4ADE80), gold (#D4A843), dark-secondary (#1E293B)
- [ ] Fonts: Inter (sans), Montserrat (display)

### 0.6 Create assets/css/main.css
- [ ] `@tailwind base; @tailwind components; @tailwind utilities;` (NOT `@import "tailwindcss"`)
- [ ] Custom classes: btn-primary, btn-secondary, btn-outline, card, section-title, container-custom, badge-promo, badge-new, input-field

### 0.7 Create Translation Files
- [ ] Copy `i18n-reference/*.json` to `i18n/locales/`
- [ ] All 4 files: fr.json, es.json, nl.json, de.json (146 keys each)

### 0.8 Create Language Check Script
- [ ] Copy/create `scripts/check-languages.mjs`
- [ ] Add npm script: `"check:langs": "node scripts/check-languages.mjs"`
- [ ] Run and verify: `npm run check:langs` → ALL CHECKS PASSED

### 0.9 Copy Brand Assets
- [ ] Copy `assets-reference/logo.png` → `public/logo.png`
- [ ] Copy `assets-reference/poster.jpeg` → `public/poster.jpeg`

### 0.10 Create Layout
- [ ] `layouts/default.vue` — AppHeader + slot + AppFooter

### 0.11 Create Components
- [ ] `components/AppHeader.vue` — Sticky header: logo, nav (Home, Products, About, Contact), cart icon with badge, user icon, mobile hamburger menu, LanguageSwitcher
- [ ] `components/AppFooter.vue` — Brand info, quick links, legal links, newsletter form, social icons, payment icons, copyright
- [ ] `components/LanguageSwitcher.vue` — Dropdown FR/ES/NL/DE with globe icon, auto-close on click outside
- [ ] `components/CartDrawer.vue` — Slide-out cart panel (empty state for now)

### 0.12 Create Pages
- [ ] `app.vue` — NuxtRouteAnnouncer + NuxtLayout + NuxtPage
- [ ] `pages/index.vue` — Hero section (poster.jpeg background, title, subtitle, CTA), Brand Values (4 cards), Featured Products (3 placeholder cards), CTA section
- [ ] `pages/produits/index.vue` — Sidebar filters (category, tire, price), sort dropdown, grid/list toggle, 11 placeholder product cards with color dots
- [ ] `pages/produits/[slug].vue` — Breadcrumb, image gallery placeholder, specs table, color picker, quantity selector, add-to-cart button, description, related products
- [ ] `pages/a-propos.vue` — Brand story, poster image, 3 value cards (quality, delivery, SAV)
- [ ] `pages/contact.vue` — Contact info cards (email, web, hours), contact form (name, email, subject, message)

### 0.13 Test Locally (MUST PASS)
- [ ] `npm run dev` → no crashes
- [ ] `curl http://localhost:3000/` → 200, contains "Vitesse Eco" (not "Welcome to Nuxt")
- [ ] `curl http://localhost:3000/produits` → 200
- [ ] `curl http://localhost:3000/a-propos` → 200
- [ ] `curl http://localhost:3000/contact` → 200
- [ ] `npm run check:langs` → ALL CHECKS PASSED

### 0.14 Create .gitignore, .env, .vercelignore
- [ ] `.gitignore`: node_modules, .output, .nuxt, .env, .env.*, !.env.example
- [ ] `.env`: SANITY_PROJECT_ID=2jvnjf0c, SANITY_DATASET=production
- [ ] `.env.example`: all env var placeholders
- [ ] `.vercelignore`: `cms/` (CRITICAL: prevents Vercel from loading sanity schemas)

### 0.15 Git + GitHub
- [ ] `git init && git add . && git commit -m "Initial setup"`
- [ ] `export PATH="/c/Program Files/GitHub CLI:$PATH"`
- [ ] `gh repo create vitesseeco --public --source=. --remote=origin --push`

### 0.16 Deploy to Vercel
- [ ] `npx vercel --yes --prod`
- [ ] Wait for build to complete
- [ ] Verify: `curl https://[vercel-url]/` → 200, shows "Vitesse Eco"
- [ ] **If Vercel fails:** check build logs, fix, push, retry

### 0.17 Update Documentation
- [ ] Update CLAUDE.md with actual GitHub URL, Vercel URL
- [ ] Mark all Phase 0 tasks as [x] in this file
- [ ] Commit and push

---

## PHASE 1: Sanity CMS + Catalogue Launch 🚀
> Goal: Real products from Sanity, SEO, live catalogue site

### 1.1 Sanity Studio Setup (in cms/ folder)
- [ ] `mkdir cms && cd cms`
- [ ] Create `cms/package.json` with sanity, @sanity/vision, react, react-dom, styled-components
- [ ] Create `cms/sanity.config.ts` (projectId: 2jvnjf0c)
- [ ] Create `cms/sanity.cli.ts`
- [ ] Copy schemas from `sanity-schemas-reference/` to `cms/schemas/`
- [ ] Create `cms/schemas/index.ts` (register all schemas)
- [ ] Create `cms/structure/deskStructure.ts` (organized navigation)
- [ ] `cd cms && npm install`
- [ ] `cd cms && npx sanity dev` → verify Studio opens in browser

### 1.2 Enter Content in Sanity Studio
- [ ] Create categories: Urban, Off-Road, Pliable, Lady, Long Range
- [ ] Create brand: QMWHEEL
- [ ] Enter all 11 products with full specs, images, colors, prices
- [ ] Enter homepage content (hero, values, testimonials)
- [ ] Enter about page content
- [ ] Enter contact info
- [ ] Enter legal texts (mentions légales, privacy, CGV)

### 1.3 Connect Frontend to Sanity
- [ ] Create `composables/useSanity.ts` — helper to pick localized field
- [ ] Update `pages/index.vue` — fetch from Sanity
- [ ] Update `pages/produits/index.vue` — fetch products, real filters
- [ ] Update `pages/produits/[slug].vue` — fetch product by slug
- [ ] Update `pages/a-propos.vue` — fetch about content
- [ ] Update `pages/contact.vue` — fetch contact info
- [ ] Create `pages/mentions-legales.vue`
- [ ] Create `pages/politique-confidentialite.vue`
- [ ] Create `pages/cgv.vue`

### 1.4 SEO & Performance
- [ ] Meta tags on all pages
- [ ] JSON-LD Product schema on product pages
- [ ] Sitemap
- [ ] Error pages (404, 500)
- [ ] Image optimization with @nuxt/image
- [ ] Responsive testing

### 1.5 Deploy & Verify
- [ ] `npm run check:langs` → PASS
- [ ] Git commit + push
- [ ] Vercel build succeeds
- [ ] All pages work on Vercel with real Sanity data
- [ ] **🎉 CATALOGUE SITE IS LIVE!**

---

## PHASE 2: Shopping Cart & User Accounts 🛒

### 2.1 Cart System
- [ ] Create `stores/cart.ts` (Pinia + localStorage persist)
- [ ] Update CartDrawer with real items
- [ ] Create `components/CartItem.vue`, `CartSummary.vue`
- [ ] Create `pages/panier.vue`
- [ ] Wire add-to-cart on product detail page

### 2.2 Database (Neon Postgres + Drizzle)
- [ ] Create Neon DB at neon.tech
- [ ] `npm install drizzle-orm @neondatabase/serverless && npm install -D drizzle-kit`
- [ ] Create `server/database/schema.ts` (customers, orders, sessions)
- [ ] Run migrations

### 2.3 Authentication
- [ ] `npm install nuxt-auth-utils bcryptjs`
- [ ] Server API: register, login, logout, me
- [ ] Pages: connexion.vue, inscription.vue
- [ ] Account pages: compte/index, profil, commandes
- [ ] Auth middleware

---

## PHASE 3: Checkout & Payments 💳

### 3.1 Promo Codes
- [ ] Server validation endpoint
- [ ] PromoCodeInput component

### 3.2 Checkout Flow
- [ ] Multi-step checkout page (shipping → payment → review)
- [ ] Guest checkout support
- [ ] Server-side cart validation

### 3.3 Stripe Integration
- [ ] `npm install stripe @stripe/stripe-js`
- [ ] PaymentIntent endpoint
- [ ] Stripe webhook (payment success → create order → update stock → send email)
- [ ] Payment Element (cards, Apple Pay, Google Pay)

### 3.4 Email (Resend)
- [ ] `npm install resend`
- [ ] Order confirmation email
- [ ] Contact form email handler

---

## PHASE 4: Stock & Order Management 📦

### 4.1 Stock
- [ ] Stock decrement on purchase
- [ ] Out-of-stock / low stock UI
- [ ] Stock validation in checkout

### 4.2 Order Dashboard
- [ ] Order schema in Sanity (read-only)
- [ ] Order status management
- [ ] Shipping notification emails

### 4.3 Discounts UI
- [ ] Compare-at-price display
- [ ] PROMO/NOUVEAU/SOLDE badges
- [ ] Promo code management in Sanity

---

## PHASE 5: Blog, Translations & CMS Guide 📚

### 5.1 Blog
- [ ] Blog schema in Sanity
- [ ] Blog listing + detail pages

### 5.2 Complete Translations
- [ ] Translate all Sanity content (ES, NL, DE)
- [ ] Test all languages end-to-end

### 5.3 CMS User Guide
- [ ] Write step-by-step guide with screenshots for every Sanity operation

### 5.4 Final QA
- [ ] Cross-browser + mobile testing
- [ ] Lighthouse 90+ all scores
- [ ] GDPR: cookie consent
- [ ] Switch Stripe to live mode
- [ ] **🎉 FULL STORE LIVE!**

---

## PHASE 6 (Future): AI Features 🤖
- [ ] AI chatbot widget
- [ ] Product recommendations
- [ ] Auto-selling assistant

---

## Quick Progress Tracker
| Phase | Description | Status | Done/Total |
|-------|-------------|--------|------------|
| 0 | Foundation + Deploy | ⬜ Not started | 0/~40 |
| 1 | Sanity + Catalogue Launch | ⬜ Not started | 0/~30 |
| 2 | Cart + Accounts | ⬜ Not started | 0/~20 |
| 3 | Checkout + Payments | ⬜ Not started | 0/~15 |
| 4 | Stock + Orders | ⬜ Not started | 0/~15 |
| 5 | Blog + Guide + QA | ⬜ Not started | 0/~15 |
| 6 | AI (future) | ⬜ Not started | 0/~5 |

## Important Rules
- Always answer in Arabic
- Website content in French (main language)
- DO NOT use Nuxt 4 (IPC bug on Windows)
- DO NOT use `srcDir` or `app/` directory
- DO NOT use `@import "tailwindcss"` → use `@tailwind base/components/utilities`
- Use `ssr: process.env.VERCEL === '1'`
- i18n langDir: `'locales'` (module adds `i18n/` prefix)
- `cms/` must be in `.vercelignore`
- `sanity` must be in devDependencies
- Run `npm run check:langs` before every commit
- Test locally AND on Vercel before marking phase complete
