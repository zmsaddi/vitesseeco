import type { StructureBuilder } from 'sanity/structure'

export const deskStructure = (S: StructureBuilder) =>
  S.list()
    .title('🏪 Vitesse Eco')
    .items([
      // ━━━━━━ DASHBOARD ━━━━━━
      S.listItem()
        .title('📊 لوحة القيادة')
        .child(
          S.list()
            .title('📊 لوحة القيادة')
            .items([
              S.listItem()
                .title('🔴 طلبات جديدة')
                .child(S.documentList().title('في الانتظار').filter('_type == "order" && status == "pending"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('💳 مدفوعة')
                .child(S.documentList().title('مدفوعة').filter('_type == "order" && status == "paid"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('📦 قيد التحضير')
                .child(S.documentList().title('قيد التحضير').filter('_type == "order" && status == "processing"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('🚚 تم الشحن')
                .child(S.documentList().title('تم الشحن').filter('_type == "order" && status == "shipped"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('✅ تم التوصيل')
                .child(S.documentList().title('تم التوصيل').filter('_type == "order" && status == "delivered"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('❌ ملغاة')
                .child(S.documentList().title('ملغاة').filter('_type == "order" && status == "cancelled"').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.divider(),
              S.listItem()
                .title('📋 كل الطلبات')
                .child(S.documentTypeList('order').title('كل الطلبات').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.divider(),
              S.listItem()
                .title('🔴 رسائل جديدة')
                .child(S.documentList().title('غير مقروءة').filter('_type == "contactMessage" && isRead != true').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
              S.listItem()
                .title('✉️ كل الرسائل')
                .child(S.documentTypeList('contactMessage').title('الرسائل').defaultOrdering([{ field: 'createdAt', direction: 'desc' }])),
            ])
        ),

      S.divider(),

      // ━━━━━━ CATALOGUE ━━━━━━
      S.listItem()
        .title('🚲 الكتالوج')
        .child(
          S.list()
            .title('🚲 إدارة المنتجات')
            .items([
              S.listItem()
                .title('📦 كل المنتجات')
                .schemaType('product')
                .child(S.documentTypeList('product').title('المنتجات')),
              S.divider(),
              S.listItem()
                .title('🔴 نفد من المخزون')
                .child(S.documentList().title('نفد').filter('_type == "product" && isAvailable == true && count(variants[stock <= 0]) == count(variants)')),
              S.listItem()
                .title('🟡 مخزون منخفض (أقل من 5)')
                .child(S.documentList().title('منخفض').filter('_type == "product" && isAvailable == true && count(variants[stock > 0 && stock <= 5]) > 0')),
              S.listItem()
                .title('🟢 متوفر')
                .child(S.documentList().title('متوفر').filter('_type == "product" && isAvailable == true && count(variants[stock > 5]) > 0')),
              S.listItem()
                .title('🚫 غير معروض')
                .child(S.documentList().title('مخفي').filter('_type == "product" && isAvailable == false')),
              S.divider(),
              S.listItem()
                .title('📂 الفئات')
                .schemaType('category')
                .child(S.documentTypeList('category').title('الفئات')),
              S.listItem()
                .title('🏷️ العلامات التجارية')
                .schemaType('brand')
                .child(S.documentTypeList('brand').title('العلامات التجارية')),
              S.divider(),
              S.listItem()
                .title('🗂️ منتجات حسب الفئة')
                .child(
                  S.documentTypeList('category')
                    .title('اختر فئة')
                    .child((categoryId) =>
                      S.documentList()
                        .title('المنتجات')
                        .filter('_type == "product" && category._ref == $categoryId')
                        .params({ categoryId })
                    )
                ),
            ])
        ),

      S.divider(),

      // ━━━━━━ SHIPPING & PAYMENT ━━━━━━
      S.listItem()
        .title('💰 الشحن والدفع')
        .child(
          S.list()
            .title('💰 إدارة الشحن والدفع')
            .items([
              S.listItem()
                .title('🚚 شحن نشط')
                .child(S.documentList().title('نشط').filter('_type == "shippingMethod" && isActive == true')),
              S.listItem()
                .title('⏸️ شحن معطّل')
                .child(S.documentList().title('معطّل').filter('_type == "shippingMethod" && isActive == false')),
              S.divider(),
              S.listItem()
                .title('💳 دفع نشط')
                .child(S.documentList().title('نشط').filter('_type == "paymentMethod" && isActive == true')),
              S.listItem()
                .title('⏸️ دفع معطّل')
                .child(S.documentList().title('معطّل').filter('_type == "paymentMethod" && isActive == false')),
              S.divider(),
              S.listItem()
                .title('🎟️ أكواد الخصم')
                .schemaType('promoCode')
                .child(S.documentTypeList('promoCode').title('أكواد الخصم')),
            ])
        ),

      S.divider(),

      // ━━━━━━ CONTENT ━━━━━━
      S.listItem()
        .title('📄 محتوى الموقع')
        .child(
          S.list()
            .title('📄 تعديل المحتوى')
            .items([
              S.listItem().title('🏠 الصفحة الرئيسية').child(S.document().schemaType('homePage').documentId('homePage')),
              S.listItem().title('ℹ️ من نحن').child(S.document().schemaType('aboutPage').documentId('aboutPage')),
              S.listItem().title('📞 اتصل بنا').child(S.document().schemaType('contactPage').documentId('contactPage')),
              S.listItem().title('⚖️ القانونية').child(S.document().schemaType('legalPages').documentId('legalPages')),
              S.divider(),
              S.listItem()
                .title('❓ الأسئلة الشائعة')
                .schemaType('faq')
                .child(S.documentTypeList('faq').title('الأسئلة الشائعة').defaultOrdering([{ field: 'sortOrder', direction: 'asc' }])),
              S.listItem()
                .title('📰 المقالات')
                .schemaType('article')
                .child(S.documentTypeList('article').title('المقالات').defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])),
            ])
        ),

      S.divider(),

      // ━━━━━━ SETTINGS ━━━━━━
      S.listItem()
        .title('⚙️ الإعدادات')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
    ])
