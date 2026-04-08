import { defineType } from 'sanity'

export default defineType({
  name: 'contactPage',
  title: 'صفحة اتصل بنا',
  type: 'document',
  icon: () => '📞',
  fields: [
    { name: 'title', title: 'العنوان', type: 'localizedString' },
    { name: 'subtitle', title: 'العنوان الفرعي', type: 'localizedString' },
    { name: 'email', title: 'البريد الإلكتروني', type: 'string' },
    { name: 'phone', title: 'الهاتف', type: 'string' },
    { name: 'address', title: 'العنوان البريدي', type: 'text', rows: 3 },
    { name: 'hours', title: 'ساعات العمل', type: 'text', rows: 3 },
    { name: 'mapUrl', title: 'رابط خرائط جوجل (embed)', type: 'url' },
    { name: 'seo', title: 'SEO', type: 'seoFields' },
  ],
  preview: { prepare: () => ({ title: 'صفحة اتصل بنا' }) },
})
