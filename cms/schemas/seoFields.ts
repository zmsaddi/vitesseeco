import { defineType } from 'sanity'

export default defineType({
  name: 'seoFields',
  title: 'SEO',
  type: 'object',
  fields: [
    {
      name: 'title', title: 'عنوان SEO', type: 'string',
      description: 'الحد الأقصى 60 حرف — يظهر في نتائج Google',
      validation: (Rule) => Rule.max(60).warning('عنوان SEO يجب أن يكون أقل من 60 حرف ليظهر كاملاً في Google'),
    },
    {
      name: 'description', title: 'وصف SEO', type: 'text', rows: 3,
      description: 'الحد الأقصى 160 حرف — يظهر تحت العنوان في Google',
      validation: (Rule) => Rule.max(160).warning('وصف SEO يجب أن يكون أقل من 160 حرف'),
    },
    { name: 'ogImage', title: 'صورة المشاركة (OG)', type: 'image' },
  ],
})
