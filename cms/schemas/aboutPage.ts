import { defineType } from 'sanity'

export default defineType({
  name: 'aboutPage',
  title: 'صفحة من نحن',
  type: 'document',
  icon: () => 'ℹ️',
  fields: [
    { name: 'title', title: 'العنوان', type: 'localizedString' },
    { name: 'subtitle', title: 'العنوان الفرعي', type: 'localizedString' },
    { name: 'story', title: 'قصتنا', type: 'localizedText' },
    { name: 'image', title: 'الصورة', type: 'image', options: { hotspot: true } },
    {
      name: 'values',
      title: 'التزاماتنا',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'icon', title: 'أيقونة (lucide)', type: 'string' },
          { name: 'title', title: 'العنوان', type: 'localizedString' },
          { name: 'description', title: 'الوصف', type: 'localizedString' },
        ],
      }],
    },
    { name: 'seo', title: 'SEO', type: 'seoFields' },
  ],
  preview: { prepare: () => ({ title: 'صفحة من نحن' }) },
})
