# 🤝 خطة الحسابات الخارجية — جلسة مشتركة (المالك + Claude)

> **أُنشئت:** 2026-07-05 — كل ما يمكن بناؤه بدون حسابات خارجية **اكتمل**.
> هذا الملف هو السيناريو الكامل للجلسة المشتركة. ننفذه بالترتيب — كل مرحلة
> تذكر: ماذا تفعل أنت، ماذا أفعل أنا بعدها، الكلفة، المدة، وماذا تفتح.

---

## 📋 المرحلة 0 — جهّز قبل البدء (5 دقائق)

| المطلوب | لماذا |
|---|---|
| معلومات الشركة: SIREN `100 732 247`، TVA `FR43 100 732 247`، عنوان Poitiers | كل التسجيلات |
| **IBAN** حساب الشركة + بطاقة هوية المدير | Stripe/Klarna (KYC) + GS1 |
| دخول **مسجّل النطاق** (DNS لـ vitesse-eco.fr) | سجلات Resend وGMC |
| دخول **Vercel** (لإضافة متغيرات البيئة) | كل المفاتيح |
| حساب Google (نفسه المستخدم في Search Console) | GMC + Bing import |

---

## 1️⃣ ~~جلسة Sanity — تشغيل السكربتات الجاهزة~~ ✅ منجزة 2026-07-05

> نُفّذت بدخول GitHub: الشحن المجاني BE/NL حي في صفحة الدفع، مقال دليل الشراء
> منشور بست لغات، مستندا البطاقة/Klarna جاهزان (مخفيان حتى الأعلام)، وStudio v2
> منشور. **المتبقي الوحيد من هذه المرحلة:** `assign-gtins.mjs` بعد شراء بادئة GS1 (المرحلة 6).

**أنت:**
```
cd d:\vitesseeco\cms
npx sanity login          ← متصفح، حساب Sanity
npx sanity exec scripts/add-free-shipping-benelux.mjs --with-user-token
npx sanity exec scripts/add-buying-guide-article.mjs --with-user-token
npx sanity exec scripts/add-payment-methods-card-klarna.mjs --with-user-token
npx sanity deploy         ← ينشر Studio v2 (لوحة اليوم + جودة الكتالوج)
```
**يفتح فوراً:** الشحن المجاني BE/NL في صفحة الدفع، مقال دليل الشراء ×6 لغات على المدونة، ومستندا البطاقة/Klarna (مخفيان حتى مرحلة 6).
**أنا بعدها:** أتحقق من الموقع الحي (المقال، طريقة الشحن، الخلاصات).

## 2️⃣ Resend — البريد التشغيلي (30 دقيقة، مجاني 100 رسالة/يوم)

**أنت:** resend.com → إنشاء حساب → Add Domain `vitesse-eco.fr` → انسخ سجلات
SPF/DKIM إلى DNS عند مسجّل النطاق → بعد التحقق أنشئ API Key →
ضعه في Vercel: `RESEND_API_KEY`.
**أنا بعدها (أبني فوراً):** إيميل تأكيد الطلب + إيميل الشحن مع التتبع +
تنبيه الأدمن بطلب جديد + **استعادة كلمة المرور** + تنبيه توفر المخزون (U-S1, U-M3, P0-06/07/08).
**هذا أهم حساب — يفتح أكبر قائمة ميزات معلقة.**

## 3️⃣ Google Merchant Center — التسوق المجاني (45 دقيقة، مجاني)

**أنت:** merchants.google.com → إنشاء حساب باسم Vitesse Eco →
التحقق من النطاق (فوري — Search Console موثّق مسبقاً) → Products → Feeds → أضف **4 خلاصات**:

| رابط الخلاصة | اللغة | الدول المستهدفة |
|---|---|---|
| `https://vitesse-eco.fr/feeds/google-merchant.xml` | fr | **FR + BE + LU** |
| `https://vitesse-eco.fr/feeds/google-merchant-nl.xml` | nl | **NL + BE** |
| `https://vitesse-eco.fr/feeds/google-merchant-de.xml` | de | **DE** |
| `https://vitesse-eco.fr/feeds/google-merchant-es.xml` | es | **ES** |

ثم في الإعدادات: الشحن لكل دولة (نفس أسعار الموقع)، سياسة إرجاع 14 يوماً، معلومات الاتصال.
**يفتح:** ظهور المنتجات مجاناً في تبويب Shopping بخمس دول + جاهزية إعلانات لاحقاً.
**أنا بعدها:** أراقب أخطاء الرفض في أول 72 ساعة وأصلح أي عنصر مرفوض.

## 4️⃣ Bing Webmaster + IndexNow (10 دقائق، مجاني)

**أنت:** bing.com/webmasters → **Import from Google Search Console** (زر واحد) →
ثم افتح `vitesse-eco.fr/admin` واضغط زر **IndexNow**.
**يفتح:** Bing + Copilot + DuckDuckGo + Yandex — فهرسة فورية لكل الروابط ×6 لغات.

## 5️⃣ ANTHROPIC_API_KEY — ترقية الشات بوت (5 دقائق، دفع حسب الاستخدام)

**أنت:** console.anthropic.com → API Key → ضعه في Vercel: `ANTHROPIC_API_KEY`.
**يفتح تلقائياً بلا أي كود:** الشات بوت يجيب بذكاء اصطناعي حقيقي بلغة الزائر
(الكود جاهز في `server/api/chat/ask.post.ts` — يكتشف المفتاح ويتحول وحده).

## 6️⃣ GS1 France — أكواد EAN الشرعية (30 دقيقة + معالجة أيام، ≈ 100–250€/سنة)

**أنت:** gs1.fr → Adhésion (فئة حسب رقم الأعمال) → تستلم **بادئة الشركة** (Company Prefix).
**ثم معاً:**
```
cd d:\vitesseeco\cms
set GS1_PREFIX=<بادئتك>
npx sanity exec scripts/assign-gtins.mjs --with-user-token
```
147 منتجاً تحصل على EAN-13 خلال دقيقة، والخلاصات تبثها تلقائياً.
**يفتح:** Amazon / bol.com / Kaufland / Cdiscount (المرحلة 10).
⚠️ **ممنوع** شراء «أكواد رخيصة» من وسطاء eBay — المنصات تتحقق من سجل GS1.

## 7️⃣ Stripe (+ Klarna) — البطاقة والدفع المقسط (ساعة + KYC أيام، عمولات فقط)

**أنت:** stripe.com → حساب شركة (SIREN + IBAN + هوية) → بعد التفعيل:
Settings → Payment methods → فعّل **Cards + Klarna** (+ **Bancontact** لبلجيكا و **iDEAL** لهولندا — بنفس العقد!) →
انسخ المفاتيح إلى Vercel:
`STRIPE_SECRET_KEY` + `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET`
**أنا بعدها:** أكتب منطق PaymentIntent في المحوّل + webhook + أرفع
`ENABLE_STRIPE=true` و`ENABLE_KLARNA=true` → نختبر معاً بمنتج 0.01€
(سكربت `create-test-product.mjs` جاهز) → حذف منتج الاختبار.
**يفتح:** بطاقة + Klarna + Bancontact + iDEAL في صفحة الدفع، وJSON-LD صادق 100%.

## 8️⃣ Sentry + GA4 — المراقبة والقياس (30 دقيقة، مجاني)

**أنت:**
- sentry.io → مشروع Nuxt → انسخ **DSN** → أعطني إياه → أدمج SDK وأضبط أخطاء الخادم والواجهة.
- analytics.google.com → عقار GA4 لـ vitesse-eco.fr → أعطني **Measurement ID** → أدمجه مع احترام CookieConsent الموجود.

## 9️⃣ Trustpilot (15 دقيقة، مجاني أساسي — يعتمد على المرحلة 2)

**أنت:** business.trustpilot.com → طالب بملف vitesse-eco.fr.
**أنا بعدها:** إيميل دعوة تقييم بعد التسليم (عبر Resend) + نجوم aggregateRating في JSON-LD (U-S2).

## 🔟 المنصات والأسواق (بعد المرحلتين 5 و6)

بالترتيب الاستراتيجي المرسوم في MASTER_REBUILD_PLAN §7.6:
1. **TikTok Shop + Meta Commerce** (فوري — يقبلان رابط الخلاصة مباشرة، بلا حاجز EAN): حسابا أعمال ثم لصق `feeds/google-merchant.xml`
2. **bol.com** (NL/BE — يحتاج EAN + عنوان مرتجعات) و **Kaufland.de** (DE — يحتاج EAN + صفحات الامتثال ✅ جاهزة)
3. **Amazon** أخيراً (الأغلى عمولة والأشرس منافسة — بعد إثبات النموذج)
- عند إنشاء حسابات التواصل: ضع الروابط في Studio → إعدادات الموقع → socialLinks، وأخبرني لأضيفها لـ `sameAs` في JSON-LD.

## 1️⃣1️⃣ Sendcloud أو Boxtal — الشحن الآلي (عند نمو الطلبات)

**أنت:** حساب Sendcloud (أنصح به للبنلوكس) أو Boxtal (فرنسي) → API Key.
**أنا بعدها:** أبني محوّل الناقل الكامل (U-X2): ملصقات آلية + تتبع + webhooks
— البنية جاهزة في `server/shipping/`.

## 1️⃣2️⃣ مراجعون أصليون NL/DE/ES (U-K4 — بوابة الترجمة النهائية)

**أنت:** مراجع لغة أم لكل سوق (Fiverr/Upwork/معارف — ساعة أو ساعتان لكل لغة).
**أنا قبلها:** أجهّز حزمة مراجعة لكل لغة (كل النصوص في ملف واحد منظم).

---

## 🗓️ الترتيب المقترح للجلسة الأولى (ساعتان تقريباً)

```
1 Sanity (15د) → 2 Resend/DNS (30د، التحقق يعمل بالخلفية) → 3 GMC (45د)
→ 4 Bing+IndexNow (10د) → 5 مفتاح Anthropic (5د) → إطلاق طلب GS1 (15د)
→ إطلاق KYC لـ Stripe (15د — المعالجة تكتمل بعد أيام)
```
الجلسة الثانية (بعد وصول GS1 وStripe): تشغيل GTIN → ربط Stripe/Klarna →
اختبار 0.01€ → Sentry/GA4 → Trustpilot → TikTok/Meta.

## ✅ ماذا يتحقق بعد اكتمال الخطة

- بريد تشغيلي كامل (تأكيد/شحن/استعادة كلمة مرور/تنبيهات)
- ظهور مجاني في Google Shopping بخمس دول + Bing/Copilot
- شات بوت ذكاء اصطناعي حقيقي
- EAN لكل منتج → أبواب Amazon/bol/Kaufland مفتوحة
- بطاقة + Klarna + Bancontact + iDEAL في الدفع
- مراقبة أخطاء + تحليلات + تقييمات موثقة
- حضور على TikTok/Meta والمنصات المحلية
