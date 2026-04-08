import { defineType } from 'sanity'

export default defineType({
  name: 'homePage',
  title: 'الصفحة الرئيسية',
  type: 'document',
  icon: () => '🏠',
  fields: [
    {
      name: 'heroBanner',
      title: 'البانر الرئيسي',
      type: 'object',
      fields: [
        { name: 'title', title: 'العنوان', type: 'localizedString' },
        { name: 'subtitle', title: 'العنوان الفرعي', type: 'localizedString' },
        { name: 'description', title: 'الوصف', type: 'localizedText' },
        { name: 'backgroundImage', title: 'صورة الخلفية', type: 'image' },
        { name: 'ctaText', title: 'نص الزر', type: 'localizedString' },
        { name: 'ctaLink', title: 'رابط الزر', type: 'string' },
      ],
    },
    { name: 'featuredProductsTitle', title: 'عنوان قسم المنتجات', type: 'localizedString' },
    { name: 'featuredProductsSubtitle', title: 'العنوان الفرعي لقسم المنتجات', type: 'localizedString' },
    {
      name: 'values',
      title: 'قيمنا',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'icon', title: 'أيقونة (lucide)', type: 'string', description: 'مثال: zap, leaf, shield-check, headphones' },
          { name: 'title', title: 'العنوان', type: 'localizedString' },
          { name: 'description', title: 'الوصف', type: 'localizedString' },
        ],
      }],
    },
    {
      name: 'testimonials',
      title: 'شهادات العملاء المعروضة',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'testimonial' }] }],
    },
    { name: 'seo', title: 'SEO', type: 'seoFields' },
  ],
  preview: {
    prepare: () => ({ title: 'الصفحة الرئيسية' }),
  },
})
