import { defineType } from 'sanity'

export default defineType({
  name: 'promoCode',
  title: 'كود خصم',
  type: 'document',
  icon: () => '🎟️',
  fields: [
    { name: 'code', title: 'الكود', type: 'string', description: 'مثال: SUMMER20' },
    {
      name: 'discountType',
      title: 'نوع الخصم',
      type: 'string',
      options: { list: [{ title: 'نسبة مئوية (%)', value: 'percentage' }, { title: 'مبلغ ثابت (€)', value: 'fixed' }] },
    },
    { name: 'discountValue', title: 'قيمة الخصم', type: 'number', description: 'مثال: 20 لـ 20% أو 50 لـ 50€' },
    { name: 'minOrderAmount', title: 'الحد الأدنى للطلب (€)', type: 'number' },
    { name: 'maxUses', title: 'الحد الأقصى للاستخدامات', type: 'number' },
    { name: 'currentUses', title: 'الاستخدامات الحالية', type: 'number', initialValue: 0, readOnly: true },
    { name: 'validFrom', title: 'صالح من', type: 'datetime' },
    { name: 'validUntil', title: 'صالح حتى', type: 'datetime' },
    { name: 'isActive', title: 'نشط', type: 'boolean', initialValue: true },
    {
      name: 'applicableProducts',
      title: 'المنتجات المعنية (فارغ = الكل)',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'product' }] }],
    },
  ],
  preview: {
    select: { title: 'code', type: 'discountType', value: 'discountValue', active: 'isActive' },
    prepare({ title, type, value, active }) {
      const discount = type === 'percentage' ? `${value}%` : `${value}€`
      return { title: title || 'كود', subtitle: `${discount} ${active ? '✅ نشط' : '❌ غير نشط'}` }
    },
  },
})
