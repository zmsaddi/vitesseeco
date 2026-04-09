import { defineType } from 'sanity'

export default defineType({
  name: 'colorVariant',
  title: 'لون',
  type: 'object',
  fields: [
    {
      name: 'colorName', title: '🎨 اسم اللون', type: 'localizedString',
      description: 'مثال: أسود، أبيض، رمادي ناردو...',
    },
    {
      name: 'colorHex', title: '🔴 رمز اللون', type: 'string',
      description: 'اكتب رمز اللون مثل #000000 (أسود) أو #FFFFFF (أبيض)',
      validation: (Rule) => Rule.required()
        .regex(/^#[0-9A-Fa-f]{6}$/, { name: 'hex color' })
        .error('أدخل لون بصيغة #RRGGBB مثل #FF0000'),
    },
    {
      name: 'images', title: '📸 صور هذا اللون', type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      description: 'ارفع صور المنتج بهذا اللون. أول صورة = تظهر في بطاقة المنتج',
      validation: (Rule) => Rule.required().min(1).error('أضف صورة واحدة على الأقل'),
    },
    {
      name: 'stock', title: '📦 المخزون', type: 'number', initialValue: 0,
      description: 'عدد القطع المتاحة من هذا اللون',
      validation: (Rule) => Rule.required().min(0).error('المخزون يجب أن يكون 0 أو أكثر'),
    },
    {
      name: 'sku', title: '🔖 رمز المنتج (SKU)', type: 'string',
      description: 'رمز فريد — مثال: V20PRO-BLK',
      validation: (Rule) => Rule.required().error('رمز SKU مطلوب لكل لون'),
    },
    {
      name: 'priceOverride', title: '💶 سعر خاص', type: 'number',
      description: 'فقط إذا سعر هذا اللون مختلف عن السعر الأساسي. اتركه فارغاً عادة',
      validation: (Rule) => Rule.min(0),
    },
  ],
  preview: {
    select: { title: 'colorName.fr', subtitle: 'sku', stock: 'stock', hex: 'colorHex' },
    prepare({ title, subtitle, stock, hex }) {
      return {
        title: `${title || 'لون'} ${hex ? `(${hex})` : ''}`,
        subtitle: `📦 المخزون: ${stock ?? 0} | ${subtitle || ''}`,
      }
    },
  },
})
