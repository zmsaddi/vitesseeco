import { defineType } from 'sanity'

export default defineType({
  name: 'contactPage',
  title: 'صفحة اتصل بنا',
  type: 'document',
  icon: () => '📞',
  fields: [
    { name: 'title', title: '📝 العنوان', type: 'localizedString', description: 'عنوان الصفحة بكل اللغات' },
    { name: 'subtitle', title: '📝 العنوان الفرعي', type: 'localizedString', description: 'النص تحت العنوان' },
    {
      name: 'email', title: '📧 البريد الإلكتروني', type: 'string', description: 'مثال: contact@vitesse-eco.fr',
      validation: (Rule) => Rule.required().email().error('البريد الإلكتروني مطلوب وبصيغة صحيحة'),
    },
    {
      name: 'phone', title: '📱 الهاتف', type: 'string', description: 'مثال: +33 5 XX XX XX XX',
      validation: (Rule) => Rule.required().error('رقم الهاتف مطلوب'),
    },
    { name: 'address', title: '📍 العنوان البريدي', type: 'localizedString', description: 'العنوان الكامل بكل لغة' },
    { name: 'hours', title: '🕐 ساعات العمل', type: 'localizedString', description: 'مثال: الاثنين — السبت: 9 ص — 6 م' },
    { name: 'mapUrl', title: '🗺️ رابط خرائط جوجل', type: 'url', description: 'رابط embed من Google Maps' },
    { name: 'seo', title: '🔍 SEO', type: 'seoFields' },
  ],
  preview: { prepare: () => ({ title: 'صفحة اتصل بنا' }) },
})
