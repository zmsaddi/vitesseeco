import type { StructureBuilder } from 'sanity/structure'

export const deskStructure = (S: StructureBuilder) =>
  S.list()
    .title('Vitesse Eco')
    .items([
      // الكتالوج
      S.listItem()
        .title('🚲 المنتجات')
        .child(S.documentTypeList('product').title('المنتجات')),
      S.listItem()
        .title('📂 الفئات')
        .child(S.documentTypeList('category').title('الفئات')),
      S.listItem()
        .title('🏷️ العلامات التجارية')
        .child(S.documentTypeList('brand').title('العلامات التجارية')),

      S.divider(),

      // التسويق
      S.listItem()
        .title('🎟️ أكواد الخصم')
        .child(S.documentTypeList('promoCode').title('أكواد الخصم')),
      S.listItem()
        .title('⭐ آراء العملاء')
        .child(S.documentTypeList('testimonial').title('آراء العملاء')),
      S.listItem()
        .title('🚚 طرق الشحن')
        .child(S.documentTypeList('shippingMethod').title('طرق الشحن')),

      S.divider(),

      // الصفحات
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

      S.divider(),

      // الإعدادات
      S.listItem()
        .title('⚙️ إعدادات الموقع')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
    ])
