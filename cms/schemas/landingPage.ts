import { defineType } from 'sanity'

export default defineType({
  name: 'landingPage',
  title: 'صفحة هبوط',
  type: 'document',
  icon: () => '🚀',
  fields: [
    {
      name: 'title', title: '📝 العنوان', type: 'localizedString',
      validation: (Rule) => Rule.required().error('العنوان مطلوب'),
    },
    {
      name: 'slug', title: '🔗 الرابط', type: 'slug',
      options: { source: 'title.fr', maxLength: 96 },
      validation: (Rule) => Rule.required().error('الرابط مطلوب'),
    },
    {
      name: 'sections', title: '📦 الأقسام', type: 'array',
      description: 'أضف أقسام الصفحة بالترتيب — اسحب لإعادة الترتيب',
      of: [
        // Hero Banner
        {
          type: 'object', name: 'heroBanner', title: '🖼️ بانر رئيسي',
          fields: [
            { name: 'title', title: 'العنوان', type: 'localizedString' },
            { name: 'subtitle', title: 'العنوان الفرعي', type: 'localizedString' },
            { name: 'description', title: 'الوصف', type: 'localizedText' },
            { name: 'image', title: 'الصورة', type: 'image', options: { hotspot: true } },
            { name: 'ctaText', title: 'نص الزر', type: 'localizedString' },
            { name: 'ctaLink', title: 'رابط الزر', type: 'string' },
          ],
          preview: {
            select: { title: 'title.fr' },
            prepare({ title }: any) { return { title: `🖼️ ${title || 'بانر'}` } },
          },
        },
        // Featured Products
        {
          type: 'object', name: 'featuredProducts', title: '🚲 منتجات مميزة',
          fields: [
            { name: 'title', title: 'العنوان', type: 'localizedString' },
            { name: 'products', title: 'المنتجات', type: 'array', of: [{ type: 'reference', to: [{ type: 'product' }] }], validation: (Rule: any) => Rule.max(6) },
          ],
          preview: {
            select: { title: 'title.fr' },
            prepare({ title }: any) { return { title: `🚲 ${title || 'منتجات'}` } },
          },
        },
        // Text Block
        {
          type: 'object', name: 'textBlock', title: '📝 كتلة نصية',
          fields: [
            { name: 'title', title: 'العنوان', type: 'localizedString' },
            { name: 'content', title: 'المحتوى', type: 'localizedText' },
          ],
          preview: {
            select: { title: 'title.fr' },
            prepare({ title }: any) { return { title: `📝 ${title || 'نص'}` } },
          },
        },
        // CTA Block
        {
          type: 'object', name: 'ctaBlock', title: '🎯 دعوة للعمل',
          fields: [
            { name: 'title', title: 'العنوان', type: 'localizedString' },
            { name: 'description', title: 'الوصف', type: 'localizedString' },
            { name: 'buttonText', title: 'نص الزر', type: 'localizedString' },
            { name: 'buttonLink', title: 'رابط الزر', type: 'string' },
          ],
          preview: {
            select: { title: 'title.fr' },
            prepare({ title }: any) { return { title: `🎯 ${title || 'CTA'}` } },
          },
        },
        // Testimonials
        {
          type: 'object', name: 'testimonialBlock', title: '⭐ شهادات عملاء',
          fields: [
            { name: 'title', title: 'العنوان', type: 'localizedString' },
            { name: 'testimonials', title: 'الشهادات', type: 'array', of: [{ type: 'reference', to: [{ type: 'testimonial' }] }], validation: (Rule: any) => Rule.max(6) },
          ],
          preview: {
            select: { title: 'title.fr' },
            prepare({ title }: any) { return { title: `⭐ ${title || 'شهادات'}` } },
          },
        },
      ],
    },
    { name: 'isPublished', title: '✅ منشور', type: 'boolean', initialValue: false },
    { name: 'publishedAt', title: '📅 تاريخ النشر', type: 'datetime' },
    { name: 'expiresAt', title: '⏰ تاريخ الانتهاء', type: 'datetime', description: 'اختياري — للحملات المؤقتة' },
    { name: 'seo', title: '🔍 SEO', type: 'seoFields' },
  ],
  preview: {
    select: { title: 'title.fr', published: 'isPublished' },
    prepare({ title, published }: any) {
      return { title: `${published ? '✅' : '📝'} ${title || 'صفحة هبوط'}` }
    },
  },
})
