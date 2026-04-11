import { defineType } from 'sanity'

export default defineType({
  name: 'shippingMethod',
  title: 'طريقة الشحن',
  type: 'document',
  icon: () => '🚚',
  fields: [
    { name: 'name', title: '📝 الاسم', type: 'localizedString' },
    {
      name: 'code', title: '🔖 رمز فريد', type: 'string', description: 'مثال: standard, express, pickup',
      validation: (Rule) => Rule.required().error('الرمز مطلوب'),
    },
    { name: 'description', title: '📄 الوصف', type: 'localizedString' },
    { name: 'estimatedDays', title: '📅 المدة المقدرة', type: 'string', description: 'مثال: 5-7 أيام' },
    {
      name: 'price', title: '💶 السعر (€)', type: 'number', description: '0 = مجاني',
      validation: (Rule) => Rule.required().min(0).error('السعر مطلوب'),
    },
    { name: 'freeAbove', title: '🆓 مجاني فوق (€)', type: 'number', description: 'شحن مجاني إذا تجاوز المبلغ. اتركه فارغاً إذا دائماً مجاني أو دائماً مدفوع' },
    {
      name: 'zones',
      title: '🌍 مناطق الشحن',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: '🇫🇷 فرنسا', value: 'FR' },
          { title: '🇧🇪 بلجيكا', value: 'BE' },
          { title: '🇱🇺 لوكسمبورغ', value: 'LU' },
          { title: '🇩🇪 ألمانيا', value: 'DE' },
          { title: '🇳🇱 هولندا', value: 'NL' },
          { title: '🇪🇸 إسبانيا', value: 'ES' },
        ],
      },
      validation: (Rule) => Rule.required().min(1).error('اختر منطقة واحدة على الأقل'),
    },
    { name: 'isActive', title: '✅ نشط', type: 'boolean', initialValue: true, description: 'أوقفه لإخفاء طريقة الشحن' },
    { name: 'sortOrder', title: '🔢 الترتيب', type: 'number', initialValue: 0 },

    // Carrier integration (future)
    {
      name: 'carrier',
      title: '🏢 شركة الشحن',
      type: 'object',
      description: 'ربط مع شركة شحن — سيُفعّل لاحقاً',
      fields: [
        {
          name: 'provider',
          title: 'الشركة',
          type: 'string',
          options: {
            list: [
              { title: 'بدون (يدوي)', value: 'manual' },
              { title: 'Colissimo (La Poste)', value: 'colissimo' },
              { title: 'Chronopost', value: 'chronopost' },
              { title: 'Mondial Relay', value: 'mondial_relay' },
              { title: 'DPD', value: 'dpd' },
              { title: 'DHL', value: 'dhl' },
              { title: 'UPS', value: 'ups' },
              { title: 'GLS', value: 'gls' },
            ],
          },
          initialValue: 'manual',
        },
        { name: 'apiKey', title: 'مفتاح API', type: 'string', description: 'مفتاح API من شركة الشحن (اختياري)', hidden: true },
        { name: 'trackingUrl', title: 'رابط التتبع', type: 'string', description: 'رابط تتبع الشحنة — استخدم {tracking} كمتغير. مثال: https://www.laposte.fr/outils/suivre-vos-envois?code={tracking}' },
      ],
    },
  ],
  preview: {
    select: { title: 'name.fr', price: 'price', active: 'isActive', provider: 'carrier.provider' },
    prepare({ title, price, active, provider }) {
      const carriers: Record<string, string> = { colissimo: '📮', chronopost: '⚡', mondial_relay: '📍', dpd: '📦', dhl: '🟡', ups: '🟤', gls: '🔵', manual: '✋' }
      return {
        title: `${active ? '✅' : '❌'} ${title || 'بدون اسم'}`,
        subtitle: `${price === 0 ? 'مجاني' : price + '€'} ${carriers[provider || 'manual'] || ''} ${provider || 'يدوي'}`,
      }
    },
  },
})
