# The joint session — Merchant Center, Search Console, Business Profile

> Thirty minutes, three Google properties, zero improvisation. Everything the
> assistant could do alone is already done; every step below needs the owner's
> Google account (zmsaddi@gmail.com) and nothing else.
> Written 2026-08-05. If a Google screen disagrees with this document, the
> document is the bug — say so during the session.

## Before the call — already true, verify nothing

| Ready | Where |
|---|---|
| 4 Merchant feeds (FR/NL/DE/ES), prices matching pages | `https://vitesse-eco.fr/feeds/google-merchant.xml` (+`-nl`, `-de`, `-es`) |
| Site verification file | `https://vitesse-eco.fr/googled882d9ab4d43b35a.html` |
| Sitemap | `https://vitesse-eco.fr/sitemap.xml` |
| Robots welcoming 20 AI crawlers + Googlebot | `https://vitesse-eco.fr/robots.txt` |
| Structured data (Organization, LocalBusiness, Product, Article) | in every page |
| Google Customer Reviews opt-in | live on the confirmation page, merchant_id 5834408240 |

## 1. Merchant Center — merchants.google.com (~15 min)

1. Create the account: business name **Vitesse Eco**, country **France**, time zone Paris.
2. **Business information → Website**: enter `https://vitesse-eco.fr` → verify (the
   HTML file above is already served) → **claim**.
3. **Products → Feeds → Add primary feed**: country France, language French,
   name `vitesse-eco-fr`, "scheduled fetch", URL
   `https://vitesse-eco.fr/feeds/google-merchant.xml`, daily.
4. Repeat for NL / DE / ES feeds with their URLs and languages.
5. **Shipping settings**: France free (own fleet, Vienne); free zones BE, NL, LU,
   DE-west exactly as the site states. What the feed's crawled pages say and
   what Merchant settings say MUST agree — mismatches suspend accounts.
6. **Marketing → Free listings**: confirm enabled.
7. Skip Google Ads linking today unless the budget decision is made.

Watch for: "Misrepresentation" review takes days — normal for a new account.
Item disapprovals for missing GTIN are expected until GS1 (open decision).

## 2. Search Console — search.google.com/search-console (~5 min)

1. Add property → **Domain** → `vitesse-eco.fr` (DNS TXT at OVH) — or URL-prefix
   with the existing HTML file if DNS is inconvenient today.
2. Submit sitemap: `https://vitesse-eco.fr/sitemap.xml`.
3. Nothing else. Impressions data starts flowing in ~48 h.

## 3. Business Profile — business.google.com (~10 min)

1. Create profile: **Vitesse Eco**, category **Bicycle shop** (and
   "Electric bicycle store" as secondary if offered), address
   32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.
2. Verification: whatever Google offers (postcard/phone/video).
3. Hours, phone +33 7 45 83 00 49, website link, a few shop photos from the
   owner's phone.

## Open decisions the session does not solve

- **Stock**: 112 of 142 products carry zero stock and are invisible in
  Shopping. Real counts in the Studio fix this in an hour — no code involved.
- **GS1 France** (~€250/yr): GTINs materially raise Shopping ranking;
  `cms/scripts/assign-gtins.mjs` is ready the day the prefix exists.
- **Ads budget**: Performance Max trial at ~€15/day once Merchant is approved.
