import { defineType } from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'إعدادات الموقع',
  type: 'document',
  icon: () => '⚙️',
  fields: [
    {
      name: 'assembly',
      title: '🔧 خدمة التركيب',
      type: 'object',
      description:
        'تسليم الدراجة جاهزة للركوب بدل صندوقها. حين تُفعَّل، تُعرض كخيار في الدفع ' +
        'وتظهر في Google كعرض ثانٍ برقم EAN الخاص بها — لذلك لا تفعّلها قبل أن ' +
        'تكون قادراً على تنفيذها فعلاً.',
      options: { collapsible: true, collapsed: true },
      fields: [
        {
          name: 'isOffered',
          title: 'نعرض التركيب',
          type: 'boolean',
          initialValue: false,
        },
        {
          name: 'feeEuros',
          title: 'رسوم التركيب (€)',
          type: 'number',
          validation: (Rule) => Rule.min(0).max(500),
        },
        {
          name: 'label',
          title: 'التسمية المعروضة',
          type: 'localizedString',
          description: 'مثال: «Livrée montée, prête à rouler»',
        },
      ],
    },
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
    {
      name: 'announcement',
      title: '📣 شريط الإعلان (أعلى الموقع)',
      type: 'object',
      description: 'رسالة قصيرة تظهر فوق الهيدر في كل الصفحات — عروض، شحن مجاني، إلخ',
      fields: [
        { name: 'enabled', title: '✅ مفعّل', type: 'boolean', initialValue: false },
        { name: 'text', title: '💬 النص', type: 'localizedString' },
        { name: 'link', title: '🔗 رابط عند النقر (اختياري)', type: 'string', description: 'مثال: /produits?type=bike' },
      ],
    },
  ],
  preview: {
    prepare: () => ({ title: '⚙️ إعدادات الموقع' }),
  },
})
