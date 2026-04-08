import { defineType } from 'sanity'

export default defineType({
  name: 'colorVariant',
  title: 'متغير اللون',
  type: 'object',
  fields: [
    { name: 'colorName', title: 'اسم اللون', type: 'localizedString' },
    { name: 'colorHex', title: 'رمز اللون HEX', type: 'string', description: 'مثال: #000000' },
    { name: 'sku', title: 'SKU', type: 'string', description: 'الرمز الفريد للمنتج (مثال: V20PRO-BLK)' },
    {
      name: 'images',
      title: 'صور هذا اللون',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    },
    { name: 'stock', title: 'المخزون المتاح', type: 'number', initialValue: 0 },
    { name: 'priceOverride', title: 'سعر خاص (إذا مختلف)', type: 'number', description: 'اتركه فارغاً إذا كان نفس سعر المنتج' },
  ],
  preview: {
    select: { title: 'colorName.fr', subtitle: 'sku', stock: 'stock' },
    prepare({ title, subtitle, stock }) {
      return { title: title || 'لون', subtitle: `${subtitle || ''} — المخزون: ${stock ?? 0}` }
    },
  },
})
