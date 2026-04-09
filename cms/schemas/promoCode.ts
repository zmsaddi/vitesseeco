import { defineType } from 'sanity'

export default defineType({
  name: 'promoCode',
  title: 'كود خصم',
  type: 'document',
  icon: () => '🎟️',
  fields: [
    {
      name: 'code', title: 'الكود', type: 'string', description: 'حروف كبيرة وأرقام فقط — مثال: SUMMER20',
      validation: (Rule) => Rule.required()
        .regex(/^[A-Z0-9_-]+$/, { name: 'promo code format' })
        .max(30)
        .error('الكود يجب أن يحتوي حروف كبيرة وأرقام فقط، بدون مسافات'),
    },
    {
      name: 'discountType',
      title: 'نوع الخصم',
      type: 'string',
      options: { list: [{ title: 'نسبة مئوية (%)', value: 'percentage' }, { title: 'مبلغ ثابت (€)', value: 'fixed' }] },
      validation: (Rule) => Rule.required().error('اختر نوع الخصم'),
    },
    {
      name: 'discountValue', title: 'قيمة الخصم', type: 'number',
      description: 'مثال: 20 لـ 20% أو 50 لـ 50€',
      validation: (Rule) => Rule.required().min(0).custom((value, context) => {
        const doc = context.document as any
        if (doc?.discountType === 'percentage' && typeof value === 'number' && value > 100) {
          return 'النسبة لا يمكن أن تتجاوز 100%'
        }
        return true
      }),
    },
    {
      name: 'minOrderAmount', title: 'الحد الأدنى للطلب (€)', type: 'number',
      validation: (Rule) => Rule.min(0),
    },
    {
      name: 'maxUses', title: 'الحد الأقصى للاستخدامات', type: 'number',
      validation: (Rule) => Rule.min(1),
    },
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
