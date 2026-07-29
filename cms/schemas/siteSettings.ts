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
    {
      name: 'marketPricing',
      title: '🌍 تسعير الأسواق',
      type: 'array',
      description:
        'نسبة تُطبَّق على السعر العام في كل سوق. الهدف الأول: فرق الضريبة — فرنسا 20٪، ' +
        'ألمانيا 19٪، هولندا وبلجيكا وإسبانيا 21٪. المنتج الذي له سعر خاص في حقل ' +
        '«أسعار خاصة حسب السوق» يتجاهل هذه النسبة.',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'country', title: 'السوق', type: 'string',
              // بلجيكا خارج القائمة عمداً — تقرأ الصفحات الفرنسية وتُسعَّر معها
              // حتى يصبح لها دومين خاص.
              options: {
                list: [
                  { title: '🇳🇱 هولندا', value: 'NL' },
                  { title: '🇩🇪 ألمانيا', value: 'DE' },
                  { title: '🇪🇸 إسبانيا', value: 'ES' },
                  { title: '🇫🇷 فرنسا', value: 'FR' },
                ],
              },
              validation: (Rule) => Rule.required(),
            },
            {
              name: 'adjustmentPercent', title: 'النسبة ٪', type: 'number',
              description: 'مثال: 0.83 لتعويض ضريبة هولندا · -0.83 لألمانيا · 0 لنفس السعر',
              initialValue: 0,
              validation: (Rule) => Rule.required().min(-90).max(900),
            },
            {
              name: 'rounding', title: 'التقريب', type: 'string',
              initialValue: 'charm',
              options: {
                list: [
                  { title: 'بدون تقريب', value: 'exact' },
                  { title: 'أقرب يورو (1250 €)', value: 'euro' },
                  { title: 'أقرب يورو ناقص سنت (1249,99 €)', value: 'charm' },
                ],
              },
            },
          ],
          preview: {
            select: { country: 'country', adjustmentPercent: 'adjustmentPercent' },
            prepare: ({ country, adjustmentPercent }: { country?: string; adjustmentPercent?: number }) => ({
              title: `${country ?? '—'} — ${(adjustmentPercent ?? 0) >= 0 ? '+' : ''}${adjustmentPercent ?? 0}٪`,
            }),
          },
        },
      ],
      validation: (Rule) =>
        Rule.custom((rows) => {
          if (!Array.isArray(rows)) return true
          const seen = new Set<string>()
          for (const row of rows as Array<{ country?: string }>) {
            const country = row?.country
            if (!country) continue
            if (seen.has(country)) return `السوق ${country} مكرَّر — قاعدة واحدة لكل سوق`
            seen.add(country)
          }
          return true
        }),
    },
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
