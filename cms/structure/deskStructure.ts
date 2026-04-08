import type { StructureBuilder } from 'sanity/structure'

export const deskStructure = (S: StructureBuilder) =>
  S.list()
    .title('Vitesse Eco — لوحة التحكم')
    .items([
      // ━━━ الطلبات والعملاء ━━━
      S.listItem()
        .title('🛒 الطلبات')
        .schemaType('order')
        .child(
          S.documentTypeList('order')
            .title('كل الطلبات')
            .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
        ),

      S.divider(),

      // ━━━ الكتالوج ━━━
      S.listItem()
        .title('📦 الكتالوج')
        .child(
          S.list()
            .title('إدارة المنتجات')
            .items([
              S.listItem()
                .title('🚲 كل المنتجات')
                .schemaType('product')
                .child(S.documentTypeList('product').title('المنتجات')),
              S.listItem()
                .title('📂 الفئات')
                .schemaType('category')
                .child(S.documentTypeList('category').title('الفئات')),
              S.listItem()
                .title('🏷️ العلامات التجارية')
                .schemaType('brand')
                .child(S.documentTypeList('brand').title('العلامات التجارية')),
            ])
        ),

      S.divider(),

      // ━━━ الشحن والدفع ━━━
      S.listItem()
        .title('💰 الشحن والدفع')
        .child(
          S.list()
            .title('إدارة الشحن والدفع')
            .items([
              S.listItem()
                .title('🚚 طرق الشحن')
                .schemaType('shippingMethod')
                .child(S.documentTypeList('shippingMethod').title('طرق الشحن')),
              S.listItem()
                .title('💳 طرق الدفع')
                .schemaType('paymentMethod')
                .child(S.documentTypeList('paymentMethod').title('طرق الدفع')),
              S.listItem()
                .title('🎟️ أكواد الخصم')
                .schemaType('promoCode')
                .child(S.documentTypeList('promoCode').title('أكواد الخصم')),
            ])
        ),

      S.divider(),

      // ━━━ المحتوى والصفحات ━━━
      S.listItem()
        .title('📄 محتوى الموقع')
        .child(
          S.list()
            .title('تعديل صفحات الموقع')
            .items([
              S.listItem()
                .title('🏠 الصفحة الرئيسية')
                .child(S.document().schemaType('homePage').documentId('homePage')),
              S.listItem()
                .title('ℹ️ من نحن')
                .child(S.document().schemaType('aboutPage').documentId('aboutPage')),
              S.listItem()
                .title('📞 اتصل بنا')
                .child(S.document().schemaType('contactPage').documentId('contactPage')),
              S.listItem()
                .title('⚖️ الصفحات القانونية')
                .child(S.document().schemaType('legalPages').documentId('legalPages')),
              S.listItem()
                .title('⭐ آراء العملاء')
                .schemaType('testimonial')
                .child(S.documentTypeList('testimonial').title('آراء العملاء')),
            ])
        ),

      S.divider(),

      // ━━━ الإعدادات ━━━
      S.listItem()
        .title('⚙️ إعدادات الموقع')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
    ])
