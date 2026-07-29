import type { StructureBuilder } from 'sanity/structure'

export const deskStructure = (S: StructureBuilder) =>
  S.list()
    .title('Vitesse Eco')
    .items([

      // ━━━━━━ TODAY'S DASHBOARD ━━━━━━
      S.listItem()
        .title('⚡ لوحة اليوم')
        .child(
          S.list()
            .title('⚡ يحتاج انتباهك')
            .items([
              S.listItem()
                .title('🔔 طلبات جديدة')
                .child(S.documentList().title('طلبات في الانتظار').filter('_type == "order" && status == "pending"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('💰 مدفوعة (تحتاج تجهيز)')
                .child(S.documentList().title('مدفوعة').filter('_type == "order" && status == "paid"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('💬 رسائل غير مقروءة')
                .child(S.documentList().title('رسائل جديدة').filter('_type == "contactMessage" && isRead != true').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              // قوائم المخزون تعيش في لوحة الإدارة، حيث الأرقام حقيقية.
            ])
        ),

      // ━━━━━━ CATALOG QUALITY ━━━━━━
      // Every list here is a to-do: empty lists = catalog ready for
      // Google Merchant + Amazon/bol/Kaufland + the translation gate.
      S.listItem()
        .title('🧹 جودة الكتالوج')
        .child(
          S.list()
            .title('🧹 نواقص الكتالوج (الهدف: قوائم فارغة)')
            .items([
              S.listItem()
                .title('🌐 بدون GTIN/EAN (يمنع Amazon/bol)')
                .child(S.documentList().title('بدون GTIN').filter('_type == "product" && !defined(gtin)').defaultOrdering([{ field: 'name.fr', direction: 'asc' }])),
              S.listItem()
                .title('🖼️ بدون صور')
                .child(S.documentList().title('بدون صور').filter('_type == "product" && !defined(images[0])')),
              S.listItem()
                .title('🌍 ترجمة ناقصة (DE/NL/ES)')
                .child(S.documentList().title('ترجمة ناقصة').filter('_type == "product" && (!defined(name.de) || name.de == "" || !defined(name.nl) || name.nl == "" || !defined(name.es) || name.es == "")')),
              S.listItem()
                .title('🔍 بدون عنوان SEO')
                .child(S.documentList().title('بدون SEO').filter('_type == "product" && !defined(seo.title)')),
              S.listItem()
                .title('🔗 بدون عائلة موديل (روابط الألوان)')
                .child(S.documentList().title('بدون modelFamily').filter('_type == "product" && !defined(modelFamily)')),
              S.divider(),
              S.listItem()
                .title('🚫 منتجات موقوفة (غير متاحة)')
                .child(S.documentList().title('غير متاحة').filter('_type == "product" && isAvailable != true')),
            ])
        ),

      S.divider(),

      // ━━━━━━ PRODUCTS ━━━━━━
      S.listItem()
        .title('📦 المنتجات')
        .child(
          S.list()
            .title('إدارة المنتجات')
            .items([
              S.listItem().title('📦 كل المنتجات').schemaType('product').child(S.documentTypeList('product').title('كل المنتجات')),
              S.divider(),
              S.listItem().title('🚲 الدراجات').child(S.documentList().title('الدراجات').filter('_type == "product" && productType == "bike"').defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])),
              S.listItem().title('🔧 قطع الغيار').child(S.documentList().title('قطع الغيار').filter('_type == "product" && productType == "spare_part"').defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])),
              S.listItem().title('🎒 الإكسسوارات').child(S.documentList().title('الإكسسوارات').filter('_type == "product" && productType == "accessory"').defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])),
              S.listItem().title('🧸 الأطفال').child(S.documentList().title('منتجات الأطفال').filter('_type == "product" && productType == "kids_car"').defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])),
              S.divider(),
              // Browse by brand / category / model family — mirrors how the
              // team actually thinks about the catalog.
              S.listItem()
                .title('🏷️ حسب العلامة التجارية')
                .child(
                  S.documentTypeList('brand')
                    .title('اختر العلامة')
                    .child((brandId: string) =>
                      S.documentList()
                        .title('منتجات العلامة')
                        .filter('_type == "product" && brand._ref == $brandId')
                        .params({ brandId })
                        .defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])
                    )
                ),
              S.listItem()
                .title('📂 حسب الفئة')
                .child(
                  S.documentTypeList('category')
                    .title('اختر الفئة')
                    .child((categoryId: string) =>
                      S.documentList()
                        .title('منتجات الفئة')
                        .filter('_type == "product" && category._ref == $categoryId')
                        .params({ categoryId })
                        .defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])
                    )
                ),
              S.divider(),
              S.listItem().title('⭐ منتجات مميزة').child(S.documentList().title('مميزة').filter('_type == "product" && isFeatured == true').defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])),
              S.listItem().title('🏷️ تخفيضات').child(S.documentList().title('تخفيضات').filter('_type == "product" && isOnSale == true').defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])),
              S.listItem().title('🕐 آخر المعدَّلة').child(S.documentList().title('آخر تعديل').filter('_type == "product"').defaultOrdering([{ field: '_updatedAt', direction: 'desc' }])),
            ])
        ),

      // ━━━━━━ ORDERS ━━━━━━
      S.listItem()
        .title('🛒 الطلبات')
        .child(
          S.list()
            .title('إدارة الطلبات')
            .items([
              S.listItem().title('⏳ في الانتظار').child(S.documentList().title('في الانتظار').filter('_type == "order" && status == "pending"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('💳 مدفوعة').child(S.documentList().title('مدفوعة').filter('_type == "order" && status == "paid"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('📦 قيد التحضير').child(S.documentList().title('قيد التحضير').filter('_type == "order" && status == "processing"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('🚚 تم الشحن').child(S.documentList().title('تم الشحن').filter('_type == "order" && status == "shipped"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('✅ تم التوصيل').child(S.documentList().title('تم التوصيل').filter('_type == "order" && status == "delivered"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.divider(),
              S.listItem().title('🔄 مرتجعات').child(S.documentList().title('مرتجعات').filter('_type == "order" && status == "returned"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('💸 مستردة').child(S.documentList().title('مستردة').filter('_type == "order" && status == "refunded"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('❌ ملغاة').child(S.documentList().title('ملغاة').filter('_type == "order" && status == "cancelled"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.divider(),
              S.listItem().title('📋 كل الطلبات').child(S.documentTypeList('order').title('كل الطلبات').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
            ])
        ),

      // ━━━━━━ CUSTOMER SERVICE ━━━━━━
      S.listItem()
        .title('💬 خدمة العملاء')
        .child(
          S.list()
            .title('خدمة العملاء')
            .items([
              S.listItem().title('📩 رسائل غير مقروءة').child(S.documentList().title('غير مقروءة').filter('_type == "contactMessage" && isRead != true').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('✉️ كل الرسائل').child(S.documentTypeList('contactMessage').title('كل الرسائل').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
            ])
        ),

      S.divider(),

      // ━━━━━━ CONTENT ━━━━━━
      S.listItem()
        .title('📝 المحتوى')
        .child(
          S.list()
            .title('تعديل المحتوى')
            .items([
              S.listItem().title('🏠 الصفحة الرئيسية').child(S.document().schemaType('homePage').documentId('homePage')),
              S.listItem().title('ℹ️ من نحن').child(S.document().schemaType('aboutPage').documentId('aboutPage')),
              S.listItem().title('📞 اتصل بنا').child(S.document().schemaType('contactPage').documentId('contactPage')),
              S.listItem().title('⚖️ الصفحات القانونية').child(S.document().schemaType('legalPages').documentId('legalPages')),
              S.divider(),
              S.listItem().title('❓ الأسئلة الشائعة').schemaType('faq').child(S.documentTypeList('faq').title('FAQ').defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])),
              S.listItem().title('📰 المقالات').schemaType('article').child(S.documentTypeList('article').title('المقالات').defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])),
              S.listItem().title('🚀 صفحات الهبوط').schemaType('landingPage').child(S.documentTypeList('landingPage').title('صفحات الهبوط')),
              S.listItem().title('⭐ شهادات العملاء').schemaType('testimonial').child(S.documentTypeList('testimonial').title('الشهادات')),
            ])
        ),

      // ━━━━━━ SETTINGS ━━━━━━
      S.listItem()
        .title('⚙️ الإعدادات')
        .child(
          S.list()
            .title('الإعدادات')
            .items([
              S.listItem().title('🌐 إعدادات الموقع').child(S.document().schemaType('siteSettings').documentId('siteSettings')),
              S.divider(),
              S.listItem().title('📂 الفئات').schemaType('category').child(S.documentTypeList('category').title('الفئات')),
              S.listItem().title('🏷️ العلامات التجارية').schemaType('brand').child(S.documentTypeList('brand').title('العلامات')),
              S.divider(),
              S.listItem().title('🚚 طرق الشحن').schemaType('shippingMethod').child(S.documentTypeList('shippingMethod').title('طرق الشحن')),
              S.listItem()
                .title('🗺️ تغطية التوصيل حسب الدولة')
                .child(
                  S.list()
                    .title('أي طرق تخدم كل دولة؟ (البادئات البريدية تظهر في السطر الثاني)')
                    .items(([
                      ['FR', '🇫🇷 فرنسا'],
                      ['BE', '🇧🇪 بلجيكا'],
                      ['NL', '🇳🇱 هولندا'],
                      ['DE', '🇩🇪 ألمانيا'],
                      ['ES', '🇪🇸 إسبانيا'],
                      ['LU', '🇱🇺 لوكسمبورغ'],
                    ] satisfies Array<[string, string]>).map(([code, label]) =>
                      S.listItem()
                        .title(label)
                        .child(
                          S.documentList()
                            .title(`طرق ${label}`)
                            .filter('_type == "shippingMethod" && $z in zones')
                            .params({ z: code })
                            .defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])
                        )
                    ))
                ),
              S.listItem().title('💳 طرق الدفع').schemaType('paymentMethod').child(S.documentTypeList('paymentMethod').title('طرق الدفع')),
              S.listItem().title('🎟️ أكواد الخصم').schemaType('promoCode').child(S.documentTypeList('promoCode').title('أكواد الخصم')),
            ])
        ),
    ])
