import { defineType } from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'إعدادات الموقع',
  type: 'document',
  icon: () => '⚙️',
  fields: [
    { name: 'logo', title: '🖼️ الشعار', type: 'image' },
    { name: 'siteName', title: '📝 اسم الموقع', type: 'string', initialValue: 'Vitesse Eco' },
    { name: 'tagline', title: '📝 الشعار النصي', type: 'localizedString' },
    {
      name: 'contactInfo',
      title: '📞 معلومات الاتصال',
      type: 'object',
      fields: [
        {
          name: 'email', title: '📧 البريد الإلكتروني', type: 'string',
          validation: (Rule) => Rule.email(),
        },
        { name: 'phone', title: '📱 الهاتف', type: 'string' },
        { name: 'address', title: '📍 العنوان', type: 'localizedString', description: 'العنوان بكل اللغات' },
        { name: 'hours', title: '🕐 ساعات العمل', type: 'localizedString', description: 'ساعات العمل بكل اللغات' },
      ],
    },
    {
      name: 'socialLinks',
      title: '🌐 شبكات التواصل',
      type: 'object',
      description: 'اتركه فارغاً لإخفاء الأيقونة من الموقع',
      fields: [
        { name: 'instagram', title: '📸 Instagram', type: 'url', validation: (Rule) => Rule.uri({ scheme: ['https'] }) },
        { name: 'facebook', title: '📘 Facebook', type: 'url', validation: (Rule) => Rule.uri({ scheme: ['https'] }) },
        { name: 'tiktok', title: '🎵 TikTok', type: 'url', validation: (Rule) => Rule.uri({ scheme: ['https'] }) },
      ],
    },
    { name: 'footerText', title: '📄 نص أسفل الصفحة', type: 'localizedString' },
  ],
  preview: {
    prepare: () => ({ title: '⚙️ إعدادات الموقع' }),
  },
})
