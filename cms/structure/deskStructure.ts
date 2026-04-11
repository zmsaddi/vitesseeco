import type { StructureBuilder } from 'sanity/structure'

export const deskStructure = (S: StructureBuilder) =>
  S.list()
    .title('Vitesse Eco')
    .items([

      // ━━━━━━ QUICK ACCESS ━━━━━━
      S.listItem()
        .title('🔴 عاجل')
        .child(
          S.list()
            .title('🔴 يحتاج انتباهك')
            .items([
              S.listItem()
                .title('طلبات جديدة')
                .child(S.documentList().title('طلبات في الانتظار').filter('_type == "order" && status == "pending"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('رسائل غير مقروءة')
                .child(S.documentList().title('رسائل جديدة').filter('_type == "contactMessage" && isRead != true').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('نفد من المخزون')
                .child(S.documentList().title('نفد').filter('_type == "product" && isAvailable == true && count(variants[stock <= 0]) == count(variants)')),
              S.listItem()
                .title('مخزون منخفض')
                .child(S.documentList().title('أقل من 5').filter('_type == "product" && isAvailable == true && count(variants[stock > 0 && stock <= 5]) > 0')),
            ])
        ),

      S.divider(),

      // ━━━━━━ PRODUCTS BY TYPE ━━━━━━
      S.listItem()
        .title('🚲 الدراجات الكهربائية')
        .child(
          S.documentList()
            .title('الدراجات')
            .filter('_type == "product" && productType == "bike"')
            .defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])
        ),

      S.listItem()
        .title('🔧 قطع الغيار')
        .child(
          S.documentList()
            .title('قطع الغيار')
            .filter('_type == "product" && productType == "spare_part"')
            .defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])
        ),

      S.listItem()
        .title('🎒 الإكسسوارات')
        .child(
          S.documentList()
            .title('الإكسسوارات')
            .filter('_type == "product" && productType == "accessory"')
            .defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])
        ),

      S.listItem()
        .title('🧸 الأطفال')
        .child(
          S.documentList()
            .title('منتجات الأطفال')
            .filter('_type == "product" && productType == "kids_car"')
            .defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])
        ),

      S.listItem()
        .title('📦 كل المنتجات')
        .schemaType('product')
        .child(S.documentTypeList('product').title('كل المنتجات')),

      S.divider(),

      // ━━━━━━ ORDERS ━━━━━━
      S.listItem()
        .title('📋 الطلبات')
        .child(
          S.list()
            .title('إدارة الطلبات')
            .items([
              S.listItem().title('⏳ في الانتظار').child(S.documentList().title('في الانتظار').filter('_type == "order" && status == "pending"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('💳 مدفوعة').child(S.documentList().title('مدفوعة').filter('_type == "order" && status == "paid"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('📦 قيد التحضير').child(S.documentList().title('قيد التحضير').filter('_type == "order" && status == "processing"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('🚚 تم الشحن').child(S.documentList().title('تم الشحن').filter('_type == "order" && status == "shipped"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('✅ تم التوصيل').child(S.documentList().title('تم التوصيل').filter('_type == "order" && status == "delivered"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem().title('❌ ملغاة').child(S.documentList().title('ملغاة').filter('_type == "order" && status == "cancelled"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.divider(),
              S.listItem().title('📋 كل الطلبات').child(S.documentTypeList('order').title('كل الطلبات').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
            ])
        ),

      // ━━━━━━ MESSAGES ━━━━━━
      S.listItem()
        .title('✉️ الرسائل')
        .child(S.documentTypeList('contactMessage').title('الرسائل').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),

      S.divider(),

      // ━━━━━━ CONTENT ━━━━━━
      S.listItem()
        .title('📄 المحتوى')
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

      // ━━━━━━ CATALOGUE MANAGEMENT ━━━━━━
      S.listItem()
        .title('🏷️ التصنيفات')
        .child(
          S.list()
            .title('إدارة التصنيفات')
            .items([
              S.listItem().title('📂 الفئات').schemaType('category').child(S.documentTypeList('category').title('الفئات')),
              S.listItem().title('🏷️ العلامات التجارية').schemaType('brand').child(S.documentTypeList('brand').title('العلامات')),
            ])
        ),

      // ━━━━━━ SHIPPING & PAYMENT ━━━━━━
      S.listItem()
        .title('💰 الشحن والدفع')
        .child(
          S.list()
            .title('إدارة الشحن والدفع')
            .items([
              S.listItem().title('🚚 طرق الشحن').schemaType('shippingMethod').child(S.documentTypeList('shippingMethod').title('طرق الشحن')),
              S.listItem().title('💳 طرق الدفع').schemaType('paymentMethod').child(S.documentTypeList('paymentMethod').title('طرق الدفع')),
              S.listItem().title('🎟️ أكواد الخصم').schemaType('promoCode').child(S.documentTypeList('promoCode').title('أكواد الخصم')),
            ])
        ),

      S.divider(),

      // ━━━━━━ SETTINGS ━━━━━━
      S.listItem()
        .title('⚙️ الإعدادات')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
    ])
