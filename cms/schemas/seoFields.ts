import { defineType } from 'sanity'

export default defineType({
  name: 'seoFields',
  title: 'SEO',
  type: 'object',
  fields: [
    { name: 'title', title: 'عنوان SEO', type: 'string', description: 'الحد الأقصى 60 حرف' },
    { name: 'description', title: 'وصف SEO', type: 'text', rows: 3, description: 'الحد الأقصى 160 حرف' },
    { name: 'ogImage', title: 'صورة المشاركة (OG)', type: 'image' },
  ],
})
