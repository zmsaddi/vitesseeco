import { defineType } from 'sanity'

export default defineType({
  name: 'shippingMethod',
  title: 'طريقة الشحن',
  type: 'document',
  icon: () => '🚚',
  fields: [
    { name: 'name', title: 'الاسم', type: 'localizedString' },
    { name: 'code', title: 'رمز فريد', type: 'string', description: 'مثال: standard, express, relay' },
    { name: 'description', title: 'الوصف', type: 'localizedString' },
    { name: 'estimatedDays', title: 'المدة المقدرة (أيام)', type: 'string', description: 'مثال: 5-7' },
    { name: 'price', title: 'السعر (€)', type: 'number', description: '0 = مجاني' },
    { name: 'freeAbove', title: 'مجاني فوق (€)', type: 'number', description: 'شحن مجاني إذا تجاوز الطلب هذا المبلغ. اتركه فارغاً إذا لم يكن مجانياً أبداً.' },
    {
      name: 'zones',
      title: 'مناطق الشحن',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'فرنسا الحضرية', value: 'FR' },
          { title: 'بلجيكا', value: 'BE' },
          { title: 'لوكسمبورغ', value: 'LU' },
          { title: 'ألمانيا', value: 'DE' },
          { title: 'هولندا', value: 'NL' },
          { title: 'إسبانيا', value: 'ES' },
        ],
      },
    },
    { name: 'isActive', title: 'نشط', type: 'boolean', initialValue: true },
    { name: 'sortOrder', title: 'الترتيب', type: 'number', initialValue: 0 },
  ],
  preview: {
    select: { title: 'name.fr', price: 'price', active: 'isActive' },
    prepare({ title, price, active }) {
      return {
        title: title || 'بدون اسم',
        subtitle: `${price === 0 ? 'مجاني' : price + '€'} ${active ? '✅' : '❌'}`,
      }
    },
  },
})
