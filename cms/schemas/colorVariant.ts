import { defineType } from 'sanity'

export default defineType({
  name: 'colorVariant',
  title: 'لون',
  type: 'object',
  fields: [
    {
      name: 'colorHex', title: 'اللون', type: 'color',
      options: { disableAlpha: true },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'colorName', title: 'اسم اللون', type: 'localizedString',
    },
    {
      name: 'sku', title: 'SKU', type: 'string',
      description: 'يُنشأ تلقائياً إذا تركته فارغاً',
      readOnly: ({ document, value }: any) => {
        // Auto-fill on first render if empty
        return false
      },
    },
    {
      name: 'stock', title: 'المخزون', type: 'number', initialValue: 0,
      validation: (Rule) => Rule.required().min(0),
    },
    {
      name: 'images', title: 'الصور', type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      options: { layout: 'grid' },
      validation: (Rule) => Rule.required().min(1).error('صورة واحدة على الأقل'),
    },
    {
      name: 'priceOverride', title: 'سعر خاص (اختياري)', type: 'number',
      validation: (Rule) => Rule.min(0),
    },
  ],
  preview: {
    select: { title: 'colorName.fr', sku: 'sku', stock: 'stock', hex: 'colorHex.hex', img: 'images.0' },
    prepare({ title, sku, stock, hex, img }) {
      const stockIcon = stock > 5 ? '🟢' : stock > 0 ? '🟡' : '🔴'
      return {
        title: `${title || hex || 'لون'} — ${stockIcon} ${stock ?? 0}`,
        subtitle: sku || '(بدون SKU)',
        media: img,
      }
    },
  },
})
