import { defineType } from 'sanity'

export default defineType({
  name: 'category',
  title: 'فئة',
  type: 'document',
  icon: () => '📂',
  fields: [
    { name: 'name', title: 'الاسم', type: 'localizedString' },
    { name: 'slug', title: 'رابط URL', type: 'slug', options: { source: 'name.fr', maxLength: 96 } },
    { name: 'description', title: 'الوصف', type: 'localizedText' },
    { name: 'image', title: 'الصورة', type: 'image', options: { hotspot: true } },
    { name: 'sortOrder', title: 'ترتيب العرض', type: 'number', initialValue: 0 },
  ],
  preview: {
    select: { title: 'name.fr', media: 'image' },
  },
})
