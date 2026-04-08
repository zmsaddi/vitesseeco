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
    },
    {
      name: 'images', title: '📸 صور هذا اللون', type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      description: 'ارفع صور المنتج بهذا اللون. أول صورة = تظهر في بطاقة المنتج',
    },
    {
      name: 'stock', title: '📦 المخزون', type: 'number', initialValue: 0,
      description: 'عدد القطع المتاحة من هذا اللون',
    },
    {
      name: 'sku', title: '🔖 رمز المنتج (SKU)', type: 'string',
      description: 'رمز فريد — مثال: V20PRO-BLK',
    },
    {
      name: 'priceOverride', title: '💶 سعر خاص', type: 'number',
      description: 'فقط إذا سعر هذا اللون مختلف عن السعر الأساسي. اتركه فارغاً عادة',
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
