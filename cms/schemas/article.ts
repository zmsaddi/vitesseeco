import { defineType } from 'sanity'

export default defineType({
  name: 'article',
  title: 'مقال',
  type: 'document',
  icon: () => '📰',
  fields: [
    {
      name: 'title', title: '📝 العنوان', type: 'localizedString',
      description: 'عنوان المقال — الفرنسية إلزامية',
      validation: (Rule) => Rule.required().error('عنوان المقال مطلوب'),
    },
    {
      name: 'slug', title: '🔗 الرابط', type: 'slug',
      options: { source: 'title.fr', maxLength: 96 },
      validation: (Rule) => Rule.required().error('رابط المقال مطلوب'),
    },
    {
      name: 'excerpt', title: '📄 مقتطف', type: 'localizedString',
      description: 'ملخص قصير يظهر في قائمة المقالات',
    },
    {
      name: 'content', title: '📃 المحتوى', type: 'localizedText',
      description: 'النص الكامل للمقال',
      validation: (Rule) => Rule.required().error('محتوى المقال مطلوب'),
    },
    {
      name: 'featuredImage', title: '🖼️ الصورة الرئيسية', type: 'image',
      options: { hotspot: true },
      validation: (Rule) => Rule.required().error('الصورة الرئيسية مطلوبة'),
    },
    { name: 'author', title: '✍️ الكاتب', type: 'string' },
    {
      name: 'publishedAt', title: '📅 تاريخ النشر', type: 'datetime',
      initialValue: () => new Date().toISOString(),
    },
    {
      name: 'relatedProducts', title: '🔗 منتجات مرتبطة', type: 'array',
      of: [{ type: 'reference', to: [{ type: 'product' }] }],
      validation: (Rule) => Rule.max(4),
    },
    { name: 'isPublished', title: '✅ منشور', type: 'boolean', initialValue: false },
    { name: 'seo', title: '🔍 SEO', type: 'seoFields' },
  ],
  preview: {
    select: { title: 'title.fr', published: 'isPublished', date: 'publishedAt', media: 'featuredImage' },
    prepare({ title, published, date, media }) {
      return {
        title: `${published ? '✅' : '📝'} ${title || 'مقال'}`,
        subtitle: date ? new Date(date).toLocaleDateString('fr-FR') : 'غير محدد',
        media,
      }
    },
  },
  orderings: [{ title: 'تاريخ النشر', name: 'publishedAt', by: [{ field: 'publishedAt', direction: 'desc' }] }],
})
