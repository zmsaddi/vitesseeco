import { defineType } from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'إعدادات الموقع',
  type: 'document',
  icon: () => '⚙️',
  fields: [
    { name: 'logo', title: 'الشعار', type: 'image' },
    { name: 'siteName', title: 'اسم الموقع', type: 'string', initialValue: 'Vitesse Eco' },
    { name: 'tagline', title: 'الشعار النصي', type: 'localizedString' },
    {
      name: 'contactInfo',
      title: 'معلومات الاتصال',
      type: 'object',
      fields: [
        { name: 'email', title: 'البريد الإلكتروني', type: 'string' },
        { name: 'phone', title: 'الهاتف', type: 'string' },
        { name: 'address', title: 'العنوان', type: 'text', rows: 2 },
        { name: 'hours', title: 'ساعات العمل', type: 'text', rows: 2 },
      ],
    },
    {
      name: 'socialLinks',
      title: 'شبكات التواصل الاجتماعي',
      type: 'object',
      fields: [
        { name: 'instagram', title: 'رابط Instagram', type: 'url' },
        { name: 'facebook', title: 'رابط Facebook', type: 'url' },
        { name: 'tiktok', title: 'رابط TikTok', type: 'url' },
      ],
    },
    { name: 'footerText', title: 'نص أسفل الصفحة', type: 'localizedString' },
  ],
  preview: {
    prepare: () => ({ title: 'إعدادات الموقع' }),
  },
})
